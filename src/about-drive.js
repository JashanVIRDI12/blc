import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { showcase, aboutVehicles } from './config.js';
import { createCameraPath } from './camera-path.js';
import { createVehicleJourney, interval } from './motion.js';
import { aboutJourneys, aboutCamera, aboutCopy, aboutAnchor, aboutTurn, aboutTurnWeight } from './about-storyboard.js';
import { carCorners, fitFrame, frameCamera, freeRegion, screenBounds } from './about-framing.js';
import { createTurnGesture } from './turn-gesture.js';
import { createTextReveal } from './text-reveal.js';
import { createRenderDensity } from './render-density.js';
gsap.registerPlugin(ScrollTrigger);

const PINNED = 2.8; // viewport heights the section stays pinned
// Phones and other tall, narrow screens stack the copy above the cars (see
// editorial.css).
const STACKED = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
const easeOut = t => 1 - (1 - t) ** 3;
const smooth = t => t * t * (3 - 2 * t);

// Baba's introduction on a white stage. The section pins while the GLS 580
// and the Defender drive in, stop for the copy and drive away; the scroll position
// is the only clock, so reversing replays it exactly. The two models load in
// the background and the stills stand in until they arrive. Throws when
// WebGL is unavailable; the section then keeps its static layout.
export function createAboutDrive(section) {
  const visual = section.querySelector('.brand-visual');
  const canvas = visual.querySelector('canvas');
  const copy = section.querySelector('.brand-copy');
  const header = document.querySelector('.site-header');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .86;
  renderer.setClearColor('#ffffff', 1);
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
  section.classList.add('is-drive');

  // A seamless white studio: no floor or horizon, only soft contact shadows.
  // Linear fog to white lets the cars arrive out of the distance.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  scene.fog = new THREE.Fog('#ffffff', 28, 46);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = .5;
  scene.add(new THREE.HemisphereLight('#ffffff', '#b3ac9f', .7));
  const softbox = (color, power, width, height, position) => {
    const light = new THREE.RectAreaLight(color, power, width, height);
    light.position.set(...position); light.lookAt(.4, .8, -.4); scene.add(light);
  };
  softbox('#fff7ea', 2.6, 8, 10, [-2, 7.5, 5]);
  softbox('#e9efff', 1.6, 7, 7, [-8, 4, 6]);
  softbox('#ffffff', 1.4, 9, 4, [5, 3.5, -8]);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 200);

  const ids = Object.values(aboutVehicles);
  const travel = Object.fromEntries(ids.map(id => [id, createVehicleJourney(aboutJourneys[id], vehicleParts[id].wheelbase)]));
  const paths = Object.fromEntries(Object.entries(aboutCamera).map(([name, view]) => [name, createCameraPath(view.frames)]));
  // The headline and the introduction read as one passage: every word waits
  // as a ghost and fills in to full ink as the scroll moves on (text-reveal.js).
  // The link and sign-off follow once the passage is set.
  const passage = createTextReveal([copy.querySelector('h2'), copy.querySelector('.brand-description')]);
  const trailing = [...copy.querySelectorAll('.editorial-link, .brand-signoff')];
  const vehicles = new Map(), textures = [];
  const playhead = { progress: 0 };
  let size = { w: 1, h: 1 }, view = 'desktop', fit = { zoom: 1, offset: [0, 0] };
  let active = false, ready = false, rendered = false, disposed = false, dirty = true, raf = 0;
  // One density, moving or still, so the cars never soften while scrolling
  // (render-density.js: native up to 2x, desktop supersampled towards 2x).
  // A device that cannot keep up steps its density down for good: once, not
  // back and forth.
  const density = createRenderDensity({ mobile: innerWidth <= 760 });
  let ratio = density.ratio(innerWidth, innerHeight);

  function invalidate() { dirty = true; if (!raf && active && ready && !disposed && !document.hidden) raf = requestAnimationFrame(draw); }
  function draw(now) {
    raf = 0;
    if (!dirty || !active || !ready || disposed) return;
    dirty = false;
    if (density.slow(now) && density.step(size.w, size.h)) { ratio = density.ratio(size.w, size.h); applySize(); }
    renderer.render(scene, camera);
    if (!rendered) { rendered = true; visual.classList.add('is-rendered'); }
  }
  function applySize() { renderer.setPixelRatio(ratio); renderer.setSize(size.w, size.h, false); }

  // Fit the parked pair into the space the copy leaves: beside it on wider
  // screens, below it on phones. Measured from the laid-out copy.
  function layout() {
    if (disposed) return;
    size = { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
    view = STACKED.matches ? 'portrait' : 'desktop';
    ratio = density.ratio(size.w, size.h); applySize();
    const stage = visual.getBoundingClientRect(), text = copy.getBoundingClientRect();
    const { w, h } = size;
    const region = freeRegion(view, w, h, { left: text.left - stage.left, right: text.right - stage.left, top: text.top - stage.top, bottom: text.bottom - stage.top }, header.offsetHeight);
    const boxes = ids.map(id => carCorners(travel[id](aboutAnchor), vehicleParts[id].size));
    fit = fitFrame({ shot: paths[view](aboutAnchor), width: w, height: h, region, boxes });
    // The turning hint sits under the parked cars.
    if (hint) hint.style.left = `${((region.left + region.right) / 2).toFixed(1)}px`;
    [scene.fog.near, scene.fog.far] = aboutCamera[view].fog;
    render();
  }

  function reveal(p) {
    const { start, end } = aboutCopy, span = end - start;
    // The ghosts appear first, then the ink runs through the words.
    passage.set(interval(p, start + span * .1, end - span * .22), smooth(interval(p, start, start + span * .12)));
    trailing.forEach((element, i) => {
      const from = end - span * (.2 - i * .06), e = easeOut(interval(p, from, from + span * .14));
      element.style.opacity = e.toFixed(3);
      element.style.transform = `translate3d(0,${((1 - e) * 14).toFixed(2)}px,0)`;
    });
  }
  // Turning by hand: each parked car on its own spot, the one under the
  // finger, or both when the drag starts on the white.
  const turn = Object.fromEntries(ids.map(id => [id, 0]));
  const hint = section.querySelector('.turn-hint');
  const picker = new THREE.Raycaster(), pointerNdc = new THREE.Vector2();
  let turned = false;
  const turnable = () => ready && active && playhead.progress >= aboutTurn.start && playhead.progress <= aboutTurn.until;
  const gesture = createTurnGesture(canvas, {
    enabled: turnable,
    onStart(event) {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      picker.setFromCamera(pointerNdc, camera);
      const hit = picker.intersectObjects([...vehicles.values()].map(v => v.car.root), true)[0];
      const id = hit && [...vehicles].find(([, v]) => v.car.root.getObjectById(hit.object.id))?.[0];
      turned = true; render();
      return { ids: id ? [id] : ids };
    },
    onTurn(dx, { ids: which }) {
      // A full sweep across the stage turns a car half way round.
      for (const id of which) turn[id] += dx / size.w * Math.PI;
      render();
    },
    onEnd(context) {
      for (const id of context?.ids ?? ids) turn[id] = Math.atan2(Math.sin(turn[id]), Math.cos(turn[id]));
    },
  });
  // Keyboard: the arrow keys turn both cars while they are parked.
  const onKey = event => {
    if (!turnable() || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); turned = true;
    const step = (event.key === 'ArrowRight' ? 1 : -1) * Math.PI / 8;
    for (const id of ids) gsap.to(turn, { [id]: turn[id] + step, duration: .45, ease: 'power2.out', onUpdate: render });
  };
  canvas.addEventListener('keydown', onKey);

  function render() {
    if (disposed) return;
    const p = playhead.progress;
    reveal(p);
    frameCamera(camera, paths[view](p), size.w, size.h, fit);
    // Turns count only while parked; outside that window they are forgotten,
    // so the cars always arrive and leave straight.
    const weight = aboutTurnWeight(p);
    if (weight === 0 && !gesture.active) for (const id of ids) turn[id] = 0;
    const canTurn = turnable();
    canvas.classList.toggle('is-turnable', canTurn);
    hint?.classList.toggle('is-shown', canTurn && !turned);
    for (const [id, { car, holder }] of vehicles) {
      const state = travel[id](p);
      holder.position.set(...state.position);
      holder.rotation.y = state.yaw + turn[id] * weight;
      holder.visible = state.visible;
      car.applyMotion(state.distance, state.steer, state.pitch);
    }
    invalidate();
    if (import.meta.env.DEV) window.__aboutProgress = p;
  }

  // Pinned for PINNED viewport heights; the playhead covers the whole time
  // the section is on screen, from rising into view to scrolling away.
  const pin = ScrollTrigger.create({ trigger: section, start: 'top top', end: () => `+=${innerHeight * PINNED}`, pin: true, anticipatePin: 1, invalidateOnRefresh: true });
  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top bottom', end: () => `+=${innerHeight * (1 + PINNED) + section.offsetHeight}`,
      scrub: .7, invalidateOnRefresh: true,
      onToggle: self => { active = self.isActive; if (active) invalidate(); },
      onRefresh: self => { active = self.isActive; layout(); },
    },
  }).to(playhead, { progress: 1, duration: 1, ease: 'none', onUpdate: render });
  const scrollPosition = progress => { const st = timeline.scrollTrigger; return st.start + (st.end - st.start) * progress; };
  function scrollTo(progress = aboutAnchor, instant = false) {
    const smoother = ScrollSmoother.get(), y = scrollPosition(progress);
    if (smoother) smoother.scrollTo(y, !instant); else window.scrollTo({ top: y, behavior: instant ? 'instant' : 'smooth' });
  }
  // Keyboard focus inside hidden copy would land on invisible text.
  const onFocus = () => { if (playhead.progress < aboutCopy.end) scrollTo(aboutAnchor, true); };
  copy.addEventListener('focusin', onFocus);

  async function load() {
    const loader = new THREE.TextureLoader();
    await Promise.all(ids.map(async id => {
      const item = showcase.find(entry => entry.id === id);
      const spec = { ...models[id], partMap: vehicleParts[id] };
      const [car, shadowTexture] = await Promise.all([loadCar(spec, item.paint, { invalidate }), loader.loadAsync(spec.shadow)]);
      textures.push(shadowTexture);
      // Sharp at grazing angles, so the shadow never shimmers as the view moves.
      shadowTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (disposed) return;
      const holder = new THREE.Group();
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: '#3b352c', alphaMap: shadowTexture, transparent: true, opacity: .42, depthWrite: false, dithering: true }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .004; shadow.renderOrder = 1;
      holder.add(car.root, shadow);
      // The bright studio reaches the cabin through the glass, so the film's
      // cabin softboxes stay off here: two fewer area lights per car to shade.
      car.setCabinLight(.55);
      car.root.traverse(node => { if (node.isRectAreaLight) node.visible = false; });
      vehicles.set(id, { car, holder });
      scene.add(holder);
    }));
    if (disposed) return;
    render();
    await renderer.compileAsync(scene, camera);
    if (disposed) return;
    ready = true; invalidate();
  }
  const loaded = load().catch(error => { console.error('About drive unavailable; keeping the stills.', error); });

  const resizeObserver = new ResizeObserver(() => { if (!disposed) layout(); });
  resizeObserver.observe(canvas); resizeObserver.observe(copy);
  const onVisible = () => { if (!document.hidden) invalidate(); };
  document.addEventListener('visibilitychange', onVisible);
  const onLost = event => { event.preventDefault(); ready = false; visual.classList.remove('is-rendered'); };
  canvas.addEventListener('webglcontextlost', onLost);
  layout();
  if (import.meta.env.DEV) window.__about = { snapshot: () => api.snapshot(), setProgress: p => api.setProgress(p), scrollTo: p => scrollTo(p, true) };

  const api = {
    loaded,
    scrollTo,
    snapshot: () => ({
      ready, rendered, active, progress: playhead.progress, view, fit, ratio,
      background: `#${scene.background.getHexString()}`,
      vehicles: [...vehicles].map(([id, { car, holder }]) => ({ id, position: holder.position.toArray(), yaw: holder.rotation.y, wheel: car.wheels[0].rotation.x, visible: holder.visible })),
      turn: { ...turn }, turnable: turnable(),
      // Where the cars are drawn, in stage pixels.
      bounds: screenBounds(camera, ids.map(id => carCorners(travel[id](playhead.progress), vehicleParts[id].size)), size.w, size.h),
      pinned: pin.isActive,
    }),
    setProgress(p) { playhead.progress = p; render(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      gesture.dispose(); canvas.removeEventListener('keydown', onKey); gsap.killTweensOf(turn);
      pin.kill(true); timeline.scrollTrigger?.kill(); timeline.kill();
      resizeObserver.disconnect(); document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost); copy.removeEventListener('focusin', onFocus);
      passage.reset(); trailing.forEach(element => { element.style.transform = ''; element.style.opacity = ''; });
      section.classList.remove('is-drive'); visual.classList.remove('is-rendered');
      const geometries = new Set(), materials = new Set();
      scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) [o.material].flat().forEach(m => materials.add(m)); });
      materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
      environment.dispose(); renderer.dispose();
      if (import.meta.env.DEV) delete window.__about;
    },
  };
  return api;
}
