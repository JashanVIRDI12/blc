// The one-to-one, as a sculpture: "1:1" cast in gold, standing in the dark
// studio of the About page's unveiling (studio-stage.js). Each figure is the
// "1" of Newsreader, the site's display face (glyphs.js), extruded and
// bevelled: polished champagne gold on its faces, a deeper gold on its
// sides. The colon is two gold spheres.
//
// `update(p)` sets the whole scene from one number, so the scroll can drive
// it and drive it back: the two figures stand far apart, turned away from
// each other, each in its own beam of light ("You" and "Us" on the floor
// before them); they turn to the visitor and come together as a softbox
// passes across their faces; the colon rises between them and rings, gold
// ripples running out across the floor as a call does while it connects;
// then it holds a warm glow, the beams go down and the room comes up.
// Under a fine pointer the sculpture leans a little towards it.
import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ONE } from './glyphs.js';
import { glossFloor, mirrorMaterial, cove } from './studio-stage.js';
import { createRenderDensity } from './render-density.js';

const HEIGHT = 1.6; // metres, the figure's height
const clamp01 = value => Math.min(1, Math.max(0, value));
const span = (p, from, to) => clamp01((p - from) / (to - from));
const smooth = t => t * t * (3 - 2 * t);
const inOut = gsap.parseEase('power3.inOut');

// The figure, from the glyph's outline: centred on its stem, standing on y=0.
function figureGeometry() {
  const s = HEIGHT / (ONE.bounds[3] - ONE.bounds[1]), cx = (ONE.stem[0] + ONE.stem[1]) / 2;
  const shape = new THREE.Shape();
  for (const [cmd, ...v] of ONE.path) {
    const pts = v.map((n, i) => i % 2 ? n * s : (n - cx) * s);
    if (cmd === 'M') shape.moveTo(pts[0], pts[1]);
    else if (cmd === 'L') shape.lineTo(pts[0], pts[1]);
    else if (cmd === 'Q') shape.quadraticCurveTo(pts[0], pts[1], pts[2], pts[3]);
  }
  const depth = .17;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .014, bevelSize: .007, bevelSegments: 5, curveSegments: 6 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

// A beam from the rig above: a soft cone of light, brightest at its foot.
function beam() {
  const geometry = new THREE.CylinderGeometry(.08, .95, 4.4, 48, 1, true);
  geometry.translate(0, 2.2, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = position.y / 4.4; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uOpacity; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 3.0);
        float fall = pow(1.0 - vH, 2.2) * smoothstep(1.0, .55, vH);
        gl_FragColor = vec4(vec3(1.0, .82, .55) * edge * fall * .085 * uOpacity, 1.0);
      }`,
  });
  return new THREE.Mesh(geometry, material);
}

// A ripple on the floor.
function ripple() {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 128), new THREE.MeshBasicMaterial({ color: '#f2bf5e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = .006;
  return mesh;
}

export function createConsultStage(section, { stacked = () => false } = {}) {
  const stage = section.querySelector('[data-consult-stage]');
  const canvas = stage.querySelector('canvas');
  const labels = { you: stage.querySelector('[data-who="you"]'), us: stage.querySelector('[data-who="us"]') };
  const phone = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor('#040405', 1);
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040405');
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .62;
  const backdrop = cove();
  scene.add(backdrop);
  scene.add(new THREE.HemisphereLight('#fff4e2', '#120d08', .12));
  const softbox = (color, power, width, height, position) => {
    const light = new THREE.RectAreaLight(color, power, width, height);
    light.position.set(...position); light.lookAt(0, .8, 0); scene.add(light);
    return light;
  };
  // The one that passes across the faces as they turn.
  const sweep = softbox('#fff3e0', 5, 1.6, 4.4, [-5, 2.2, 4.6]);
  softbox('#ffd9a0', 2.2, 7, 1.4, [0, 2.6, -5]);
  softbox('#e6ecff', .9, 2, 5, [6, 2.4, 2.5]);
  const floor = glossFloor(60);
  scene.add(floor);

  // The sculpture.
  const face = new THREE.MeshPhysicalMaterial({ color: '#f5d9a2', metalness: 1, roughness: .14, clearcoat: .4, clearcoatRoughness: .08 });
  const side = new THREE.MeshPhysicalMaterial({ color: '#d4974a', metalness: 1, roughness: .26 });
  const geometry = figureGeometry();
  const sculpture = new THREE.Group();
  const figures = [0, 1].map(() => { const mesh = new THREE.Mesh(geometry, [face, side]); sculpture.add(mesh); return mesh; });
  const dotMaterial = new THREE.MeshPhysicalMaterial({ color: '#f2c97a', metalness: 1, roughness: .16, emissive: new THREE.Color('#ffb84d'), emissiveIntensity: 0 });
  const dots = [.34, .9].map(y => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(.078, 48, 32), dotMaterial); mesh.userData.y = y; sculpture.add(mesh); return mesh; });
  // The reflection: the sculpture again, mirrored under the stone.
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  const mirrorFace = mirrorMaterial(face), mirrorSide = mirrorMaterial(side), mirrorDot = mirrorMaterial(dotMaterial, { strength: .4 });
  const mirrored = [...figures.map(f => new THREE.Mesh(geometry, [mirrorFace, mirrorSide])), ...dots.map(d => new THREE.Mesh(d.geometry, mirrorDot))];
  mirrored.forEach(m => { m.renderOrder = 1; mirror.add(m); });
  scene.add(mirror);
  const glow = new THREE.PointLight('#ffb655', 0, 3.2, 2);
  glow.position.set(0, .62, .35);
  sculpture.add(glow);
  scene.add(sculpture);
  const beams = [beam(), beam()];
  beams.forEach(b => scene.add(b));
  const ripples = [ripple(), ripple(), ripple()];
  ripples.forEach(r => sculpture.add(r));

  const camera = new THREE.PerspectiveCamera(30, 1, .5, 80);
  const density = createRenderDensity({ mobile: phone });
  let size = { w: 1, h: 1 }, ratio = 1, raf = 0, active = false, disposed = false, progress = 0, compiled = false;
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  // Where things stand, by layout: beside the words (desktop) or above them.
  const plan = () => stacked()
    ? { centre: 0, apart: 1.2, look: [0, .74, 0], eye: [0, 1.25, 6.5], fov: 36 }
    : { centre: -1.62, apart: 1.3, look: [0, .62, 0], eye: [0, 1.3, 8.6], fov: 30 };

  function layout() {
    size = { w: stage.clientWidth || innerWidth, h: stage.clientHeight || innerHeight };
    ratio = density.ratio(size.w, size.h);
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    invalidate();
  }

  const v = new THREE.Vector3();
  function pose(p) {
    const { centre, apart, look, eye, fov } = plan();
    // Apart and turned away, then together and facing; a little back to
    // front as they come.
    const meet = inOut(span(p, .04, .52));
    const gap = .66 + (apart - .66) * (1 - meet);
    figures[0].position.set(-gap - .06, 0, -.9 * (1 - meet));
    figures[1].position.set(gap, 0, -.9 * (1 - meet));
    figures[0].rotation.y = 1.25 * (1 - meet);
    figures[1].rotation.y = -1.25 * (1 - meet);
    sculpture.position.x = centre;
    sculpture.rotation.y = lean.x * .12;
    sculpture.rotation.x = lean.y * .03;
    // The softbox crosses the faces as they turn.
    sweep.position.set(-5 + 10 * span(p, .08, .6), 2.2, 4.6);
    sweep.lookAt(centre, .8, 0);
    // The colon rises, then rings, then glows.
    const rise = smooth(span(p, .32, .5));
    dots.forEach((dot, i) => { dot.position.set(-.04, dot.userData.y - .5 * (1 - rise), 0); dot.scale.setScalar(Math.max(.001, rise)); dot.visible = rise > 0; });
    const ring = span(p, .44, .7);
    ripples.forEach((r, i) => {
      const t = clamp01(ring * 1.6 - i * .3);
      r.position.set(-.04, .006, .05);
      r.scale.setScalar(.2 + t * 3.4);
      r.material.opacity = t > 0 && t < 1 ? (1 - t) * .75 : 0;
    });
    const connected = smooth(span(p, .62, .74));
    const pulse = ring > 0 && ring < 1 ? (Math.sin(ring * Math.PI * 6) * .5 + .5) : 0;
    dotMaterial.emissiveIntensity = connected * .9 + pulse * .6;
    glow.intensity = connected * 2.2 + pulse * 1.2;
    // The beams go down as the room comes up.
    const lit = smooth(span(p, 0, .1)) * (1 - smooth(span(p, .62, .78)));
    beams.forEach((b, i) => { b.position.set(centre + figures[i].position.x, 0, figures[i].position.z); b.material.uniforms.uOpacity.value = lit; b.visible = lit > .005; });
    backdrop.material.uniforms.uGlow.value = .3 + .7 * connected;
    floor.material.uniforms.uGlow.value = backdrop.material.uniforms.uGlow.value;
    floor.material.uniforms.uPool.value = connected;
    floor.material.uniforms.uPoolAt.value.set(centre, .1);
    // The reflection follows the sculpture.
    mirror.position.x = sculpture.position.x;
    mirror.rotation.copy(sculpture.rotation);
    mirror.rotation.x = -sculpture.rotation.x;
    [...figures, ...dots].forEach((m, i) => { mirrored[i].position.copy(m.position); mirrored[i].rotation.copy(m.rotation); mirrored[i].scale.copy(m.scale); mirrored[i].visible = m.visible; });
    camera.fov = fov;
    camera.position.set(eye[0] + lean.x * .25, eye[1] + (1 - meet) * .25, eye[2] + (1 - meet) * .9);
    camera.lookAt(look[0], look[1], look[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // "You" and "Us" on the floor before each figure, while they are apart.
    const name = 1 - smooth(span(p, .3, .44));
    [labels.you, labels.us].forEach((label, i) => {
      if (!label) return;
      v.set(centre + figures[i].position.x, -.02, figures[i].position.z + .55).project(camera);
      label.style.transform = `translate(${((v.x + 1) / 2 * size.w).toFixed(1)}px, ${((1 - v.y) / 2 * size.h).toFixed(1)}px) translate(-50%, 0)`;
      label.style.opacity = name.toFixed(3);
    });
  }

  function draw(now) {
    raf = 0;
    if (!active || disposed) return;
    if (density.slow(now) && density.step(size.w, size.h)) layout();
    lean.x += (lean.tx - lean.x) * .06; lean.y += (lean.ty - lean.y) * .06;
    pose(progress);
    renderer.render(scene, camera);
    // Keep drawing while the sculpture settles under the pointer, or glows.
    if (Math.abs(lean.tx - lean.x) > .001 || Math.abs(lean.ty - lean.y) > .001) invalidate();
  }
  function invalidate() { if (!raf && active && !disposed && !document.hidden) raf = requestAnimationFrame(draw); }

  const onPointer = event => {
    const rect = stage.getBoundingClientRect();
    lean.tx = ((event.clientX - rect.left) / rect.width - .5) * 2;
    lean.ty = ((event.clientY - rect.top) / rect.height - .5) * 2;
    invalidate();
  };
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) section.addEventListener('pointermove', onPointer);
  const resizer = new ResizeObserver(() => layout());
  resizer.observe(stage);
  const watcher = new IntersectionObserver(entries => { active = entries.at(-1).isIntersecting; invalidate(); }, { rootMargin: '200px 0px' });
  watcher.observe(stage);
  layout();
  pose(0);
  const ready = renderer.compileAsync(scene, camera).then(() => { compiled = true; section.classList.add('is-cast'); invalidate(); });

  if (import.meta.env.DEV) window.__consult = { state: () => ({ progress, active, compiled }) };
  return {
    ready,
    update(p) { progress = p; invalidate(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', onPointer);
      resizer.disconnect(); watcher.disconnect();
      scene.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(m => m?.dispose()); });
      environment.dispose(); renderer.dispose();
    },
  };
}
