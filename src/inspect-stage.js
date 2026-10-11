// The inspection's car: a black Land Rover Defender on a studio turntable,
// in a white studio. The scroll turns the table (about-page.js), nose to
// tail, the way a car is gone over: the front, a wheel, the flank, the
// glasshouse, the rear and its plate; the camera stays where it is and only
// leans in. Nothing is cut and nothing is written on the picture: what moves
// is the studio's light, sliding along black paint as the car turns.
//
// The paint is lit by what it reflects (carStudio: a dark cove, a crisp bank
// overhead and a strip down each side); the floor is polished on screens
// that can afford the second view of the car it takes; the car stands on
// its baked contact shadow. Drawn only when something has changed.
import * as THREE from 'three';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { inspectionVehicle } from './config.js';
import { createRenderDensity } from './render-density.js';
import { studioFloor, carStudio } from './studio-stage.js';
import { compileAhead } from './compile.js';

const PAPER = '#f2f0eb'; // the section's own white (about-page.css)
const RIM = 3.25; // the turntable's radius, metres
// Where the table stands for each check, the first and the last for the car
// whole. `turn` is the side of the car that faces the camera, in degrees
// (0 its nose, 90 its left flank, 180 its tail); `focus` what the camera
// looks at, in car metres (nose towards +z, left side +x, tyres on y = 0);
// `away` how far back it stands from that, `height` its eye, and `shift`
// where in the frame that point is set (a share of its width, from the
// centre): a closer view keeps the car whole on the side the words are,
// and lets it run out of the frame on the other.
const STOPS = [
  { turn: -30, focus: [0, .92, 0], away: 13.6, height: 1.55, shift: 0 },
  { turn: 8, focus: [0, 1.0, 1.5], away: 9.8, height: 1.3, shift: 0 }, // engine and service: the front
  { turn: 54, focus: [.86, .52, 1.5], away: 9.6, height: .82, shift: -.07 }, // tyres and brakes: a front wheel
  { turn: 90, focus: [1.0, .95, -.05], away: 11.6, height: 1.2, shift: 0 }, // paint and panels: the flank
  { turn: 128, focus: [.8, 1.4, -.75], away: 9.6, height: 2.35, shift: .09 }, // cabin and electronics: the glasshouse
  { turn: 180, focus: [0, 1.0, -2.2], away: 8.8, height: 1.3, shift: 0 }, // registration and history: the tail, and its plate
  { turn: 214, focus: [0, .92, 0], away: 13.6, height: 1.55, shift: 0 },
];

// The turntable: a fine rim, graduated like an instrument's, flush with the
// studio floor. It turns with the car, so the turning can be read.
function turntable() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vP;
      float mark(float x) { return 1.0 - smoothstep(0.0, min(fwidth(x), .5) * 1.3, abs(fract(x + .5) - .5)); }
      void main() {
        float r = length(vP), around = atan(vP.y, vP.x) / 6.2831853, w = fwidth(r) * 1.4;
        float rim = 1.0 - smoothstep(0.0, w, abs(r - ${RIM.toFixed(2)}));
        float band = step(${(RIM - .13).toFixed(2)}, r) * step(r, ${RIM.toFixed(2)});
        float tall = step(${(RIM - .26).toFixed(2)}, r) * step(r, ${RIM.toFixed(2)});
        float lines = max(rim * .5, max(mark(around * 120.0) * band * .3, mark(around * 12.0) * tall * .55));
        // The platform itself: the faintest shade, gone before the rim.
        float plate = (1.0 - smoothstep(${(RIM * .2).toFixed(2)}, ${RIM.toFixed(2)}, r)) * .035;
        float a = max(lines, plate);
        gl_FragColor = vec4(vec3(.09, .085, .07), a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(RIM + .05, 128), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = .003;
  return mesh;
}

export function createInspectStage(stage, { phone = false } = {}) {
  const canvas = stage.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(PAPER, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const room = carStudio(PAPER), pmrem = new THREE.PMREMGenerator(renderer);
  // Four times the default's pixels: at 256 a face a reflected edge is a
  // blur, and lacquer looks like satin.
  const environment = pmrem.fromScene(room, 0, .1, 100, { size: 512 });
  room.userData.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  const textureSize = { w: 512, h: 512 };
  const gloss = phone ? null : studioFloor(60, textureSize, { strength: .22, blur: .9, paper: true });
  if (gloss) {
    gloss.rotation.x = -Math.PI / 2;
    gloss.material.uniforms.uFar.value = 22;
    gloss.renderOrder = -1;
    scene.add(gloss);
  }
  // Everything that turns: the table, the car and its shadow.
  const table = new THREE.Group();
  table.add(turntable());
  scene.add(table);

  const camera = new THREE.PerspectiveCamera(24, 1, .3, 80);
  const density = createRenderDensity({ mobile: phone });
  let size = { w: 1, h: 1 }, ratio = 1, raf = 0, ready = false, active = true, disposed = false, position = 0;
  const focus = new THREE.Vector3(), other = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function layout() {
    size = { w: stage.clientWidth || 1, h: stage.clientHeight || 1 };
    ratio = density.ratio(size.w, size.h);
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    // The reflection at half the frame's pixels: it is blurred anyway.
    if (gloss) {
      const w = Math.round(size.w * ratio / 2), h = Math.round(size.h * ratio / 2);
      gloss.getRenderTarget().setSize(w, h);
      gloss.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    }
    invalidate();
  }
  function frame() {
    const i = Math.min(STOPS.length - 2, Math.max(0, Math.floor(position))), u = Math.min(1, Math.max(0, position - i)), a = STOPS[i], b = STOPS[i + 1];
    const mix = (x, y) => x + (y - x) * u;
    const turn = THREE.MathUtils.degToRad(mix(a.turn, b.turn));
    table.rotation.y = -turn;
    // What the camera looks at turns with the table.
    focus.fromArray(a.focus).lerp(other.fromArray(b.focus), u).applyAxisAngle(up, -turn);
    // A narrow frame stands further off, so the car's length still fits.
    const fit = Math.max(1, (phone ? 1.04 : 1.22) / camera.aspect);
    camera.position.set(focus.x, mix(a.height, b.height), focus.z + mix(a.away, b.away) * fit);
    camera.lookAt(focus);
    camera.setViewOffset(size.w, size.h, -mix(a.shift, b.shift) * size.w, 0, size.w, size.h);
    camera.updateProjectionMatrix();
  }
  function draw(now) {
    raf = 0;
    if (!ready || !active || disposed) return;
    if (density.slow(now) && density.step(size.w, size.h)) layout();
    frame();
    renderer.render(scene, camera);
  }
  function invalidate() { if (!raf && ready && active && !disposed && !document.hidden) raf = requestAnimationFrame(draw); }

  async function load() {
    const spec = { ...models[inspectionVehicle.id], partMap: vehicleParts[inspectionVehicle.id] };
    const [car, shadowTexture] = await Promise.all([loadCar(spec, inspectionVehicle.paint, { invalidate }), new THREE.TextureLoader().loadAsync(spec.shadow)]);
    if (disposed) return;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: '#1f1a14', alphaMap: shadowTexture, transparent: true, opacity: .56, depthWrite: false, toneMapped: false }));
    // The map runs out to its edges still a little grey: nothing on dark
    // stone, a hard-edged rectangle on white. Here it is gathered under the
    // car and feathered to nothing before the edge.
    shadow.material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', 'vec2 rim = smoothstep(0.0, .2, vAlphaMapUv) * smoothstep(1.0, .8, vAlphaMapUv); diffuseColor.a *= smoothstep(.1, .85, texture2D(alphaMap, vAlphaMapUv).g) * rim.x * rim.y;'); };
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .006; shadow.renderOrder = 1;
    table.add(car.root, shadow);
    layout();
    frame();
    await compileAhead(renderer, scene, camera);
    if (disposed) return;
    ready = true;
    invalidate();
  }
  const resizer = new ResizeObserver(() => layout());
  resizer.observe(stage);
  const loaded = load();
  if (import.meta.env.DEV) window.__inspect = { state: () => ({ ready, active, position }), still: () => { frame(); renderer.render(scene, camera); return canvas.toDataURL('image/png'); }, set: value => { position = value; invalidate(); } };
  return {
    loaded,
    stops: STOPS.length,
    // Where the table stands: 0 to the last stop, fractions between two.
    set(value) { if (value !== position) { position = value; invalidate(); } },
    setActive(value) { active = value; invalidate(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); resizer.disconnect();
      scene.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(material => material?.dispose()); });
      gloss?.getRenderTarget().dispose();
      environment.dispose(); renderer.dispose();
    },
  };
}
