import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { showcase, fleetVehicles } from './config.js';
import { createCameraPath } from './camera-path.js';
import { createDrivePath, interval } from './motion.js';
import { fleetMarks, fleetJourneys, fleetCamera, fleetAnchor } from './fleet-storyboard.js';
import { carCorners, fitFrame, frameCamera } from './about-framing.js';
import { createRenderDensity } from './render-density.js';
import { createRoadDust } from './road-dust.js';
import { createDust } from './dust.js';
gsap.registerPlugin(ScrollTrigger);

// The studio, tuned on the five cars together.
const LIGHT = { exposure: 1.03, room: .55, environment: .95, rotation: Math.PI * 1.5, hemisphere: .35, key: .9, softboxes: 1, shadow: .58 };
const STACKED = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
const ARRIVAL = 4.6; // seconds the stage's arrival takes

// The collection drive: on a white stage, five cars drive out of the white
// towards the visitor and settle into formation, as large as the stage
// allows, seen from near their own height. The picture is only a picture:
// the cars carry no names and open nothing. Models load in the background;
// until then, and without WebGL, the section keeps its stills. Throws when
// WebGL is unavailable.
//
// At the head of the collection page the cars arrive as the
// page opens, larger, and park in front of the page's title (`.fleet-word`),
// which the canvas lets show through; they emerge from the distance by
// fading in rather than out of white, so they never veil the title. A fine
// pointer sways the camera, and the title and the dust with it, by depth.
//
// The canvas is transparent over the section's white: dust motes drift
// behind and in front of the cars (dust.js), and the tyres lift a little dust
// from the floor as the cars roll (road-dust.js).
export function createFleetDrive(section, { reduced = false, onProgress } = {}) {
  const stage = section.querySelector('.fleet-stage');
  const canvas = stage.querySelector('canvas');
  const copy = section.querySelector('.fleet-copy');
  const word = section.querySelector('.fleet-word'), wordLine = word?.querySelector('.fleet-word-main');
  const header = document.querySelector('.site-header');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Neutral tone mapping keeps paint colours true against the white page.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;
  renderer.setClearColor('#000000', 0);
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
  section.classList.add('is-drive');

  // A photographic studio: the showroom film's own captured studio light
  // (studio_small_09) for reflections, so paint and glass carry real softbox
  // highlights; a long overhead softbox and two side strips for the shape of
  // each body; soft contact shadows. The fog here only measures distance:
  // every surface fades with it towards transparency (`fadeWithDistance`),
  // over the section's white.
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#000000', 30, 66);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let environment = pmrem.fromScene(room, .04);
  room.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = LIGHT.room;
  let disposed = false;
  const studio = new EXRLoader().loadAsync('/env/studio-1k.exr').then(texture => {
    if (disposed) { texture.dispose(); return; }
    const next = pmrem.fromEquirectangular(texture);
    texture.dispose(); pmrem.dispose();
    environment.dispose(); environment = next;
    scene.environment = next.texture; scene.environmentIntensity = LIGHT.environment;
    scene.environmentRotation.y = LIGHT.rotation;
  }).catch(error => console.warn('Studio light unavailable; keeping the room.', error));
  const hemisphere = new THREE.HemisphereLight('#ffffff', '#a59c8c', LIGHT.hemisphere);
  scene.add(hemisphere);
  const softboxes = [];
  const softbox = (color, power, width, height, position, at) => {
    const light = new THREE.RectAreaLight(color, power, width, height);
    light.position.set(...position); light.lookAt(...at); scene.add(light);
    softboxes.push([light, power]);
  };
  softbox('#fff8ee', 3.2, 18, 6, [0, 9, 4], [0, 0, 0]);
  softbox('#eef3ff', 1.6, 3, 9, [-11, 3.5, 6], [0, .9, 0]);
  softbox('#fffaf2', 1.6, 3, 9, [11, 3.5, 6], [0, .9, 0]);
  const key = new THREE.DirectionalLight('#fff4e6', LIGHT.key);
  key.position.set(-6, 10, 12);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 2, 160);
  const roadDust = createRoadDust();
  scene.add(roadDust.points);
  const dust = reduced ? null : createDust(stage, { scene: canvas });

  const ids = fleetVehicles.map(entry => entry.id);
  const paths = Object.fromEntries(Object.entries(fleetCamera).map(([name, view]) => [name, createCameraPath(view.frames)]));
  const viewFor = () => STACKED.matches ? 'stage-portrait' : 'stage';
  let view = viewFor(), drives = {}, marks = {};
  const plan = () => {
    marks = fleetMarks(view);
    drives = Object.fromEntries(Object.entries(fleetJourneys(view)).map(([id, journey]) => {
      const path = createDrivePath(journey.points, vehicleParts[id].wheelbase);
      return [id, p => p < journey.end ? path.sample(interval(p, journey.start, journey.end)) : { ...path.sample(1), steer: 0, pitch: 0 }];
    }));
  };
  plan();

  const vehicles = new Map(), textures = [], shadows = [];
  const playhead = { progress: 0 };
  const sway = { x: 0, y: 0, toX: 0, toY: 0 };
  let size = { w: 1, h: 1 }, fits = { open: { zoom: 1, offset: [0, 0] }, set: { zoom: 1, offset: [0, 0] } };
  let active = true, ready = false, rendered = false, dirty = true, raf = 0, lastFrame = 0, arrival = null;
  const density = createRenderDensity({ mobile: innerWidth <= 760 });
  let ratio = density.ratio(innerWidth, innerHeight);

  function invalidate() { dirty = true; if (!raf && active && ready && !disposed && !document.hidden) raf = requestAnimationFrame(draw); }
  function draw(now) {
    raf = 0;
    if (!dirty || !active || !ready || disposed) return;
    dirty = false;
    // The stage's arrival runs on this loop's own clock, so each frame moves
    // the cars and draws them together. A slow device steps its density
    // down only between movements: a resize mid-drive is a visible hitch.
    if (arrival) {
      const t = Math.min(1, Math.max(0, (now - arrival.start) / (ARRIVAL * 1000)));
      playhead.progress = fleetAnchor * t;
      if (t >= 1) arrival = null;
      render();
    } else if (density.slow(now) && density.step(size.w, size.h)) { ratio = density.ratio(size.w, size.h); applySize(); }
    const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    const settling = roadDust.update(dt);
    roadDust.frame(camera, size.h * ratio, fleetCamera[view].fog);
    FADE.value = 1; renderer.render(scene, camera); FADE.value = 0;
    if (!rendered) { rendered = true; stage.classList.add('is-rendered'); }
    // Dust still in the air, or a camera still swaying, asks for another frame.
    if (settling || swaying()) { if (swaying()) stepSway(); invalidate(); } else lastFrame = 0;
  }
  function applySize() { renderer.setPixelRatio(ratio); renderer.setSize(size.w, size.h, false); }

  // The title's capital line, in section pixels and before the stage shift:
  // the cars hang from it, so they always cover the same share of the letters.
  const measure = document.createElement('canvas').getContext('2d');
  function capLine() {
    const style = getComputedStyle(wordLine);
    measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = measure.measureText('H');
    let top = 0;
    for (let element = wordLine; element && element !== section; element = element.offsetParent) top += element.offsetTop;
    const line = parseFloat(style.lineHeight) || wordLine.offsetHeight;
    const baseline = top + (line - (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent)) / 2 + metrics.fontBoundingBoxAscent;
    const shift = parseFloat(section.style.getPropertyValue('--stage-shift')) || 0;
    return { top: baseline - metrics.actualBoundingBoxAscent - shift, bottom: baseline - shift };
  }

  // The cars stand as large as the width allows, their roofs across the
  // lower half of the title, just above the words beneath; whatever height is
  // left over is shared above the title and above the words.
  function layout() {
    if (disposed) return;
    const wanted = viewFor();
    if (wanted !== view) { view = wanted; plan(); }
    size = { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
    ratio = density.ratio(size.w, size.h); applySize();
    const { w, h } = size;
    const portrait = STACKED.matches;
    const boxes = ids.map(id => carCorners({ position: marks[id], yaw: 0 }, vehicleParts[id].size));
    const shot = paths[view](fleetAnchor);
    {
      const cap = capLine();
      const region = {
        left: w * (portrait ? .005 : .03), right: w * (portrait ? .995 : .97),
        top: cap.top + (cap.bottom - cap.top) * (portrait ? .62 : .6),
        bottom: copy.offsetTop - (portrait ? h * .02 : Math.min(66, h * .075)),
      };
      let fit = fitFrame({ shot, width: w, height: h, region, boxes, align: 'top' });
      const shift = Math.max(0, (region.bottom - fit.bounds.bottom) / 2);
      if (shift > 1) fit = fitFrame({ shot, width: w, height: h, region: { ...region, top: region.top + shift }, boxes, align: 'top' });
      section.style.setProperty('--stage-shift', `${shift.toFixed(1)}px`);
      fits = { open: fit, set: fit };
    }
    [scene.fog.near, scene.fog.far] = fleetCamera[view].fog;
    roadDust.frame(camera, h * ratio, fleetCamera[view].fog);
    render();
  }

  // A fine pointer sways the camera a little about the group, as if
  // the visitor leaned to look; the title, further back, moves less, and the
  // dust by its depth.
  const swaying = () => Math.abs(sway.toX - sway.x) + Math.abs(sway.toY - sway.y) > 1e-4;
  function stepSway() {
    sway.x += (sway.toX - sway.x) * .07; sway.y += (sway.toY - sway.y) * .07;
    section.style.setProperty('--sway-x', sway.x.toFixed(4)); section.style.setProperty('--sway-y', sway.y.toFixed(4));
    dust?.point(sway.x, sway.y);
    render();
  }
  const leans = !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onLean = event => {
    const rect = section.getBoundingClientRect();
    sway.toX = gsap.utils.clamp(-1, 1, (event.clientX - rect.left) / rect.width * 2 - 1);
    sway.toY = gsap.utils.clamp(-1, 1, (event.clientY - rect.top) / rect.height * 2 - 1);
    invalidate();
  };
  const onRest = () => { sway.toX = sway.toY = 0; invalidate(); };
  if (leans) { section.addEventListener('pointermove', onLean); section.addEventListener('pointerleave', onRest); }

  const travelled = new Map();
  function render() {
    if (disposed) return;
    const p = playhead.progress;
    const fit = fits.set;
    const shot = paths[view](p);
    if (sway.x || sway.y) shot.position = [shot.position[0] + sway.x * .9, shot.position[1] - sway.y * .3, shot.position[2]];
    frameCamera(camera, shot, size.w, size.h, fit);
    const now = performance.now();
    for (const [id, { car, holder }] of vehicles) {
      const state = drives[id](p);
      holder.position.set(...state.position);
      holder.rotation.y = state.yaw;
      car.applyMotion(state.distance, state.steer, state.pitch);
      // Dust from the distance rolled since the last picture; a jump (a
      // resize, a skip to the end) lifts none.
      const before = travelled.get(id);
      if (before && ready) {
        const metres = state.distance - before.distance, seconds = Math.max(.008, (now - before.at) / 1000);
        if (Math.abs(metres) < 2.5) roadDust.kick(holder, metres, Math.abs(metres) / seconds, { track: vehicleParts[id].track, axle: vehicleParts[id].wheelbase / 2 });
      }
      travelled.set(id, { distance: state.distance, at: now });
    }
    invalidate();
    if (import.meta.env.DEV) window.__fleetProgress = p;
  }

  // The clock: its own, from the moment the cars are ready and the stage is
  // in view.
  let parallax = null;
  const watcher = new IntersectionObserver(([entry]) => { active = entry.isIntersecting; if (active) invalidate(); });
  watcher.observe(section);
  // As the page scrolls on, the layers part by depth: the title lags
  // furthest and pales, the cars a little.
  if (!reduced) {
    const behind = [stage.querySelector('.fleet-dust--back'), canvas].filter(Boolean);
    parallax = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } })
      .to(word, { y: () => section.offsetHeight * .22, autoAlpha: .25, ease: 'none' }, 0)
      .to(behind, { y: () => section.offsetHeight * .08, ease: 'none' }, 0)
      .to(stage.querySelector('.fleet-dust--front'), { y: () => section.offsetHeight * .02, ease: 'none' }, 0);
  }
  function arrive() {
    const inView = section.getBoundingClientRect().bottom > header.offsetHeight && section.getBoundingClientRect().top < innerHeight;
    if (reduced || !inView) { playhead.progress = fleetAnchor; render(); return; }
    arrival = { start: performance.now() + 60 };
    invalidate();
  }
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  // Everything the first frames need, a little at a time: each car's shaders,
  // then its textures, a frame apart, so nothing stalls the page in one
  // block (browsers without parallel shader compiling do it on the main
  // thread). Then two frames drawn with the cars still out in the white.
  async function warm() {
    FADE.value = 1;
    for (const { holder } of vehicles.values()) {
      await renderer.compileAsync(holder, camera, scene);
      await nextFrame();
      if (disposed) return;
      const maps = new Set();
      holder.traverse(node => [node.material].flat().forEach(material => material && Object.values(material).forEach(value => { if (value?.isTexture) maps.add(value); })));
      let n = 0;
      for (const texture of maps) { renderer.initTexture(texture); if (++n % 6 === 0) await nextFrame(); }
      await nextFrame();
      if (disposed) return;
    }
    FADE.value = 0;
  }
  function scrollTo(instant = false) { section.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' }); }

  async function load() {
    const loader = new THREE.TextureLoader();
    const shares = new Map();
    const progress = (id, share) => { shares.set(id, share); onProgress?.([...shares.values()].reduce((a, b) => a + b, 0) / fleetVehicles.length); };
    await Promise.all(fleetVehicles.map(async ({ id, paint }) => {
      const item = showcase.find(entry => entry.id === id);
      // No plates here: a dealer plate on some cars and not others reads as a mistake.
      const spec = { ...models[id], partMap: { ...vehicleParts[id], plates: [] } };
      const [car, shadowTexture] = await Promise.all([loadCar(spec, paint ?? item.paint, { invalidate, onProgress: share => progress(id, share) }), loader.loadAsync(spec.shadow)]);
      progress(id, 1);
      textures.push(shadowTexture);
      shadowTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (disposed) return;
      const holder = new THREE.Group();
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: '#2a251e', alphaMap: shadowTexture, transparent: true, opacity: LIGHT.shadow, depthWrite: false, dithering: true }));
      shadows.push(shadow.material);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .004; shadow.renderOrder = 1;
      holder.add(car.root, shadow);
      car.setCabinLight(.55);
      car.root.traverse(node => { if (node.isRectAreaLight) node.visible = false; });
      holder.traverse(node => { if (node.material) [node.material].flat().forEach(fadeWithDistance); });
      vehicles.set(id, { car, holder });
      scene.add(holder);
    }));
    if (disposed) return;
    render();
    await studio;
    await warm();
    if (disposed) return;
    ready = true; travelled.clear(); invalidate();
    await nextFrame(); await nextFrame(); if (!disposed) arrive();
  }
  const loaded = load().catch(error => { console.error('Collection drive unavailable; keeping the still.', error); section.classList.add('is-static'); });

  const resizeObserver = new ResizeObserver(() => { if (!disposed) layout(); });
  resizeObserver.observe(canvas); resizeObserver.observe(copy);
  const onVisible = () => { if (!document.hidden) invalidate(); };
  document.addEventListener('visibilitychange', onVisible);
  document.fonts?.ready.then(() => { if (!disposed) layout(); });
  const onLost = event => { event.preventDefault(); ready = false; stage.classList.remove('is-rendered'); };
  canvas.addEventListener('webglcontextlost', onLost);
  layout();
  if (import.meta.env.DEV) window.__fleet = {
    snapshot: () => api.snapshot(), setProgress: p => api.setProgress(p), scrollTo: () => scrollTo(true),
    // Lighting, live: window.__fleet.tune({ exposure: 1.1 }).
    tune(values) {
      Object.assign(LIGHT, values);
      renderer.toneMappingExposure = LIGHT.exposure;
      scene.environmentIntensity = LIGHT.environment; scene.environmentRotation.y = LIGHT.rotation;
      hemisphere.intensity = LIGHT.hemisphere; key.intensity = LIGHT.key;
      softboxes.forEach(([light, power]) => { light.intensity = power * LIGHT.softboxes; });
      shadows.forEach(material => { material.opacity = LIGHT.shadow; });
      invalidate();
      return { ...LIGHT };
    },
  };

  const api = {
    loaded,
    scrollTo,
    snapshot: () => ({
      ready, rendered, active, progress: playhead.progress, view, fits,
      vehicles: ids.filter(id => vehicles.has(id)).map(id => { const { holder, car } = vehicles.get(id); return { id, position: holder.position.toArray(), wheel: car.wheels[0].rotation.x }; }),
      words: true,
    }),
    setProgress(p) { arrival = null; playhead.progress = p; render(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', onLean); section.removeEventListener('pointerleave', onRest);
      arrival = null;
      parallax?.scrollTrigger?.kill(); parallax?.kill(); watcher?.disconnect();
      resizeObserver.disconnect(); document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost);
      section.classList.remove('is-drive'); stage.classList.remove('is-rendered');
      dust?.dispose(); roadDust.dispose();
      if (parallax) gsap.set([word, canvas], { clearProps: 'transform,opacity,visibility' });
      const geometries = new Set(), materials = new Set();
      scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) [o.material].flat().forEach(m => materials.add(m)); });
      materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
      environment.dispose(); renderer.dispose();
      if (import.meta.env.DEV) delete window.__fleet;
    },
  };
  return api;
}

// Distance fades a surface towards transparency instead of towards a fog
// colour, so the section's white (and on the stage, the title) shows
// through a car still far off. Opaque and premultiplied surfaces fade their
// colour and cover together; straight-alpha ones their cover alone. The
// switch is on only while a drive draws: a material shared with another
// scene (the star badges) keeps that scene's own fog there.
const FADE = { value: 0 };
function fadeWithDistance(material) {
  if (material.userData.fadesWithDistance || !material.fog) return;
  material.userData.fadesWithDistance = true;
  const premultiplied = !material.transparent || (material.blending === THREE.CustomBlending && material.blendSrc === THREE.OneFactor);
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.fadeToClear = FADE;
    shader.fragmentShader = 'uniform float fadeToClear;\n' + shader.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      if (fadeToClear > .5) { ${premultiplied && !material.premultipliedAlpha ? 'gl_FragColor *= 1.0 - fogFactor;' : 'gl_FragColor.a *= 1.0 - fogFactor;'} }
      else gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`);
  };
  material.customProgramCacheKey = () => `${previousKey()}|fade-${premultiplied ? 'p' : 's'}`;
}
