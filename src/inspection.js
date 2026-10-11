// The inspection: a Volvo S90 Recharge in a white studio, and the camera
// going over it as an inspector does. It arrives on the whole car, then
// takes each check in turn, close: along the paint of the flank, down to a
// wheel and its brake, round to the front of the car, in to the seats and
// across to the dashboard and its screens, and out to the rear; then it
// stands back. One word, set large across the foot of the picture, names
// what it is looking at, and changes with the shot (Inspected, Paint, Tyres,
// Engine, Cabin, Screens, Papers, Listed); the picture fades to paper under
// it, so it is always ink on white. Between one shot and the next the frame dips to white, as a cut does,
// so the camera never has to pass through a door.
//
// The scroll is the only clock: scrolling back plays it back. The car is
// loaded whole (detail-car.js): the body first, the cabin behind it, and the
// 4K textures of whatever the camera is close to as it gets there.
//
// It is lit the way a car is photographed on white: by what it reflects.
// Round it (studioLights) are a grey cove, a light bank the length of the
// car overhead, a strip down each side, a card at each end and the white
// floor, so the paint keeps its depth between long, clean highlights. The
// floor is polished, on screens that can afford the second view of the car
// it takes. The page's header is set in ink while this section is under it.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { inspectionCar } from './config.js';
import { loadDetailCar } from './detail-car.js';
import { createRenderDensity } from './render-density.js';
import { studioFloor, carStudio } from './studio-stage.js';
import { compileAhead } from './compile.js';
gsap.registerPlugin(ScrollTrigger);

const PAPER = '#f2f0eb'; // the section's own white (about-page.css)
const STACKED = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
const CUT = .16; // the share of a shot, at either end, that the dip to white takes

// The shots, in order. `at` and `look` are car metres (nose towards +z, the
// driver's side +x, tyres on y = 0), drifting from one to the other as the
// shot is scrolled through; `span` is its share of the scroll; `check` the
// report line it answers; `wide` a view of the whole car, `inside` one from
// the cabin; `focus` the materials it is close to (their largest textures)
// and those in the frame with them (the next size down).
const WHEELS = ['Rims.001', 'Tire.001'];
const SHOTS = [
  { id: 'arrival', word: 'Inspected.', span: .9, wide: true, fov: 26, from: { at: [6.5, 1.7, 6.2], look: [-.2, .5, .1] }, to: { at: [6.8, 1.5, 5.4], look: [-.2, .5, 0] }, focus: { mid: [...WHEELS, 'Headlight_Insides'] } },
  { id: 'paint', word: 'Paint.', check: 0, span: 1.2, fov: 30, from: { at: [3.3, .92, 2.9], look: [.95, .72, .9] }, to: { at: [3.3, .86, -1.5], look: [.95, .72, -1.7] }, focus: { mid: WHEELS } },
  { id: 'wheel', word: 'Tyres.', check: 1, span: 1, fov: 24, from: { at: [2.5, .72, 2.9], look: [.9, .45, 1.6] }, to: { at: [2.65, .6, 2.25], look: [.9, .45, 1.6] }, focus: { high: WHEELS, mid: ['caliper', 'disc.001'] } },
  { id: 'front', word: 'Engine.', check: 2, span: 1, fov: 26, from: { at: [2.1, 1.0, 4.6], look: [.3, .7, 2.3] }, to: { at: [1.1, .92, 4.75], look: [.25, .7, 2.3] }, focus: { high: ['Headlight_Insides'], mid: WHEELS } },
  { id: 'cabin', word: 'Cabin.', check: 3, span: 1, inside: true, fov: 66, from: { at: [0, 1.2, -.86], look: [.1, .85, .75] }, to: { at: [0, 1.17, -.6], look: [.1, .85, .75] }, focus: { high: ['Front_Seat', 'DoorPanelFront'], mid: ['Dashboard', 'Steeringwheel', 'CenterConsole', 'Shell'] } },
  { id: 'dash', word: 'Screens.', check: 3, span: 1, inside: true, fov: 52, from: { at: [.1, 1.14, -.3], look: [.22, .88, .8] }, to: { at: [.14, 1.1, -.08], look: [.2, .88, .8] }, focus: { high: ['Dashboard', 'Steeringwheel'], mid: ['CenterConsole', 'Front_Seat', 'DoorPanelFront'] } },
  { id: 'rear', word: 'Papers.', check: 4, span: 1, fov: 26, from: { at: [2.4, 1.05, -5.1], look: [.1, .72, -2.3] }, to: { at: [1.3, 1.0, -5.4], look: [.05, .72, -2.3] }, focus: { high: ['Taillight'], mid: WHEELS } },
  { id: 'leave', word: 'Listed.', span: 1, wide: true, fov: 26, from: { at: [7.1, 1.45, -4.6], look: [-.2, .5, -.1] }, to: { at: [7.6, 1.6, -3.5], look: [-.2, .5, 0] }, focus: { mid: [...WHEELS, 'Taillight'] } },
];
{
  // Where each shot begins and ends, as shares of the whole.
  const total = SHOTS.reduce((sum, shot) => sum + shot.span, 0);
  let at = 0;
  for (const shot of SHOTS) { shot.start = at / total; at += shot.span; shot.end = at / total; }
}

export function createInspection(section) {
  const stage = section.querySelector('[data-inspect-stage]');
  const canvas = stage.querySelector('canvas'), veil = section.querySelector('[data-veil]');
  const checks = [...section.querySelectorAll('[data-check]')].map(item => ({ item, on: false, latest: false }));
  // The one word on the picture: two lines to pass it between, the old one
  // leaving the way the scroll is going as the new one arrives.
  const lines = [...section.querySelectorAll('[data-word] span')];
  let said = lines[0].textContent, live = 0;
  function say(word, forward) {
    if (word === said) return;
    said = word;
    const out = lines[live], coming = lines[live = 1 - live], way = forward ? 1 : -1;
    coming.textContent = word;
    out.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-105 * way}%)` }], { duration: 620, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
    coming.animate([{ transform: `translateY(${105 * way}%)` }, { transform: 'translateY(0)' }], { duration: 1150, delay: 200, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
  }
  const bar = section.querySelector('[data-scanbar] b'), count = section.querySelector('[data-scan-count]');
  const header = document.querySelector('.site-header');
  const phone = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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
  // The cabin's own light, for the shots from inside it: the studio reaches
  // in through the glass, but a cabin photographed is filled from within
  // too. A soft fill from above, with no point for the screens to mirror.
  const cabinLight = new THREE.HemisphereLight('#fff3e2', '#4a4037', 0);
  scene.add(cabinLight);
  const textureSize = { w: 512, h: 512 };
  const gloss = phone ? null : studioFloor(60, textureSize, { strength: .2, blur: .9, paper: true });
  if (gloss) {
    gloss.rotation.x = -Math.PI / 2;
    gloss.material.uniforms.uFar.value = 22;
    gloss.renderOrder = -1;
    scene.add(gloss);
  }

  const camera = new THREE.PerspectiveCamera(26, 1, .3, 80);
  const density = createRenderDensity({ mobile: phone });
  let size = { w: 1, h: 1 }, ratio = 1, raf = 0, ready = false, active = false, disposed = false, progress = 0;
  let car = null, shadow = null, current = null, shown = 0;
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), v = new THREE.Vector3();

  function layout() {
    size = { w: stage.clientWidth || innerWidth, h: stage.clientHeight || innerHeight };
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
    const index = progress >= 1 ? SHOTS.length - 1 : Math.max(0, SHOTS.findIndex(shot => progress < shot.end)), shot = SHOTS[index];
    const u = gsap.utils.clamp(0, 1, (progress - shot.start) / (shot.end - shot.start)), tall = STACKED.matches;
    eye.fromArray(shot.from.at).lerp(v.fromArray(shot.to.at), u);
    look.fromArray(shot.from.look).lerp(v.fromArray(shot.to.look), u);
    // A narrow or squarer frame stands further off, so the car (or the part)
    // still fits beside the words, or between them.
    if (!shot.inside) eye.sub(look).multiplyScalar(Math.max(1, (tall ? (shot.wide ? .72 : .5) : shot.wide ? 1.5 : 1.2) / camera.aspect)).add(look);
    camera.position.copy(eye); camera.lookAt(look);
    camera.fov = shot.fov + (tall ? (shot.inside ? 16 : 20) : 0);
    camera.near = shot.inside ? .04 : .3;
    // The picture has the frame: the subject a little right of centre and
    // above it, clear of the word at the foot.
    const shift = tall ? [0, .06] : [shot.inside ? 0 : -.05, shot.inside ? .06 : shot.wide ? .1 : .09];
    camera.setViewOffset(size.w, size.h, shift[0] * size.w, shift[1] * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
    // The dip to white at either end of a shot (not before the first, nor
    // after the last).
    const dip = Math.max(index > 0 ? 1 - u / CUT : 0, index < SHOTS.length - 1 ? (u - (1 - CUT)) / CUT : 0);
    veil.style.opacity = gsap.parseEase('power2.inOut')(gsap.utils.clamp(0, 1, dip)).toFixed(3);
    if (shot !== current) {
      current = shot;
      const inside = Boolean(shot.inside);
      if (gloss) gloss.visible = !inside;
      if (shadow) shadow.visible = !inside;
      cabinLight.intensity = inside ? .9 : 0;
      scene.environmentIntensity = inside ? .55 : 1;
      section.dataset.shot = shot.id;
      say(shot.word, index >= shown);
      shown = index;
      car?.focus(shot.focus);
    }
    // The checks the camera has reached are ticked; the one it is on is read out.
    const reached = shot.check ?? (index ? checks.length : -1);
    checks.forEach((check, i) => {
      const on = i <= reached, latest = i === shot.check;
      if (on !== check.on) { check.on = on; check.item.classList.toggle('is-on', on); }
      if (latest !== check.latest) { check.latest = latest; check.item.classList.toggle('is-latest', latest); }
    });
    const passed = Math.min(checks.length, reached + 1);
    bar.style.transform = `scaleX(${(passed / checks.length).toFixed(3)})`;
    count.textContent = `${String(passed).padStart(2, '0')} / ${String(checks.length).padStart(2, '0')}`;
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
    const [detail, shadowTexture] = await Promise.all([
      loadDetailCar(inspectionCar.base, { renderer, paint: inspectionCar.paint, phone, invalidate }),
      new THREE.TextureLoader().loadAsync(inspectionCar.shadow),
    ]);
    if (disposed) { detail.dispose(); return; }
    car = detail;
    await car.exterior;
    if (disposed) return;
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 6.3), new THREE.MeshBasicMaterial({ color: '#1f1a14', alphaMap: shadowTexture, transparent: true, opacity: .5, depthWrite: false, toneMapped: false }));
    // The map runs out to its edges still a little grey: nothing on dark
    // stone, a hard-edged rectangle on white. Here it is gathered under the
    // car and feathered to nothing before the edge.
    shadow.material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', 'vec2 rim = smoothstep(0.0, .2, vAlphaMapUv) * smoothstep(1.0, .8, vAlphaMapUv); diffuseColor.a *= smoothstep(.1, .85, texture2D(alphaMap, vAlphaMapUv).g) * rim.x * rim.y;'); };
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .006; shadow.renderOrder = 1;
    scene.add(car.root, shadow);
    layout();
    await compileAhead(renderer, scene, camera);
    if (disposed) return;
    ready = true;
    current = null;
    section.classList.add('is-ready');
    invalidate();
    // The cabin's shaders, as it arrives, before the camera is in it.
    car.interior.then(() => { if (!disposed) return compileAhead(renderer, scene, camera); }).then(invalidate);
  }

  const pinned = ScrollTrigger.create({
    trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * (STACKED.matches ? 4.6 : 5.4))}`,
    // Measured before the pins below it, though it is made after them.
    pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1,
    onUpdate: self => { progress = self.progress; invalidate(); },
  });
  // Loads as the visitor nears, and draws only while on screen.
  let started = false;
  const near = ScrollTrigger.create({
    // To the end of the pin and the screen after it: a trigger on a pinned
    // section measures its bottom without the pin's length.
    trigger: section, start: 'top bottom+=1600', end: () => pinned.end + innerHeight, refreshPriority: 1,
    onToggle: self => {
      active = self.isActive;
      if (active && !started) { started = true; load().catch(error => { console.error('The inspection is unavailable; keeping the still.', error); section.classList.add('is-static'); }); }
      invalidate();
    },
  });
  // The header is set in ink while the white of this section is under it.
  const under = ScrollTrigger.create({
    start: () => pinned.start - header.offsetHeight / 2, end: () => pinned.end + section.offsetHeight - header.offsetHeight / 2, refreshPriority: 1,
    onToggle: self => header.classList.toggle('is-light', self.isActive),
  });
  const resizer = new ResizeObserver(() => layout());
  resizer.observe(stage);
  if (import.meta.env.DEV) window.__inspection = {
    state: () => ({ ready, active, progress, shot: current?.id, car: car?.state() }),
    // The frame as an image, for the still shown where the stage cannot run.
    still: () => { frame(); renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
  };
  return {
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      pinned.kill(true); near.kill(); under.kill(); resizer.disconnect();
      header.classList.remove('is-light');
      car?.dispose();
      scene.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(m => m?.dispose()); });
      gloss?.getRenderTarget().dispose();
      environment.dispose(); renderer.dispose();
    },
  };
}
