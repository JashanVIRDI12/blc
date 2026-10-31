import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Contrast-adaptive sharpening, after AMD FidelityFX CAS (MIT): each pixel
// is sharpened by as much as its neighbourhood's contrast leaves room for,
// so edges and fine detail (a grille, a badge, a dial's indices) crisp up
// without the halos of a plain unsharp mask. Run on the tone-mapped image,
// last. Shared by the About page's scenes.
export const SHARPEN = {
  name: 'ContrastAdaptiveSharpen',
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharpness: { value: .55 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uSharpness; varying vec2 vUv;
    vec3 tap(float x, float y) { return texture2D(tDiffuse, vUv + vec2(x, y) * uTexel).rgb; }
    void main() {
      vec3 a = tap(-1.0, -1.0), b = tap(0.0, -1.0), c = tap(1.0, -1.0);
      vec3 d = tap(-1.0, 0.0), e = tap(0.0, 0.0), f = tap(1.0, 0.0);
      vec3 g = tap(-1.0, 1.0), h = tap(0.0, 1.0), i = tap(1.0, 1.0);
      vec3 lo = min(min(min(d, e), min(f, b)), h);
      lo += min(lo, min(min(a, c), min(g, i)));
      vec3 hi = max(max(max(d, e), max(f, b)), h);
      hi += max(hi, max(max(a, c), max(g, i)));
      vec3 amp = clamp(min(lo, 2.0 - hi) / max(hi, vec3(1e-5)), 0.0, 1.0);
      amp = inversesqrt(max(amp, vec3(1e-5)));
      vec3 w = -1.0 / (amp * mix(8.0, 5.0, uSharpness));
      vec3 sharp = clamp(((b + d + f + h) * w + e) / (4.0 * w + 1.0), 0.0, 1.0);
      gl_FragColor = vec4(mix(e, sharp, uSharpness), 1.0);
    }`,
};

// The frame's last pass, in one: the bloom added (if there is one), tone
// mapping and the sRGB encoding (as three's OutputPass does them), then the
// sharpening above. One full-screen pass where there were three (the
// bloom's own blend, OutputPass, the sharpening), each of which read and
// wrote every pixel of a half-float frame: on a Retina laptop that was most
// of the frame's time. The picture is the same: each tap is lit, toned and
// encoded exactly as the separate passes did before sharpening reads it.
const TONE = {
  [THREE.LinearToneMapping]: 'LINEAR_TONE_MAPPING', [THREE.ReinhardToneMapping]: 'REINHARD_TONE_MAPPING',
  [THREE.CineonToneMapping]: 'CINEON_TONE_MAPPING', [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC_TONE_MAPPING',
  [THREE.AgXToneMapping]: 'AGX_TONE_MAPPING', [THREE.NeutralToneMapping]: 'NEUTRAL_TONE_MAPPING',
};
export class FinishPass extends ShaderPass {
  // bloom: an UnrealBloomPass earlier in the chain. Its own full-screen
  // blend is switched off; its result is added here instead.
  constructor(renderer, { bloom = null, sharpness = .55 } = {}) {
    const defines = {};
    if (TONE[renderer.toneMapping]) defines[TONE[renderer.toneMapping]] = '';
    if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) defines.SRGB_TRANSFER = '';
    if (bloom) defines.USE_BLOOM = '';
    super(new THREE.RawShaderMaterial({
      name: 'FinishShader',
      defines,
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, toneMappingExposure: { value: 1 }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharpness: { value: sharpness } },
      vertexShader: `
        precision highp float;
        uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
        attribute vec3 position; attribute vec2 uv;
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform vec2 uTexel; uniform float uSharpness;
        #include <tonemapping_pars_fragment>
        #include <colorspace_pars_fragment>
        varying vec2 vUv;
        vec3 tap(float x, float y) {
          vec2 at = vUv + vec2(x, y) * uTexel;
          vec4 c = texture2D(tDiffuse, at);
          #ifdef USE_BLOOM
            c += texture2D(tBloom, at);
          #endif
          #if defined(LINEAR_TONE_MAPPING)
            c.rgb = LinearToneMapping(c.rgb);
          #elif defined(REINHARD_TONE_MAPPING)
            c.rgb = ReinhardToneMapping(c.rgb);
          #elif defined(CINEON_TONE_MAPPING)
            c.rgb = CineonToneMapping(c.rgb);
          #elif defined(ACES_FILMIC_TONE_MAPPING)
            c.rgb = ACESFilmicToneMapping(c.rgb);
          #elif defined(AGX_TONE_MAPPING)
            c.rgb = AgXToneMapping(c.rgb);
          #elif defined(NEUTRAL_TONE_MAPPING)
            c.rgb = NeutralToneMapping(c.rgb);
          #endif
          #ifdef SRGB_TRANSFER
            c = sRGBTransferOETF(c);
          #endif
          return c.rgb;
        }
        void main() {
          vec3 a = tap(-1.0, -1.0), b = tap(0.0, -1.0), c = tap(1.0, -1.0);
          vec3 d = tap(-1.0, 0.0), e = tap(0.0, 0.0), f = tap(1.0, 0.0);
          vec3 g = tap(-1.0, 1.0), h = tap(0.0, 1.0), i = tap(1.0, 1.0);
          vec3 lo = min(min(min(d, e), min(f, b)), h);
          lo += min(lo, min(min(a, c), min(g, i)));
          vec3 hi = max(max(max(d, e), max(f, b)), h);
          hi += max(hi, max(max(a, c), max(g, i)));
          vec3 amp = clamp(min(lo, 2.0 - hi) / max(hi, vec3(1e-5)), 0.0, 1.0);
          amp = inversesqrt(max(amp, vec3(1e-5)));
          vec3 w = -1.0 / (amp * mix(8.0, 5.0, uSharpness));
          vec3 sharp = clamp(((b + d + f + h) * w + e) / (4.0 * w + 1.0), 0.0, 1.0);
          gl_FragColor = vec4(mix(e, sharp, uSharpness), 1.0);
        }`,
    }));
    this.bloom = bloom;
    if (bloom) bloom.blendMaterial.visible = false; // drawn as nothing: the bloom is added above
  }
  setSize(width, height) { this.uniforms.uTexel.value.set(1 / width, 1 / height); }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    // The bloom's mips are composited into its first horizontal target.
    if (this.bloom) this.uniforms.tBloom.value = this.bloom.renderTargetsHorizontal[0].texture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}
