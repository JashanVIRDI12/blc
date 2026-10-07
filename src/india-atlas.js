import * as THREE from 'three';
import gsap from 'gsap';
import { dots, outline, project } from './india-map.js';

// The "Across India" atlas (across-india.js draws the words around it): India
// as a field of fine dots on a dark table, seen from above at an angle, its
// coast a gold hairline. Gold routes rise from Paschim Vihar and land on every
// destination; a light travels them now and then. Nothing here is pinned or
// scroll-jacked: the atlas assembles once as it comes into view and leans a
// little with the scroll.
//
// World: India's map (india-map.js) laid on y = 0, 1 unit = 100 map units,
// north towards -Z; the camera stands to the south, above the table.
const SCALE = 100, CENTRE = [500, 560];
const SRGB = hex => new THREE.Color(hex).convertLinearToSRGB();
const IVORY = new THREE.Color('#efe6d4'), GOLD = new THREE.Color('#c99a52'), HI = new THREE.Color('#ffe3a6');
const toWorld = ([x, y]) => new THREE.Vector3((x - CENTRE[0]) / SCALE, 0, (y - CENTRE[1]) / SCALE);
// The coast's closed parts ("M x yL x y…Z"), as map points.
const coastParts = outline.split('M').filter(Boolean).map(part => part.replace(/Z\s*$/, '').split('L').map(pair => pair.trim().split(/\s+/).map(Number)).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
const ELEVATION = { from: 1.38, to: .98 }; // radians above the table: nearly overhead, then leaning back
const FOV = 26;

export function createAtlas(canvas, { origin, destinations, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 100);
  const table = new THREE.Group();
  scene.add(table);

  const start = toWorld(project(origin));
  const view = { reveal: reduced ? 14 : 0, elevation: reduced ? ELEVATION.to : ELEVATION.from, lean: 0, intro: reduced ? 1 : 0 };
  let size = { w: 1, h: 1 }, pixels = 1, distance = 20, disposed = false, frame = 0, looping = false, time = 0, last = 0;
  const listeners = new Set();

  // ------------------------------------------------------------------ dots
  const field = [...dots.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map(m => toWorld([Number(m[1]), Number(m[2])]));
  const positions = new Float32Array(field.length * 3), reach = new Float32Array(field.length), seeds = new Float32Array(field.length);
  field.forEach((p, i) => { positions.set([p.x, 0, p.z], i * 3); reach[i] = p.distanceTo(start); seeds[i] = Math.random(); });
  const farthest = Math.max(...reach);
  const dotGeometry = new THREE.BufferGeometry();
  dotGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dotGeometry.setAttribute('aReach', new THREE.BufferAttribute(reach, 1));
  dotGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const dotUniforms = {
    uReveal: { value: view.reveal }, uScale: { value: 1 }, uSize: { value: .058 }, uTime: { value: 0 },
    uIvory: { value: SRGB(IVORY) }, uGold: { value: SRGB(GOLD) },
  };
  // The grid's dots, each a soft round point sized in world units, so nearer
  // ones read larger. They light outwards from Paschim Vihar, a brighter rim
  // at the front of the wave; those near Delhi are warmer.
  const dotMaterial = new THREE.ShaderMaterial({
    uniforms: dotUniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uReveal, uScale, uSize, uTime;
      attribute float aReach, aSeed;
      varying float vAlpha, vWarm;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float lit = 1.0 - smoothstep(uReveal - 1.1, uReveal, aReach);
        float rim = smoothstep(uReveal - 1.1, uReveal - .25, aReach) * lit;
        float breathe = .9 + .1 * sin(uTime * .7 + aSeed * 31.0);
        gl_PointSize = max(1.0, uSize * uScale / -mv.z * (.86 + .28 * aSeed) * (1.0 + rim * .7));
        vAlpha = lit * (.32 + .18 * aSeed) * breathe + rim * .55;
        vWarm = exp(-aReach / 1.9);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uIvory, uGold;
      varying float vAlpha, vWarm;
      void main() {
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .16, d) * vAlpha;
        if (a < .004) discard;
        gl_FragColor = vec4(mix(uIvory, uGold, .25 + .6 * vWarm), a);
      }`,
  });
  const field3d = new THREE.Points(dotGeometry, dotMaterial);
  field3d.renderOrder = 0;
  table.add(field3d);

  // --------------------------------------------------------------- the coast
  const coast = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false });
  for (const part of coastParts) {
    if (part.length < 3) continue;
    const points = part.map(toWorld);
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), coast);
    line.renderOrder = 1;
    table.add(line);
  }

  // -------------------------------------------------------------- the routes
  const routeVertex = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const routeFragment = /* glsl */`
    uniform float uDraw, uFocus, uDim, uPulse;
    uniform vec3 uGold, uHi;
    varying vec2 vUv;
    void main() {
      float t = vUv.x;
      if (t > uDraw) discard;
      float head = smoothstep(uDraw - .14, uDraw, t) * (1.0 - step(.999, uDraw));
      float pulse = uPulse < 0.0 ? 0.0 : exp(-pow((t - uPulse) / .045, 2.0));
      float body = mix(.34, .95, uFocus) * (1.0 - .72 * uDim);
      float a = smoothstep(0.0, .05, t) * (body + head * .7 + pulse * .9 * (1.0 - .8 * uDim));
      gl_FragColor = vec4(mix(uGold, uHi, clamp(head + pulse + uFocus * .35, 0.0, 1.0)), clamp(a, 0.0, 1.0));
    }`;
  const haloTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,226,160,1)'); gradient.addColorStop(.18, 'rgba(240,196,110,.55)'); gradient.addColorStop(.5, 'rgba(201,154,82,.12)'); gradient.addColorStop(1, 'rgba(201,154,82,0)');
    g.fillStyle = gradient; g.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  })();
  const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const ring = new THREE.RingGeometry(.86, 1, 64).rotateX(-Math.PI / 2);
  const flat = (color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  const routes = destinations.map((place, i) => {
    const end = toWorld(project(place.at));
    const span = start.distanceTo(end);
    const middle = start.clone().lerp(end, .5); middle.y = .12 + span * .2;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const uniforms = { uDraw: { value: reduced ? 1 : 0 }, uFocus: { value: 0 }, uDim: { value: 0 }, uPulse: { value: -1 }, uGold: { value: SRGB(GOLD) }, uHi: { value: SRGB(HI) } };
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, .011, 6, false), new THREE.ShaderMaterial({ uniforms, vertexShader: routeVertex, fragmentShader: routeFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tube.renderOrder = 2;
    // The destination: a gold point on the table, a ring that opens when it
    // is chosen, and a soft glow.
    const marker = new THREE.Group();
    marker.position.copy(end).setY(.004);
    const dot = new THREE.Mesh(disc, flat(GOLD, reduced ? 1 : 0)); dot.scale.setScalar(.038);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(.42); halo.position.y = .01;
    const circle = new THREE.Mesh(ring, flat(HI)); circle.scale.setScalar(.09);
    [dot, halo, circle].forEach(mesh => { mesh.renderOrder = 3; });
    marker.add(halo, dot, circle);
    table.add(tube, marker);
    return { tube, uniforms, marker, dot, halo, circle, end, apex: curve.getPoint(.5), shown: reduced ? 1 : 0, focus: 0, phase: i * .37 + Math.random() * .4 };
  });

  // Paschim Vihar: a brighter point, a beam of light standing on it, and two
  // rings breathing outwards.
  const home = new THREE.Group();
  home.position.copy(start).setY(.006);
  const homeDot = new THREE.Mesh(disc, flat(HI, reduced ? 1 : 0)); homeDot.scale.setScalar(.06);
  const homeHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  homeHalo.scale.setScalar(.9); homeHalo.position.y = .02;
  const beamHeight = .62;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, beamHeight, 8, 1, true).translate(0, beamHeight / 2, 0), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: SRGB(HI) }, uOpacity: { value: reduced ? 1 : 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: routeVertex,
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main() { gl_FragColor = vec4(uColor, uOpacity * pow(1.0 - vUv.y, 1.6) * .9); }',
  }));
  const ripples = [0, 1].map(() => { const mesh = new THREE.Mesh(ring, flat(GOLD)); mesh.renderOrder = 3; return mesh; });
  [homeDot, homeHalo, beam].forEach(mesh => { mesh.renderOrder = 3; });
  home.add(homeHalo, homeDot, beam, ...ripples);
  table.add(home);

  // ------------------------------------------------------------- the camera
  // The camera stands to the south at `elevation`; the distance is the
  // nearest that keeps the coast, the arcs and the beam inside the frame with
  // a margin, measured for the view it is in.
  const frameRing = [];
  for (const part of coastParts) part.forEach((point, i) => { if (i % 6 === 0) frameRing.push(toWorld(point)); });
  routes.forEach(route => frameRing.push(route.apex));
  frameRing.push(start.clone().setY(beamHeight));
  const target = new THREE.Vector3(), probe = new THREE.Vector3();
  function aim(elevation, lean, at) {
    camera.position.set(Math.sin(lean) * Math.cos(elevation), Math.sin(elevation), Math.cos(lean) * Math.cos(elevation)).multiplyScalar(at).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function fits(elevation, at) {
    aim(elevation, 0, at);
    const margin = { x: .95, y: .93 };
    for (const point of frameRing) {
      probe.copy(point).project(camera);
      if (Math.abs(probe.x) > margin.x || Math.abs(probe.y) > margin.y) return false;
    }
    return true;
  }
  function fit(elevation) {
    let near = 3, far = 60;
    for (let i = 0; i < 22; i++) { const mid = (near + far) / 2; if (fits(elevation, mid)) far = mid; else near = mid; }
    return far;
  }
  let fitFrom = 20, fitTo = 20;
  function measure() {
    target.set(0, 0, .25);
    fitFrom = fit(ELEVATION.from); fitTo = fit(ELEVATION.to);
  }

  // --------------------------------------------------------------- drawing
  const screen = new THREE.Vector3();
  function render() {
    frame = 0;
    if (disposed) return;
    const settle = (view.elevation - ELEVATION.from) / (ELEVATION.to - ELEVATION.from);
    distance = fitFrom + (fitTo - fitFrom) * THREE.MathUtils.clamp(settle, 0, 1);
    aim(view.elevation, view.lean, distance);
    dotUniforms.uReveal.value = view.reveal;
    dotUniforms.uTime.value = time;
    coast.opacity = .26 * THREE.MathUtils.smoothstep(view.reveal, 2, farthest);
    // The beacon breathes: two rings opening from it, a phase apart.
    const beacon = THREE.MathUtils.clamp(view.intro * 4, 0, 1);
    homeDot.material.opacity = beacon; homeHalo.material.opacity = .85 * beacon; beam.material.uniforms.uOpacity.value = beacon;
    ripples.forEach((mesh, i) => {
      const t = reduced ? .35 + i * .3 : (time * .42 + i * .5) % 1;
      mesh.scale.setScalar(.07 + t * .34); mesh.material.opacity = beacon * .5 * (1 - t) ** 1.6;
    });
    const anyFocus = routes.some(route => route.focus > .01);
    for (const route of routes) {
      const { uniforms, dot, halo, circle, shown, focus } = route;
      uniforms.uFocus.value = focus;
      uniforms.uDim.value = anyFocus ? 1 - focus : 0;
      // Now and then a light runs out along each route.
      const cycle = reduced ? -1 : ((time * .16 + route.phase) % 1.6);
      uniforms.uPulse.value = uniforms.uDraw.value >= 1 && cycle <= 1.15 ? cycle : -1;
      dot.material.opacity = shown;
      dot.scale.setScalar(.038 * (1 + focus * .35));
      halo.material.opacity = shown * (.32 + focus * .6) * (anyFocus && focus < .01 ? .5 : 1);
      circle.material.opacity = focus * .9;
      circle.scale.setScalar(.075 + focus * .05);
    }
    renderer.render(scene, camera);
    listeners.forEach(listener => listener());
  }
  const request = () => { if (!frame && !looping && !disposed) frame = requestAnimationFrame(render); };
  // While on screen the routes carry their lights: one frame per display
  // frame, and none off screen or in a hidden tab.
  function tick(now) {
    if (!looping || disposed) return;
    time += Math.min(.05, (now - last) / 1000 || 0); last = now;
    render();
    frame = requestAnimationFrame(tick);
  }
  function loop(on) {
    on = on && !reduced && !document.hidden;
    if (on === looping) return;
    looping = on;
    cancelAnimationFrame(frame); frame = 0;
    if (on) { last = performance.now(); frame = requestAnimationFrame(tick); } else request();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    pixels = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixels); renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h; camera.updateProjectionMatrix();
    // Point sizes are in world units: pixels per unit at a distance of one.
    dotUniforms.uScale.value = size.h * pixels / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    measure(); request();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // The atlas assembles: the camera leans back from overhead while the dots
  // light outwards from Paschim Vihar, the beacon rises, then the routes
  // draw out one after another, nearest first, each landing on its point.
  function intro() {
    const timeline = gsap.timeline({ onUpdate: request });
    if (reduced) return timeline;
    timeline
      .fromTo(view, { elevation: ELEVATION.from }, { elevation: ELEVATION.to, duration: 3, ease: 'expo.inOut' }, 0)
      .fromTo(view, { reveal: 0 }, { reveal: farthest + 1.2, duration: 2.6, ease: 'power2.inOut' }, .15)
      .fromTo(view, { intro: 0 }, { intro: 1, duration: 1.2, ease: 'none' }, .35);
    routes.forEach((route, i) => {
      const at = 1.25 + i * Math.min(.11, 1.2 / Math.max(1, routes.length));
      timeline.fromTo(route.uniforms.uDraw, { value: 0 }, { value: 1, duration: 1.15, ease: 'power2.inOut' }, at)
        .fromTo(route, { shown: 0 }, { shown: 1, duration: .5, ease: 'power2.out' }, at + .95);
    });
    return timeline;
  }

  return {
    view, routes, farthest, request, loop, intro,
    // Where a destination (or Paschim Vihar, -1) stands on screen, in CSS
    // pixels from the canvas's top left; `top` gives its route's apex.
    screen(index, top = false) {
      const point = index < 0 ? (top ? start.clone().setY(beamHeight) : start) : top ? routes[index].apex : routes[index].end;
      screen.copy(point).applyMatrix4(table.matrixWorld).project(camera);
      return { x: (screen.x + 1) / 2 * size.w, y: (1 - screen.y) / 2 * size.h, visible: screen.z < 1 };
    },
    onRender(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setReduced(value) { reduced = value; if (reduced) loop(false); request(); },
    dispose() {
      disposed = true; looping = false; cancelAnimationFrame(frame); observer.disconnect(); listeners.clear();
      scene.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(material => material?.dispose()); });
      haloTexture.dispose(); disc.dispose(); ring.dispose(); renderer.dispose();
    },
  };
}
