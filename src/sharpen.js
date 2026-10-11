import * as THREE from 'three';

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
