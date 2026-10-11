// The dark studio the About page's unveiling and the home page's one-to-one
// stand in: black stone polished to a soft mirror, and a cyclorama with one
// warm glow low at the horizon, floor and wall meeting without a line.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// The floor: black stone polished to a soft mirror. The reflection is
// blurred more the further it lies from the car and fades out towards the
// walls, so the car stands on it, not in it. The blur reads a mipmapped
// reflection at the level that matches its reach, so even a wide one is a
// smooth wash, never a mosaic of separate taps. In a scene with no wall to
// meet, `uFar` (metres; with the material set transparent) fades the stone
// out before its edge, so it has no horizon. `paper` is the same floor in a
// white studio: nothing of its own, only the reflection laid over whatever
// is behind it, at `strength`.
export function studioFloor(size, textureSize, { strength = .46, blur = .6, paper = false } = {}) {
  const floor = new Reflector(new THREE.PlaneGeometry(size, size), {
    textureWidth: textureSize.w, textureHeight: textureSize.h, clipBias: .003, color: '#040405',
    shader: {
      name: 'StudioFloor',
      uniforms: { color: { value: new THREE.Color('#040405') }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTexel: { value: new THREE.Vector2(1 / textureSize.w, 1 / textureSize.h) }, uStrength: { value: strength }, uBlur: { value: blur }, uGlow: { value: .6 }, uFar: { value: 0 } },
      vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main() { vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uStrength; uniform float uGlow; uniform float uBlur; uniform float uFar;
        varying vec4 vUv; varying vec3 vWorld;
        void main() {
          vec2 uv = vUv.xy / vUv.w;
          float d = length(vWorld.xz * vec2(.8, .55));
          float r = mix(uBlur, 7.0, smoothstep(.6, 6.5, d));
          // Taps r texels apart, each from the level whose texels are r wide,
          // weighted as a Gaussian.
          float lod = log2(max(r, 1.0));
          vec3 sum = vec3(0.0); float total = 0.0;
          for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
            float w = exp(-float(i * i + j * j) / 4.5);
            sum += textureLod(tDiffuse, uv + vec2(float(i), float(j)) * uTexel * r, lod).rgb * w;
            total += w;
          }
          vec3 reflection = sum / total;
          float fade = 1.0 - smoothstep(${paper ? '.9, 4.4' : '3.0, 13.0'}, d);
          // Towards the wall the floor takes up the cove's glow, so floor and
          // wall meet without a line, as in a cyclorama.
          float wall = smoothstep(9.0, 23.8, length(vWorld.xz));
          vec3 cove = vec3(.62, .40, .19) * .55 * exp(-pow(.25 / 1.25, 2.0)) * uGlow * wall * wall;
          float edge = uFar > 0.0 ? 1.0 - smoothstep(uFar * .45, uFar, length(vWorld.xz)) : 1.0;
          gl_FragColor = ${paper ? 'vec4(reflection, uStrength * fade * edge)' : 'vec4(color + reflection * uStrength * fade + cove, edge)'};
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  if (paper) { floor.material.transparent = true; floor.material.depthWrite = false; }
  const texture = floor.getRenderTarget().texture;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  // The Reflector looks up from under the floor with a camera whose left and
  // right are the viewer's swapped, yet gives it the viewer's own frustum. A
  // frustum shifted to one side (setViewOffset, which every stage here uses
  // to stand the car clear of the words) then looks to the wrong side, and
  // the floor on the other reflects nothing. So it is handed the viewer's
  // camera with the shift turned round.
  const reflect = floor.onBeforeRender, twin = new THREE.PerspectiveCamera();
  floor.onBeforeRender = (renderer, scene, camera) => {
    twin.matrixWorld.copy(camera.matrixWorld);
    twin.projectionMatrix.copy(camera.projectionMatrix);
    twin.projectionMatrix.elements[8] *= -1;
    twin.far = camera.far;
    reflect.call(floor, renderer, scene, twin);
  };
  return floor;
}

// The cyclorama: black, with one warm band of light low at the horizon.
export function cove() {
  const geometry = new THREE.CylinderGeometry(24, 24, 14, 64, 1, true);
  geometry.translate(0, 6.5, 0);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uGlow: { value: .6 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uGlow; varying vec3 vP;
      void main(){
        float h = vP.y;
        float band = exp(-pow((h - .25) / 1.25, 2.0));
        float haze = exp(-pow((h - 1.6) / 4.0, 2.0)) * .25;
        vec3 warm = vec3(.62, .40, .19);
        vec3 col = vec3(.008, .008, .009) + warm * (band * .55 + haze * .22) * uGlow;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}


// A gloss floor without a mirror pass, for a scene whose reflection is a
// fading copy of its subject (mirrorOf): black stone that takes up the cove's
// glow towards the wall, with a warm pool of light that can come up under the
// subject. It writes no depth, so the copy beneath it shows through.
export function glossFloor(size) {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { color: { value: new THREE.Color('#050506') }, uGlow: { value: .6 }, uPool: { value: 0 }, uPoolAt: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 color; uniform float uGlow; uniform float uPool; uniform vec2 uPoolAt; varying vec3 vWorld;
      void main() {
        float wall = smoothstep(9.0, 23.8, length(vWorld.xz));
        vec3 warm = vec3(.62, .40, .19);
        vec3 cove = warm * .55 * exp(-pow(.25 / 1.25, 2.0)) * uGlow * wall * wall;
        vec2 d = (vWorld.xz - uPoolAt) * vec2(.55, .9);
        vec3 pool = warm * exp(-dot(d, d) * 1.4) * uPool * .35;
        gl_FragColor = vec4(color + cove + pool, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// The subject's reflection in polished stone: the same mesh, mirrored under
// the floor, fading with depth below it.
export function mirrorMaterial(base, { strength = .34, falloff = 2.4 } = {}) {
  const material = base.clone();
  material.transparent = true;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMirrorY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMirrorY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMirrorY;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.a *= ${strength.toFixed(3)} * exp(vMirrorY * ${falloff.toFixed(3)});`);
  };
  return material;
}

// A studio for a car on white. What the car reflects, and so what lights
// it: on black paint, nearly all that is seen. A dark cove, so the paint stays black, and in it the lights a
// car studio hangs: a long bank overhead, drawn along the bonnet, roof and
// shoulders; a strip down each side at door height, the line of light that
// runs the length of a flank; a card ahead and one behind for the nose and
// the tail; and the white floor, which the sills and lower doors look down
// on. Their edges are kept crisp (a few per cent of feather, where the floor
// fades over a third of its width): it is the sharp edge of a reflected
// light that tells the eye a surface is lacquered.
export function carStudio(floor = '#f2f0eb') {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#0b0c0e');
  const made = [];
  const feathered = share => {
    const size = 128, data = new Uint8Array(size * size * 4);
    const edge = t => THREE.MathUtils.smoothstep(t, 0, share) * THREE.MathUtils.smoothstep(1 - t, 0, share);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = Math.round(255 * edge((x + .5) / size) * edge((y + .5) / size));
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
    const map = new THREE.DataTexture(data, size, size);
    map.magFilter = map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    made.push(map);
    return map;
  };
  const crisp = feathered(.05), soft = feathered(.34);
  // Width by height, turned (x, then y) to face the car.
  const panel = (width, height, power, color, at, turn, map = crisp) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), map, side: THREE.DoubleSide }));
    mesh.position.set(...at); mesh.rotation.set(turn[0], turn[1], 0, 'YXZ'); room.add(mesh);
  };
  panel(3.6, 12, 5.5, '#ffffff', [.2, 4.6, 0], [Math.PI / 2, 0]);
  panel(20, .9, 14, '#ffffff', [9, 2.5, 0], [0, -Math.PI / 2]);
  panel(20, .9, 9, '#f2f5ff', [-9, 2.5, 0], [0, Math.PI / 2]);
  panel(24, 7, .55, '#eef1f6', [13, 3.2, 0], [0, -Math.PI / 2], soft);
  panel(6, 2.4, 4, '#ffffff', [1.5, 2.4, 10], [0, Math.PI]);
  panel(6, 2.4, 3.2, '#ffffff', [1.5, 2.4, -10], [0, 0]);
  panel(38, 38, .62, floor, [0, -.05, 0], [-Math.PI / 2, 0], soft);
  room.userData.dispose = () => { made.forEach(map => map.dispose()); room.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); };
  return room;
}
