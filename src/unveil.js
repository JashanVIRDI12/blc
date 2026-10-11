// The unveiling, the About page's opening. A Mercedes-Maybach S 580 stands
// in a dark studio under an ivory silk cover: the Baba logo is worked in gold
// thread on its bonnet, a gold band runs round its hem, and it is lined in
// champagne. The scroll draws it away: the cover is taken by the middle of
// its back hem, lifted, and pulled back over the roof and up out of sight,
// the silk sliding and folding as it goes (cloth.js), while a softbox travels
// along the car so a highlight runs down the paint as it is revealed.
//
// The cover is a satin of some body, drawn as it is: refined to twice the
// simulation's resolution so its folds stay round, a few millimetres thick
// (a face and a lining either side of the simulated sheet, a rim at the hem),
// glossy with a highlight drawn out along its weave, the weave itself in its
// normals, and its folds' valleys shaded. The studio air is still: the cloth
// moves only when the hand moves it, and the simulation and the drawing both
// rest when nothing moves. The frame is multisampled into a half-float
// target, tone-mapped, then sharpened by contrast-adaptive sharpening, and
// the car's textures are filtered at the GPU's full anisotropy.
//
// The scroll is the hand on the hem, not the clock: the hem follows the
// scroll at a hand's pace, so scrolling back draws the cover back over the
// car. The studio is grounded: a black floor that reflects the car, softly
// and more softly with distance, one warm glow low at the horizon, nothing
// else. The car and cover settle before the first frame is shown (the cover
// is dropped over the car and left to fall while the page loads). Reduced
// motion and WebGL failure keep the still.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { showcase } from './config.js';
import { createRenderDensity } from './render-density.js';
import { bakeHeight, createCloth } from './cloth.js';
import { studioFloor, cove } from './studio-stage.js';
import { SHARPEN } from './sharpen.js';
import { compileAhead } from './compile.js';
gsap.registerPlugin(ScrollTrigger);

const CAR = 'sclass';
const SHEET = { width: 6.1, length: 8.3 };
const STEP = 1 / 120;
// Where the hand on the hem goes, as the pull runs from 0 to 1: up off the
// floor behind the car, back over the roof, then up and away.
const HEM_PATH = [[0, 0, 0], [0, 1.15, -.9], [0, 2.4, -1.9], [-.4, 4.2, -3.1], [-1.4, 8.5, -4.6], [-2.4, 15, -6]];
const STACKED = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');

// The face of the cover: ivory silk, a gold hem band, the logo on the bonnet.
// A second painting carries the finish: gold thread is metal (blue) and a
// little rougher (green).
function paintCover(logo) {
  const W = 1536, H = Math.round(W * SHEET.length / SHEET.width);
  const color = document.createElement('canvas'), finish = document.createElement('canvas');
  color.width = finish.width = W; color.height = finish.height = H;
  const c = color.getContext('2d'), f = finish.getContext('2d');
  c.fillStyle = '#e9dfcd'; c.fillRect(0, 0, W, H);
  f.fillStyle = 'rgb(255,128,0)'; f.fillRect(0, 0, W, H);
  // Woven silk: the finest of ribs, along the warp.
  c.fillStyle = 'rgba(120,96,60,.035)';
  for (let x = 0; x < W; x += 3) c.fillRect(x, 0, 1, H);
  const band = (inset, width) => {
    const gold = c.createLinearGradient(0, 0, W, H);
    gold.addColorStop(0, '#a8763a'); gold.addColorStop(.5, '#e8bf6a'); gold.addColorStop(1, '#a8763a');
    c.strokeStyle = gold; c.lineWidth = width; c.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    f.strokeStyle = 'rgb(255,110,255)'; f.lineWidth = width; f.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  };
  band(W * .045, W * .012);
  band(W * .068, W * .003);
  if (logo) {
    // On the bonnet: a quarter of the sheet back from its front hem (the
    // canvas's foot is the nose).
    const w = W * .36, h = w * logo.height / logo.width, x = (W - w) / 2, y = H * .73 - h / 2;
    c.drawImage(logo, x, y, w, h);
    const ink = document.createElement('canvas'); ink.width = Math.ceil(w); ink.height = Math.ceil(h);
    const ictx = ink.getContext('2d'); ictx.drawImage(logo, 0, 0, w, h); ictx.globalCompositeOperation = 'source-in'; ictx.fillStyle = 'rgb(255,120,255)'; ictx.fillRect(0, 0, w, h);
    f.drawImage(ink, x, y);
  }
  return { color, finish };
}

// Satin's weave, as a normal map: round warp threads in long floats, each
// passing under the weft once in five rows, offset by two from its neighbour
// (a five-harness satin). Mipmapped, so at a distance it settles into the
// smooth face satin has; up close the floats catch the light.
function satinWeave(size = 128, threads = 16) {
  const height = (x, y) => {
    const px = ((x % size) + size) % size, py = ((y % size) + size) % size;
    const u = px / size * threads, v = py / size * threads;
    const column = Math.floor(u), across = u - column - .5;
    const row = Math.floor(v), along = v - row;
    const round = Math.sqrt(Math.max(0, 1 - 4 * across * across));
    const under = (row + column * 2) % 5 === 0 ? Math.sin(Math.PI * along) * .65 : 0;
    return round * (1 - under);
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (height(x - 1, y) - height(x + 1, y)) * 1.3, ny = (height(x, y - 1) - height(x, y + 1)) * 1.3;
    const l = Math.hypot(nx, ny, 1), k = (y * size + x) * 4;
    data[k] = (nx / l * .5 + .5) * 255; data[k + 1] = (ny / l * .5 + .5) * 255; data[k + 2] = (1 / l * .5 + .5) * 255; data[k + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// The cover as it is drawn, from the simulated grid: refined to twice its
// resolution with Catmull-Rom curves along rows then columns, so its folds
// and silhouette stay round; given its thickness, a face and a lining set
// half of it either side of the simulated sheet along its normals, joined by
// a rim round the hem; and darkened in the valleys of its folds, from how far
// the cloth around each point stands above it along its normal.
function coverSurface(nx, nz, thickness) {
  const RX = 2 * nx - 1, RZ = 2 * nz - 1, n = RX * RZ;
  const centre = new Float32Array(n * 3), normal = new Float32Array(n * 3), ao = new Float32Array(n * 3).fill(1);
  const front = new Float32Array(n * 3), back = new Float32Array(n * 3), backNormal = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const rows = new Float32Array(RX * nz * 3);
  const faces = [], reversed = [];
  for (let rj = 0; rj < RZ; rj++) for (let ri = 0; ri < RX; ri++) {
    const k = rj * RX + ri;
    uv[2 * k] = ri / (RX - 1); uv[2 * k + 1] = 1 - rj / (RZ - 1);
    if (ri + 1 < RX && rj + 1 < RZ) {
      const a = k, b = k + RX, c = k + 1, d = k + RX + 1;
      faces.push(a, b, c, c, b, d);
      reversed.push(a, c, b, c, d, b);
    }
  }
  const dynamic = (array, size) => new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
  const colour = dynamic(ao, 3), uvs = new THREE.BufferAttribute(uv, 2);
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', dynamic(front, 3)); face.setAttribute('normal', dynamic(normal, 3));
  face.setAttribute('color', colour); face.setAttribute('uv', uvs); face.setIndex(faces);
  const lining = new THREE.BufferGeometry();
  lining.setAttribute('position', dynamic(back, 3)); lining.setAttribute('normal', dynamic(backNormal, 3));
  lining.setAttribute('color', colour); lining.setAttribute('uv', uvs); lining.setIndex(reversed);
  // The hem's edge: once round the border, face and lining a thickness apart.
  const loop = [];
  for (let ri = 0; ri < RX; ri++) loop.push(ri);
  for (let rj = 1; rj < RZ; rj++) loop.push(rj * RX + RX - 1);
  for (let ri = RX - 2; ri >= 0; ri--) loop.push((RZ - 1) * RX + ri);
  for (let rj = RZ - 2; rj > 0; rj--) loop.push(rj * RX);
  const L = loop.length, rimPosition = new Float32Array(L * 2 * 3), rimIndex = [];
  for (let e = 0; e < L; e++) { const a = 2 * e, b = 2 * ((e + 1) % L); rimIndex.push(a, a + 1, b, b, a + 1, b + 1); }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', dynamic(rimPosition, 3)); rim.setIndex(rimIndex);
  const refine = (src, from, count, dst, to) => {
    for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) dst[to(2 * i) + c] = src[from(i) + c];
    for (let i = 0; i + 1 < count; i++) {
      const p0 = from(Math.max(0, i - 1)), p1 = from(i), p2 = from(i + 1), p3 = from(Math.min(count - 1, i + 2));
      for (let c = 0; c < 3; c++) dst[to(2 * i + 1) + c] = (-src[p0 + c] + 9 * src[p1 + c] + 9 * src[p2 + c] - src[p3 + c]) / 16;
    }
  };
  const at = (ri, rj) => (Math.min(RZ - 1, Math.max(0, rj)) * RX + Math.min(RX - 1, Math.max(0, ri))) * 3;
  const half = thickness / 2;
  function update(particles) {
    for (let j = 0; j < nz; j++) refine(particles, i => (j * nx + i) * 3, nx, rows, i => (j * RX + i) * 3);
    for (let ri = 0; ri < RX; ri++) refine(rows, j => (j * RX + ri) * 3, nz, centre, j => (j * RX + ri) * 3);
    const P = centre;
    for (let rj = 0; rj < RZ; rj++) for (let ri = 0; ri < RX; ri++) {
      const k = (rj * RX + ri) * 3;
      const l = at(ri - 1, rj), r = at(ri + 1, rj), d = at(ri, rj - 1), u = at(ri, rj + 1);
      const ax = P[r] - P[l], ay = P[r + 1] - P[l + 1], az = P[r + 2] - P[l + 2];
      const bx = P[u] - P[d], by = P[u + 1] - P[d + 1], bz = P[u + 2] - P[d + 2];
      let x = by * az - bz * ay, y = bz * ax - bx * az, z = bx * ay - by * ax;
      const len = Math.hypot(x, y, z) || 1;
      x /= len; y /= len; z /= len;
      normal[k] = x; normal[k + 1] = y; normal[k + 2] = z;
      backNormal[k] = -x; backNormal[k + 1] = -y; backNormal[k + 2] = -z;
      front[k] = P[k] + x * half; front[k + 1] = P[k + 1] + y * half; front[k + 2] = P[k + 2] + z * half;
      back[k] = P[k] - x * half; back[k + 1] = P[k + 1] - y * half; back[k + 2] = P[k + 2] - z * half;
      // Folds: the cloth around, three points out, standing above this one.
      const W = at(ri - 3, rj), E = at(ri + 3, rj), S = at(ri, rj - 3), N = at(ri, rj + 3);
      const lx = (P[W] + P[E] + P[S] + P[N]) / 4 - P[k], ly = (P[W + 1] + P[E + 1] + P[S + 1] + P[N + 1]) / 4 - P[k + 1], lz = (P[W + 2] + P[E + 2] + P[S + 2] + P[N + 2]) / 4 - P[k + 2];
      const valley = Math.max(0, lx * x + ly * y + lz * z);
      const shade = 1 - Math.min(.5, valley * 6.5);
      ao[k] = shade; ao[k + 1] = shade * .985; ao[k + 2] = shade * .96;
    }
    for (let e = 0; e < L; e++) {
      const k = loop[e] * 3, o = e * 6;
      rimPosition[o] = front[k]; rimPosition[o + 1] = front[k + 1]; rimPosition[o + 2] = front[k + 2];
      rimPosition[o + 3] = back[k]; rimPosition[o + 4] = back[k + 1]; rimPosition[o + 5] = back[k + 2];
    }
    for (const g of [face, lining]) { g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true; }
    colour.needsUpdate = true;
    rim.attributes.position.needsUpdate = true;
    rim.computeVertexNormals();
    face.computeBoundingSphere(); lining.computeBoundingSphere(); rim.computeBoundingSphere();
  }
  return { face, lining, rim, update };
}


export function createUnveil(section, { onProgress } = {}) {
  const stage = section.querySelector('[data-unveil-stage]');
  const canvas = stage.querySelector('canvas');
  const phone = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
  // Large screens draw through the composer (multisampled there), so the
  // canvas itself needs none; phones draw straight to a multisampled canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: phone, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.setClearColor('#040405', 1);
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040405');
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .32;
  const backdrop = cove();
  scene.add(backdrop);
  scene.add(new THREE.HemisphereLight('#fff4e2', '#120d08', .18));
  // The softboxes: one broad and warm overhead that travels along the car as
  // it is revealed, a cool strip to the left, a warm kicker behind.
  const softbox = (color, power, width, height, position, target = [0, .6, 0]) => {
    const light = new THREE.RectAreaLight(color, power, width, height);
    light.position.set(...position); light.lookAt(...target); scene.add(light);
    return light;
  };
  const key = softbox('#fff1dc', 4.2, 7, 2.6, [1.2, 5.2, 2.6]);
  softbox('#dfe7ff', 1.3, 2.2, 6, [-6, 2.6, 1.5]);
  softbox('#ffd9a0', 1.6, 6, 1.6, [0, 2.4, -7.5], [0, .6, 0]);

  const textureSize = { w: 512, h: 512 };
  const floor = phone ? new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#050506', roughness: .32, metalness: .2 })) : studioFloor(60, textureSize);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(27, 1, .5, 80);
  // The frame: rendered linear into a 4× multisampled half-float target,
  // tone-mapped and encoded (OutputPass), then sharpened.
  let composer = null, sharpen = null;
  if (!phone) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    sharpen = new ShaderPass(SHARPEN);
    composer.addPass(sharpen);
  }
  const render = () => composer ? composer.render() : renderer.render(scene, camera);
  const shots = {
    desktop: { from: { at: [8.6, 1.8, 10.2], look: [-.5, .5, .1] }, to: { at: [7.4, 1.32, 9.1], look: [-.45, .6, 0] }, shift: [-.21, .03] },
    // A tall, narrow frame needs a wider lens to hold the car's length.
    portrait: { fov: 44, from: { at: [8.8, 3.1, 11.8], look: [0, .25, .2] }, to: { at: [7.9, 2.5, 10.8], look: [0, .38, 0] }, shift: [0, -.2] },
  };

  const density = createRenderDensity({ mobile: phone });
  let size = { w: 1, h: 1 }, ratio = 1;
  const state = { progress: 0, pull: 0, ready: false, active: false, disposed: false, cloth: true };
  let car = null, cloth = null, coverGroup = null, surface = null, hem = [], hemRest = null, hand = new THREE.Vector3(), handTarget = new THREE.Vector3();
  const hemCurve = new THREE.CatmullRomCurve3(HEM_PATH.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  let raf = 0, last = performance.now(), accumulator = 0, quiet = 0, dirty = true;

  function layout() {
    size = { w: stage.clientWidth || innerWidth, h: stage.clientHeight || innerHeight };
    ratio = density.ratio(size.w, size.h);
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    if (composer) {
      composer.setPixelRatio(ratio);
      composer.setSize(size.w, size.h);
      sharpen.uniforms.uTexel.value.set(1 / (size.w * ratio), 1 / (size.h * ratio));
    }
    camera.aspect = size.w / size.h;
    // The reflection at half the frame's pixels: it is blurred anyway.
    if (floor.isReflector) {
      const w = Math.round(size.w * ratio / 2), h = Math.round(size.h * ratio / 2);
      floor.getRenderTarget().setSize(w, h);
      floor.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    }
    frame();
    dirty = true;
    wake();
  }
  const look = new THREE.Vector3(), eye = new THREE.Vector3();
  function frame() {
    const shot = shots[STACKED.matches ? 'portrait' : 'desktop'];
    const t = gsap.parseEase('power2.inOut')(gsap.utils.clamp(0, 1, state.progress / .9));
    eye.fromArray(shot.from.at).lerp(new THREE.Vector3(...shot.to.at), t);
    look.fromArray(shot.from.look).lerp(new THREE.Vector3(...shot.to.look), t);
    camera.position.copy(eye);
    camera.lookAt(look);
    camera.fov = shot.fov ?? 27;
    // The car stands clear of the words: right of them, or below them.
    camera.setViewOffset(size.w, size.h, shot.shift[0] * size.w, shot.shift[1] * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
    // The overhead softbox runs nose to tail as the cover leaves.
    key.position.set(1.2 - state.pull * 2.4, 5.2, 2.6 - state.pull * 5.2);
    key.lookAt(0, .6, -state.pull * 1.2);
    key.intensity = 4.2 + state.pull * 1.4;
    backdrop.material.uniforms.uGlow.value = .55 + state.pull * .45;
    if (floor.isReflector) floor.material.uniforms.uGlow.value = backdrop.material.uniforms.uGlow.value;
  }

  // The hem's hand follows the scroll along its path, never jumping: at a
  // person's unhurried pace (about three metres a second) while the cover is
  // on the car, quicker once it is clear and being whisked away. `along` is
  // how far along the path it is.
  let along = 0;
  const pathLength = hemCurve.getLength();
  function moveHand(dt) {
    if (!hemRest) return;
    const lift = hand.y - hemRest.y, reach = (3.2 + Math.max(0, lift - 3) * 1.4) * dt / pathLength;
    along += gsap.utils.clamp(-reach, reach, gsap.utils.clamp(0, 1, state.pull) - along);
    hemCurve.getPointAt(along, hand).add(hemRest);
    hem.forEach(({ particle, offset, target }) => {
      // The hand gathers the hem as it lifts.
      const gather = 1 - Math.min(1, hand.y - hemRest.y) * .45;
      target[0] = hand.x + offset * gather; target[1] = hand.y; target[2] = hand.z;
      cloth.pin(particle, target);
    });
  }

  // The pull is filmed as it happens: a frame each 1/128 of the hand's path.
  // Scrolling back plays the film in reverse, the cloth (still simulated, so
  // it moves as cloth) drawn through the frames it passed through, and the
  // cover comes back to lie on the car exactly as it lay. Once the hand
  // stops part-way back, the film lets go and the cloth falls as it will.
  // Scrolling forward again simulates afresh, and films over the old pass.
  const TAKES = 128;
  const film = [];
  let filmed = -1, guide = 0;
  function record(to) {
    for (let b = Math.max(0, filmed + 1); b <= to; b++) (film[b] ||= new Float32Array(cloth.position.length)).set(cloth.position);
    filmed = Math.max(filmed, to);
  }
  function follow(share) {
    const f = Math.min(along * TAKES, filmed), b = Math.floor(f), t = f - b;
    const a = film[b], c = film[Math.min(b + 1, filmed)], p = cloth.position, w = cloth.weight;
    for (let i = 0, k = 0; i < cloth.count; i++, k += 3) {
      if (!w[i]) continue;
      p[k] += (a[k] + (c[k] - a[k]) * t - p[k]) * share;
      p[k + 1] += (a[k + 1] + (c[k + 1] - a[k + 1]) * t - p[k + 1]) * share;
      p[k + 2] += (a[k + 2] + (c[k + 2] - a[k + 2]) * t - p[k + 2]) * share;
    }
  }

  // Off screen once every particle is above or beside the frame: then the
  // cover is put away and the simulation rests.
  const frustum = new THREE.Frustum(), probe = new THREE.Sphere(), matrix = new THREE.Matrix4();
  function coverInView() {
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    const p = cloth.position;
    for (let k = 0; k < p.length; k += 9) { probe.center.set(p[k], p[k + 1], p[k + 2]); probe.radius = .2; if (frustum.intersectsSphere(probe)) return true; }
    return false;
  }

  function simulate(dt) {
    accumulator = Math.min(accumulator + dt, STEP * 3);
    while (accumulator >= STEP) {
      const before = along;
      moveHand(STEP);
      if (along > before) {
        // Forward: filmed from where the hand is now. The first frame is the
        // cover as it lay before it was touched, and is kept.
        guide = 0;
        if (!before && !film[0]) record(0);
        filmed = Math.min(filmed, Math.floor(before * TAKES));
        cloth.step(STEP);
        record(Math.floor(along * TAKES));
      } else {
        // Back: led through the film. Held still part-way, the lead fades;
        // home again, it holds until the cover lies as it first lay.
        if (along < before) guide = 1;
        else if (along > 0) guide *= .97;
        cloth.step(STEP);
        if (guide > .01 && filmed >= 0) follow(guide * .16);
      }
      accumulator -= STEP;
    }
    surface.update(cloth.position);
  }
  // The cloth rests once the hand has stopped and the sheet, on average, has
  // moved less than two centimetres a second (slower than the eye follows on
  // a sheet this size) for half a second: no simulating, no drawing.
  const REST = .02;
  function settling() {
    if (!hemRest) return false;
    const goal = gsap.utils.clamp(0, 1, state.pull);
    hemCurve.getPointAt(goal, handTarget).add(hemRest);
    if (Math.abs(goal - along) > 1e-6 || cloth.motion > REST) quiet = 0;
    else quiet++;
    return quiet < 60;
  }

  function draw(now) {
    raf = 0;
    if (state.disposed || !state.ready) return;
    // A frame's timestamp can fall a little before the moment it was asked
    // for: never a negative step.
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (density.slow(now) && density.step(size.w, size.h)) layout();
    frame();
    let changed = dirty, moving = false;
    dirty = false;
    if (state.cloth) {
      moving = settling();
      if (moving) { simulate(dt); changed = true; }
      // Carried clear of the frame: put away, and no longer simulated.
      if (along >= .999 && !coverInView()) { state.cloth = false; coverGroup.visible = false; changed = true; moving = false; }
    } else if (state.pull < .999) { state.cloth = true; coverGroup.visible = true; quiet = 0; changed = true; moving = true; }
    if (changed) render();
    if (moving && state.active && !document.hidden) raf = requestAnimationFrame(draw);
  }
  function wake() {
    if (raf || !state.active || !state.ready || state.disposed || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------- loading
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  async function load() {
    const item = showcase.find(entry => entry.id === CAR);
    const spec = { ...models[CAR], partMap: vehicleParts[CAR] };
    const logo = new Image();
    logo.src = '/brand/baba-luxury-car-800.webp';
    const [loaded, shadowTexture] = await Promise.all([
      loadCar(spec, item.paint, { invalidate: () => {}, onProgress: value => onProgress?.(value * .8) }),
      new THREE.TextureLoader().loadAsync(spec.shadow),
      logo.decode().catch(() => {}),
    ]);
    if (state.disposed) return;
    car = loaded;
    car.setCabinLight(.35);
    car.root.traverse(node => { if (node.isRectAreaLight) node.visible = false; });
    // Every texture on the car filtered at the GPU's full anisotropy: the
    // tyres' lettering, the interior's stitching and the grille stay crisp at
    // the grazing angles they are seen at.
    car.root.traverse(node => {
      if (!node.isMesh) return;
      [node.material].flat().forEach(material => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'clearcoatNormalMap'].forEach(slot => {
        const texture = material[slot];
        if (texture && texture.anisotropy !== maxAnisotropy) { texture.anisotropy = maxAnisotropy; texture.needsUpdate = true; }
      }));
    });
    // Soft contact shadow, baked for this car.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: shadowTexture, transparent: true, opacity: .8, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .006; shadow.renderOrder = 1;

    // The car's top, for the cover to lie on.
    const domain = { x0: -SHEET.width / 2 - .3, x1: SHEET.width / 2 + .3, z0: -SHEET.length / 2 - .3, z1: SHEET.length / 2 + .3 };
    const field = bakeHeight(renderer, car.root, domain, phone ? { cols: 160, rows: 200 } : {});
    scene.add(car.root, shadow);

    // The cover, dropped flat over the car and left to fall.
    const grid = phone ? { nx: 40, nz: 54 } : { nx: 58, nz: 78 };
    cloth = createCloth({ ...grid, ...SHEET, height: field.top + .12 });
    // Not quite flat as it is thrown: the silk finds its own folds.
    for (let k = 1; k < cloth.position.length; k += 3) cloth.position[k] += Math.random() * .06;
    cloth.previous.set(cloth.position);
    cloth.field = field;
    cloth.iterations = phone ? 5 : 6;
    // A satin of some body: about seven millimetres from face to lining.
    surface = coverSurface(grid.nx, grid.nz, .007);
    const painted = paintCover(logo.naturalWidth ? logo : null);
    const map = new THREE.CanvasTexture(painted.color); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = maxAnisotropy;
    const finish = new THREE.CanvasTexture(painted.finish); finish.anisotropy = maxAnisotropy;
    const weave = satinWeave();
    weave.repeat.set(72, 98);
    weave.anisotropy = maxAnisotropy;
    // The face: satin's long floats make it glossy, its highlight drawn out
    // along the weave (anisotropy), with a soft sheen at grazing angles.
    const silk = new THREE.MeshPhysicalMaterial({
      map, roughnessMap: finish, metalnessMap: finish, roughness: .58, metalness: 1, vertexColors: true,
      anisotropy: .75, anisotropyRotation: Math.PI / 2, normalMap: weave, normalScale: new THREE.Vector2(.14, .14),
      sheen: .7, sheenRoughness: .32, sheenColor: new THREE.Color('#fff0d2'), specularIntensity: 1, specularColor: new THREE.Color('#fff6e8'),
    });
    // Lined in champagne satin, so a turned-back fold reads as silk, not a hole.
    const liningSatin = new THREE.MeshPhysicalMaterial({
      color: '#a08a66', roughness: .34, vertexColors: true, anisotropy: .6, anisotropyRotation: Math.PI / 2,
      normalMap: weave, normalScale: new THREE.Vector2(.12, .12), sheen: .8, sheenRoughness: .35, sheenColor: new THREE.Color('#ead0a0'),
    });
    const hemEdge = new THREE.MeshStandardMaterial({ color: '#d6c9b1', roughness: .55, side: THREE.DoubleSide });
    coverGroup = new THREE.Group();
    coverGroup.add(new THREE.Mesh(surface.face, silk), new THREE.Mesh(surface.lining, liningSatin), new THREE.Mesh(surface.rim, hemEdge));
    coverGroup.children.forEach(mesh => { mesh.frustumCulled = false; });
    scene.add(coverGroup);
    onProgress?.(.85);
    // Settle: a few seconds of falling, a little each frame, the air thick at
    // first so it comes to rest before it is shown, then as it really is.
    // A few steps to a frame, never more than most of one, so the page
    // scrolls and the words arrive while it falls.
    const iterations = cloth.iterations, damping = cloth.damping;
    cloth.iterations = 5;
    let slice = performance.now();
    for (let s = 0; s < (phone ? 360 : 420); s++) {
      cloth.damping = s < 300 ? .975 : damping;
      cloth.step(STEP);
      if (performance.now() - slice > 11) { onProgress?.(.85 + .12 * s / 420); await nextFrame(); if (state.disposed) return; slice = performance.now(); }
    }
    cloth.iterations = iterations;
    cloth.damping = damping;
    // The hand takes the middle third of the back hem, where it lies.
    const { nx } = cloth, from = Math.round(nx * .32), to = Math.round(nx * .68);
    const rest = new THREE.Vector3();
    hem = [];
    for (let i = from; i <= to; i++) {
      const particle = cloth.id(i, 0), k = particle * 3;
      rest.x += cloth.position[k]; rest.y += cloth.position[k + 1]; rest.z += cloth.position[k + 2];
      hem.push({ particle, offset: cloth.position[k], target: [0, 0, 0] });
    }
    rest.divideScalar(hem.length);
    hem.forEach(h => { h.offset -= rest.x; });
    hemRest = rest;
    hand.copy(rest);
    cloth.tether(hem.map(h => h.particle));
    simulate(0);
    layout();
    await compileAhead(renderer, scene, camera);
    if (state.disposed) return;
    onProgress?.(1);
    state.ready = true;
    section.classList.add('is-ready');
    wake();
  }

  // ------------------------------------------------------------- scroll
  const pinned = ScrollTrigger.create({
    trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * (STACKED.matches ? 1.4 : 1.9))}`,
    // Measured first: it is the top of the page, and it loads after the
    // pins below it are made (about-page.js).
    pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 2,
    onUpdate: self => {
      state.progress = self.progress;
      state.pull = gsap.utils.clamp(0, 1, (self.progress - .05) / .72);
      section.style.setProperty('--unveil', state.progress.toFixed(4));
      dirty = true;
      wake();
    },
  });
  const visibility = ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: () => pinned.end + innerHeight, refreshPriority: 2,
    onToggle: self => { state.active = self.isActive; wake(); },
  });
  state.active = true;

  const resizer = new ResizeObserver(() => layout());
  resizer.observe(stage);
  const onVisible = () => wake();
  document.addEventListener('visibilitychange', onVisible);
  layout();
  const loaded = load().catch(error => { console.error('The unveiling is unavailable; keeping the still.', error); section.classList.add('is-static'); });
  if (import.meta.env.DEV) window.__unveil = { state, hand, cloth: () => cloth, snapshot: () => ({ ...state, motion: cloth ? +cloth.motion.toFixed(4) : null, quiet, sleeping: !raf, along: +along.toFixed(4), guide: +guide.toFixed(3), filmed, hand: hand.toArray().map(v => +v.toFixed(3)), target: handTarget.toArray().map(v => +v.toFixed(3)) }) };

  return {
    loaded,
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(raf);
      pinned.kill(true); visibility.kill();
      resizer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      scene.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(m => { if (!m) return; Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); }); });
      environment.dispose();
      renderer.dispose();
    },
  };
}
