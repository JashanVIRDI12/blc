import * as THREE from 'three';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Preserve HDR highlights through MSAA and SMAA, then tone map once. The
// canvas is transparent over the page and dust, so output conversion must
// unpremultiply before tone mapping and premultiply again afterwards.
// Otherwise faint glows and antialiased edges acquire bright fringes.
export function createStudioOutput(renderer, { mobile }) {
  const gl = renderer.getContext();
  const available = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  const samples = [...available].filter(value => value <= 4).sort((a, b) => b - a)[0] || 0;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples, resolveDepthBuffer: false,
  });
  const smaa = mobile ? null : new SMAAPass();
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

  return {
    quality: { hdr: true, smaa: Boolean(smaa), samples },
    setSize(width, height) {
      sceneTarget.setSize(width, height);
      filtered?.setSize(width, height);
      smaa?.setSize(width, height);
    },
    render(scene, camera) {
      const toneMapping = renderer.toneMapping;
      const target = renderer.getRenderTarget();
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, camera);
        if (smaa) smaa.render(renderer, filtered, sceneTarget);
        renderer.toneMapping = toneMapping;
        output.render(renderer, null, filtered || sceneTarget);
      } finally {
        renderer.toneMapping = toneMapping;
        renderer.setRenderTarget(target);
      }
    },
    dispose() {
      sceneTarget.dispose(); filtered?.dispose(); smaa?.dispose(); output.dispose();
    },
  };
}
