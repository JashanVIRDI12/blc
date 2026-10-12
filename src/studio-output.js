import * as THREE from 'three';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Preserve HDR highlights through MSAA and SMAA, then tone map once. The
// canvas is transparent over the page and dust, so output conversion must
// unpremultiply before tone mapping and premultiply again afterwards.
// Otherwise faint glows and antialiased edges acquire bright fringes.
//
// A frame comes in two qualities, at the same density and through the same
// filter and tone mapping. In full, the scene is multisampled: with cars this
// finely modelled, most pixels hold the edges of several triangles, each
// shaded for its own samples, and that was a quarter of the frame. `quick`
// draws it once a pixel and leaves the edges to SMAA: for frames the scroll is
// driving, where the eye cannot tell, so that a still picture is always the
// full one. Phones have no SMAA pass and draw in full throughout.
//
// The multisampled target is by far the largest thing the stage holds on the
// GPU (a quarter of a gigabyte at a 1440 x 820 Retina frame). Where there is
// a quick target it exists only while a full frame is being drawn: memory a
// page holds idle is memory the system pages out, and the next frame then
// waits for it to come back.
export function createStudioOutput(renderer, { mobile }) {
  const gl = renderer.getContext();
  const available = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  const samples = [...available].filter(value => value <= 4).sort((a, b) => b - a)[0] || 0;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples, resolveDepthBuffer: false,
  });
  const smaa = mobile ? null : new SMAAPass();
  // The filter's own edge and weight maps hold fractions, not light: eight
  // bits a channel, as SMAA is specified, not three's sixteen.
  for (const map of [smaa?._edgesRT, smaa?._weightsRT]) if (map) map.texture.type = THREE.UnsignedByteType;
  const quickTarget = smaa ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }) : null;
  const filtered = smaa ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }) : null;
  const output = new OutputPass();
  output.renderToScreen = true;
  output.material.fragmentShader = output.material.fragmentShader
    .replace('#include <colorspace_pars_fragment>', `#include <colorspace_pars_fragment>
      vec3 studioDither(vec3 color) {
        float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        return clamp(color + vec3(noise / 255.0), 0.0, 1.0);
      }`)
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', `
      gl_FragColor = texture2D( tDiffuse, vUv );
      float coverage = clamp(gl_FragColor.a, 0.0, 1.0);
      gl_FragColor.rgb /= max(coverage, 0.000001);
      gl_FragColor.a = coverage;`)
    .replace('gl_FragColor = sRGBTransferOETF( gl_FragColor );', `
      gl_FragColor = sRGBTransferOETF( gl_FragColor );
      gl_FragColor.rgb = studioDither(gl_FragColor.rgb);`)
    .replace(/\n\s*}\s*$/, '\n gl_FragColor.rgb *= coverage;\n }');

  // Programs are keyed on where they draw: one compiled for the canvas
  // (sRGB, tone mapped) is not the one the HDR target needs (linear, no tone
  // mapping), and three would build that one synchronously on the first
  // frame, stalling the page for every car material at once just as the
  // stage scrolls into view. So compile with the scene's real target bound,
  // the filter passes with it, in parallel where the browser allows
  // (KHR_parallel_shader_compile).
  const passes = smaa ? [smaa._materialEdges, smaa._materialWeights, smaa._materialBlend].filter(Boolean) : [];
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.PlaneGeometry(2, 2);
  function compile(scene, camera, targetScene = scene) {
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(quickTarget || sceneTarget);
    try {
      const quads = passes.map(material => new THREE.Mesh(quad, material));
      return Promise.all([renderer.compileAsync(scene, camera, targetScene), ...quads.map(mesh => renderer.compileAsync(mesh, flat))]);
    } finally {
      renderer.setRenderTarget(target);
    }
  }

  return {
    quality: { hdr: true, smaa: Boolean(smaa), samples, quick: Boolean(quickTarget) },
    compile,
    setSize(width, height) {
      sceneTarget.setSize(width, height);
      quickTarget?.setSize(width, height);
      filtered?.setSize(width, height);
      smaa?.setSize(width, height);
    },
    render(scene, camera, quick = false) {
      const toneMapping = renderer.toneMapping;
      const target = renderer.getRenderTarget();
      const drawn = (quick && quickTarget) || sceneTarget;
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(drawn);
        renderer.render(scene, camera);
        if (smaa) smaa.render(renderer, filtered, drawn);
        renderer.toneMapping = toneMapping;
        output.render(renderer, null, filtered || drawn);
      } finally {
        renderer.toneMapping = toneMapping;
        renderer.setRenderTarget(target);
        if (quickTarget && drawn === sceneTarget) sceneTarget.dispose();
      }
    },
    // Run the filter and the output pass once over nothing. The output
    // pass's program is only made when it is first used, and that holds the
    // page for a moment: call this while nothing is being watched.
    prime() {
      const target = renderer.getRenderTarget();
      const drawn = quickTarget || sceneTarget;
      try {
        renderer.setRenderTarget(drawn);
        renderer.clear();
        if (smaa) smaa.render(renderer, filtered, drawn);
        output.render(renderer, null, filtered || drawn);
      } finally {
        renderer.setRenderTarget(target);
      }
    },
    // Draw the scene into one of its targets (`quick`, or the full one) and
    // show nothing. A mesh's geometry is sent to the GPU, and the driver
    // builds the pipeline that draws it into a given target, only when it is
    // first drawn there.
    rehearse(scene, camera, quick = false) {
      const toneMapping = renderer.toneMapping;
      const target = renderer.getRenderTarget();
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget((quick && quickTarget) || sceneTarget);
        renderer.render(scene, camera);
      } finally {
        renderer.toneMapping = toneMapping;
        renderer.setRenderTarget(target);
      }
    },
    // The full frame's target, given up until the next full frame.
    release() { if (quickTarget) sceneTarget.dispose(); },
    dispose() {
      sceneTarget.dispose(); quickTarget?.dispose(); filtered?.dispose(); smaa?.dispose(); output.dispose(); quad.dispose();
    },
  };
}
