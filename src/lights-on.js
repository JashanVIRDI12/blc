import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { showcase, lightsVehicles } from './config.js';
import { createCameraPath } from './camera-path.js';
import { interval, smooth } from './motion.js';
import { lightsMarks, lightsCamera, lightsLogo, LIGHTS, bayLevel, roomLevel, lampLevel } from './lights-on-storyboard.js';
import { carCorners, fitFrame, frameCamera } from './about-framing.js';
import { createRenderDensity } from './render-density.js';
import { createDust } from './dust.js';
import { createStudioOutput } from './studio-output.js';
gsap.registerPlugin(ScrollTrigger);

const PINNED = 2.2; // viewport heights the section stays pinned
const TALL = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
const DARK = [10, 10, 11], WHITE = [255, 255, 255];
// Broad softboxes reveal the bodywork without lifting the black background.
// Each bay's overhead light still follows the original scroll storyboard.
const LIGHT = {
  exposure: 1.02, environment: .85, environmentDark: .22, rotation: Math.PI * 1.5,
  hemisphere: .32, hemisphereDark: .08, key: .7, keyDark: .1,
  fill: 1.4, fillDark: .85, rim: 1.6, rimDark: 1.1,
  panelDark: 4.2, panelLit: 2.1, pool: .32, beam: .12, flare: .5,
  shadow: .58, signGlow: .2,
  // The room: the floor's gloss in the dark and once the studio is up, and
  // the cove light where it meets the back wall, with the wash it throws up
  // the wall.
  gloss: .46, glossLit: .32, cove: 2.4, wash: 1,
};
// Marks on the floor itself (pools, beams, contact shadows) lie in the
// reflecting plane: the floor's reflection leaves them out.
const DECALS = 1;

// The gloss floor (three's Reflector, with its own shader). It blends the
// mirrored room over whatever lies behind the canvas, by its reflectance:
// Fresnel, so faint underfoot and strong towards the back wall, as polished
// stone is; where the mirror sees nothing it reflects the room's own tone,
// black in the dark and white once the studio is up. So it is black gloss in
// the dark and a glossy white floor in the lit studio. The mirror is drawn
// at a quarter size and blurred, and fades out at the floor's near edge, its
// ends, and above the words' bar, so it never lies behind them.
const FLOOR = {
  name: 'GlossFloor',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, gloss: { value: 0 }, room: { value: 0 }, texel: { value: new THREE.Vector2(1, 1) }, fade: { value: new THREE.Vector2(-1, 0) } },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vMirror; varying vec3 vWorld; varying vec2 vPlane;
    void main() {
      vMirror = textureMatrix * vec4(position, 1.0);
      vPlane = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: `
    uniform vec3 color; uniform sampler2D tDiffuse; uniform float gloss; uniform float room; uniform vec2 texel; uniform vec2 fade;
    varying vec4 vMirror; varying vec3 vWorld; varying vec2 vPlane;
    vec4 tap(vec2 uv, vec2 at) { return texture2D(tDiffuse, uv + texel * at); }
    void main() {
      vec2 uv = vMirror.xy / vMirror.w;
      vec4 c = tap(uv, vec2(0.0)) * 0.2
        + (tap(uv, vec2(1.0, 0.0)) + tap(uv, vec2(-1.0, 0.0)) + tap(uv, vec2(0.0, 1.2)) + tap(uv, vec2(0.0, -1.2))) * 0.12
        + (tap(uv, vec2(1.0, 1.2)) + tap(uv, vec2(-1.0, 1.2)) + tap(uv, vec2(1.0, -1.2)) + tap(uv, vec2(-1.0, -1.2))) * 0.08;
      vec3 mirrored = c.rgb + vec3(room) * (1.0 - clamp(c.a, 0.0, 1.0));
      float facing = clamp(normalize(cameraPosition - vWorld).y, 0.0, 1.0);
      float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
      float edge = smoothstep(0.0, 0.2, vPlane.x) * smoothstep(1.0, 0.8, vPlane.x) * smoothstep(0.0, 0.45, vPlane.y);
      float k = clamp(gloss * fresnel, 0.0, 0.9) * edge * smoothstep(fade.x, fade.y, gl_FragCoord.y);
      gl_FragColor = vec4(mirrored * color * k, k);
    }`,
};

// Keep colour maps and data maps in their authored colour spaces. Mipmaps
// and anisotropic filtering resolve small and oblique texture detail;
// compressed textures retain their supplied mip chain.
function filterTexture(texture, anisotropy) {
  texture.anisotropy = anisotropy;
  texture.magFilter = THREE.LinearFilter;
  if (texture.generateMipmaps || texture.mipmaps.length > 1) texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
}

// The audited headlamp marks are approximate. Seat each small glare on
// the actual light-guide mesh, so it cannot float in front of the grille.
function lampAnchors(car, headlamps) {
  const anchors = headlamps.map(position => new THREE.Vector3(...position));
  const points = anchors.map(anchor => anchor.clone());
  const distances = anchors.map(() => .4 ** 2);
  const point = new THREE.Vector3();
  car.root.updateMatrixWorld(true);
  car.root.traverse(node => {
    if (!node.isMesh || ![node.material].flat().some(material => material.name === car.spec.drl)) return;
    const vertices = node.geometry.attributes.position;
    for (let vertex = 0; vertex < vertices.count; vertex++) {
      point.fromBufferAttribute(vertices, vertex).applyMatrix4(node.matrixWorld);
      anchors.forEach((anchor, i) => {
        const distance = point.distanceToSquared(anchor);
        if (distance < distances[i]) { distances[i] = distance; points[i].copy(point); }
      });
    }
  });
  return points;
}

// "Lights on" (lights-on-storyboard.js), the home page's collection: the
// cars parked in the dark, only their headlamps lit, their beams on the
// floor; the camera tracks along them and a light comes up over each as it
// passes, throwing a pool of light round it; then the whole studio comes up,
// the room turns white, the camera swings back to see them all, and the words
// rise into their bar beneath them. The scroll is the only clock, lights and
// all, so reversing replays it exactly. The cars are only a picture: they
// carry no names and open nothing. Models load
// in the background; until then, and without WebGL, the section keeps its
// stills. Throws when WebGL is unavailable.
export function createLightsOn(section, { reduced = false } = {}) {
  const stage = section.querySelector('.fleet-stage');
  const canvas = stage.querySelector('canvas');
  const copy = section.querySelector('.fleet-copy');
  const header = document.querySelector('.site-header');
  // The scene is drawn, multisampled, into its own HDR target
  // (studio-output.js); the canvas receives one full-screen quad. Its own
  // multisampled colour, depth and stencil buffers would never be used, and
  // at the stage's density they cost well over a hundred megabytes.
  const context = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: true, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL 2 is unavailable.');
  // RGBA16F filtering is core in WebGL 2; the 32-bit float filtering
  // extension is not required. Both render-target extensions allow 16F.
  const hdr = Boolean(context.getExtension('EXT_color_buffer_float') || context.getExtension('EXT_color_buffer_half_float'));
  if (!hdr) throw new Error('Floating-point studio lighting is unavailable.');
  // MSAA resolves before tone mapping. SMAA filters remaining edges in
  // linear light without a temporal history that could ghost on scroll.
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, depth: false, stencil: false, alpha: true });
  const anisotropy = Math.min(innerWidth <= 760 ? 8 : 16, renderer.capabilities.getMaxAnisotropy());
  const output = createStudioOutput(renderer, { mobile: innerWidth <= 760 });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;
  renderer.setClearColor('#000000', 0);
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
  section.classList.add('is-drive', 'is-lights');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const room = new RoomEnvironment();
  let environment = pmrem.fromScene(room, .04);
  room.dispose();
  scene.environment = environment.texture;
  let disposed = false;
  const studio = new EXRLoader().loadAsync('/env/studio-1k.exr').then(texture => {
    if (disposed) { texture.dispose(); return; }
    const next = pmrem.fromEquirectangular(texture);
    texture.dispose();
    environment.dispose(); environment = next;
    scene.environment = next.texture; scene.environmentRotation.y = LIGHT.rotation;
  }).catch(error => console.warn('Studio light unavailable; keeping the room.', error)).finally(() => pmrem.dispose());
  const hemisphere = new THREE.HemisphereLight('#ffffff', '#a59c8c', 0);
  const key = new THREE.DirectionalLight('#fff4e6', 0);
  key.position.set(-6, 10, 12);
  const fill = new THREE.RectAreaLight('#fff5e8', 0, 18, 6);
  const rim = new THREE.RectAreaLight('#e6efff', 0, 18, 3);
  scene.add(hemisphere, key, fill, rim);
  const camera = new THREE.PerspectiveCamera(30, 1, .5, 160);
  camera.layers.enable(DECALS);
  // A few motes in the beams, not a starfield.
  const dust = reduced ? null : createDust(stage, { scene: canvas, amount: .28 });
  const flood = stage.querySelector('.fleet-flood');

  // Soft sprites drawn once: a round pool, a headlamp's flare, its beam.
  const sprite = (width, height, draw) => { const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; filterTexture(t, anisotropy); return t; };
  const radial = (stops) => sprite(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([at, color]) => r.addColorStop(at, color)); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const poolTexture = radial([[0, 'rgba(255,240,214,1)'], [.35, 'rgba(255,232,200,.55)'], [.7, 'rgba(255,225,190,.14)'], [1, 'rgba(255,225,190,0)']]);
  const flareTexture = radial([[0, 'rgba(255,255,255,1)'], [.08, 'rgba(236,244,255,.95)'], [.25, 'rgba(200,220,255,.32)'], [.6, 'rgba(170,200,255,.06)'], [1, 'rgba(170,200,255,0)']]);
  // A headlamp's throw on the floor, drawn pixel by pixel: a cone that
  // widens away from the lamp, soft at its edges, fading as it goes.
  const beamTexture = sprite(128, 256, (g, w, h) => {
    const image = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / (h - 1), u = Math.abs(x / (w - 1) * 2 - 1), spread = .14 + .86 * v;
      const side = Math.max(0, 1 - u / spread), across = side * side * (3 - 2 * side);
      const along = Math.min(1, v / .06) * (1 - v) ** 1.8;
      const i = (y * w + x) * 4;
      image.data.set([226, 236, 255, Math.round(255 * across * along)], i);
    }
    g.putImageData(image, 0, 0);
  });
  const glow = (texture, extra = {}) => new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, ...extra });

  // The Baba Luxury Car sign on the back wall, lit from behind: the gold mark
  // and a warm glow on the wall around it. It glows in the dark from the
  // start; once the room is white the glow is lost in the light and the mark
  // stands on its own.
  const sign = new THREE.Group();
  const signGlow = glow(radial([[0, 'rgba(255,190,110,.75)'], [.4, 'rgba(255,170,90,.2)'], [1, 'rgba(255,170,90,0)']]));
  const signMark = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, color: new THREE.Color(1, 1, 1) });
  const ASPECT = 1200 / 376;
  const markPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / ASPECT), signMark);
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3 / ASPECT), signGlow);
  glowPlane.position.z = -.02; glowPlane.renderOrder = 0; markPlane.renderOrder = 1;
  sign.add(glowPlane, markPlane);
  scene.add(sign);
  new THREE.TextureLoader().loadAsync('/brand/baba-luxury-car.png').then(texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace; filterTexture(texture, anisotropy);
    textures.push(texture);
    signMark.map = texture; signMark.needsUpdate = true;
    invalidate();
  }).catch(error => console.warn('The sign is unavailable.', error));

  // The room, kept to two things. The floor is gloss: it holds a soft
  // reflection of the cars, the lamps and the sign, black stone in the dark
  // and a white floor once the studio is up (FLOOR above; phones keep the
  // plain floor). Where the floor meets the back wall a thin cove light runs
  // the width of the room, washing a little warmth up the wall; it doubles
  // in the gloss, so the cars stand on a horizon, and gives way to the white.
  // The backdrop stands with the sign, facing the last frame.
  const backdrop = new THREE.Group();
  const lightBlend = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
  const fadeEnds = (g, w, h, draw) => { draw(); g.globalCompositeOperation = 'destination-in'; const ends = g.createLinearGradient(0, 0, w, 0); [[0, 0], [.22, 1], [.78, 1], [1, 0]].forEach(([at, a]) => ends.addColorStop(at, `rgba(0,0,0,${a})`)); g.fillStyle = ends; g.fillRect(0, 0, w, h); };
  const washTexture = sprite(512, 128, (g, w, h) => fadeEnds(g, w, h, () => { const up = g.createLinearGradient(0, h, 0, 0); [[0, .3], [.08, .16], [.35, .05], [1, 0]].forEach(([at, a]) => up.addColorStop(at, `rgba(255,196,128,${a})`)); g.fillStyle = up; g.fillRect(0, 0, w, h); }));
  const coveTexture = sprite(512, 4, (g, w, h) => fadeEnds(g, w, h, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }));
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(64, 3.4), new THREE.MeshBasicMaterial({ map: washTexture, opacity: 0, ...lightBlend }));
  wash.position.y = 1.7;
  const coveColor = new THREE.Color(1, .74, .46);
  const cove = new THREE.Mesh(new THREE.PlaneGeometry(64, .045), new THREE.MeshBasicMaterial({ map: coveTexture, color: coveColor.clone(), ...lightBlend }));
  cove.position.set(0, .0225, .01);
  backdrop.add(wash, cove);
  let floor = null;
  if (innerWidth > 760) {
    floor = new Reflector(new THREE.PlaneGeometry(64, 34), { color: 0xffffff, textureWidth: 1, textureHeight: 1, multisample: 0, clipBias: .003, shader: FLOOR });
    floor.material.setValues({ transparent: true, depthWrite: false, premultipliedAlpha: true });
    floor.rotation.x = -Math.PI / 2; floor.position.z = 17; floor.renderOrder = -1;
    // Its view of the room leaves out the marks on the floor.
    const reflectionCamera = floor.getReflectionCamera.bind(floor);
    floor.getReflectionCamera = viewer => { const mirror = reflectionCamera(viewer); mirror.layers.set(0); return mirror; };
    backdrop.add(floor);
  }
  scene.add(backdrop);
  const placeSign = () => {
    const { position, width, yaw } = lightsLogo[view];
    sign.position.set(...position); sign.rotation.y = yaw; sign.scale.setScalar(width);
    backdrop.position.set(position[0], 0, position[2]); backdrop.rotation.y = yaw;
  };

  const ids = lightsVehicles.map(entry => entry.id);
  const paths = Object.fromEntries(Object.entries(lightsCamera).map(([name, frames]) => [name, createCameraPath(frames)]));
  let view = TALL.matches ? 'tall' : 'wide', marks = lightsMarks(view);
  const vehicles = new Map(), textures = [poolTexture, flareTexture, beamTexture, washTexture, coveTexture];
  // Each car's own light: an overhead panel and the pool it throws.
  const bays = new Map(ids.map(id => {
    const panel = new THREE.RectAreaLight('#fff3e2', 0, 3, 5.6);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glow(poolTexture));
    pool.rotation.x = -Math.PI / 2; pool.renderOrder = 0; pool.layers.set(DECALS);
    scene.add(panel, pool);
    return [id, { panel, pool }];
  }));
  const playhead = { progress: 0 };
  // 0 while the stills stand in, 1 once the cars are drawn. Until then the
  // section is the page's white with the stills and the words set, never a
  // dark, empty stage pinned under the visitor; if the cars arrive while it is
  // on screen, the room fades from white to wherever the scroll has it.
  const shown = { value: 0 };
  let size = { w: 1, h: 1 }, fit = { zoom: 1, offset: [0, 0] };
  let active = false, ready = false, rendered = false, dirty = true, raf = 0, dark = null, background = '', floodState = '';
  const fade = { line: 0, full: 0 };
  const density = createRenderDensity({ mobile: innerWidth <= 760 });
  let ratio = density.ratio(innerWidth, innerHeight);

  function place() {
    marks = lightsMarks(view);
    placeSign();
    // Rotate the softboxes with the bays; car, sign and camera positions
    // continue to come exclusively from the existing storyboard.
    const rotation = new THREE.Matrix4().makeRotationY(marks[ids[0]].yaw);
    fill.position.set(-4.5, 5, 7).applyMatrix4(rotation); fill.lookAt(0, .8, 0);
    rim.position.set(5.5, 4, -5).applyMatrix4(rotation); rim.lookAt(0, 1, 0);
    for (const [id, bay] of bays) {
      const { position: [x, , z], yaw } = marks[id];
      bay.panel.position.set(x, 4.6, z);
      bay.panel.up.set(Math.sin(yaw), 0, Math.cos(yaw));
      bay.panel.lookAt(x, 0, z);
      bay.pool.position.set(x, .005, z);
      const car = vehicles.get(id);
      if (car) { car.holder.position.set(x, 0, z); car.holder.rotation.y = yaw; }
    }
  }
  place();

  function invalidate() { dirty = true; if (!raf && active && ready && !disposed && !document.hidden) raf = requestAnimationFrame(draw); }
  function draw(now) {
    raf = 0;
    if (!dirty || !active || !ready || disposed) return;
    dirty = false;
    if (density.slow(now) && density.step(size.w, size.h)) { ratio = density.ratio(size.w, size.h); applySize(); }
    output.render(scene, camera);
    if (!rendered) { rendered = true; stage.classList.add('is-rendered'); }
  }
  function applySize() {
    renderer.setPixelRatio(ratio); renderer.setSize(size.w, size.h, false);
    output.setSize(canvas.width, canvas.height);
    if (floor) {
      const w = Math.max(1, Math.round(canvas.width / 4)), h = Math.max(1, Math.round(canvas.height / 4));
      floor.getRenderTarget().setSize(w, h); floor.material.uniforms.texel.value.set(1 / w, 1 / h);
    }
  }

  // The last frame: the cars as large as the space between the header
  // and the words' bar allows, a little below its middle.
  function layout() {
    if (disposed) return;
    const wanted = TALL.matches ? 'tall' : 'wide';
    if (wanted !== view) { view = wanted; place(); }
    size = { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
    ratio = density.ratio(size.w, size.h); applySize();
    const { w, h } = size, tall = view === 'tall';
    const boxes = ids.map(id => carCorners(marks[id], vehicleParts[id].size));
    const shot = paths[view](LIGHTS.anchor);
    const region = { left: w * (tall ? .03 : .035), right: w * (tall ? .97 : .965), top: header.offsetHeight + h * (tall ? .02 : .035), bottom: copy.offsetTop - (tall ? h * .025 : Math.min(40, h * .05)) };
    fit = fitFrame({ shot, width: w, height: h, region, boxes });
    const spare = region.bottom - fit.bounds.bottom;
    if (spare > 8) fit = fitFrame({ shot, width: w, height: h, region: { ...region, top: fit.bounds.top + spare * .65 }, boxes, align: 'top' });
    // Once the words are set, the floor's reflection runs from the wheels
    // and is gone by their bar (in the target's pixels, from the bottom).
    fade.line = (h - copy.offsetTop) * ratio;
    fade.full = Math.max(fade.line + 24 * ratio, (h - fit.bounds.bottom) * ratio);
    render();
  }

  // Everything the light does at a playhead.
  const lamp = new THREE.Vector3();
  function light(p) {
    const roomUp = roomLevel(p), lamps = lampLevel(p);
    const mix = (a, b) => a + (b - a) * roomUp;
    scene.environmentIntensity = mix(LIGHT.environmentDark, LIGHT.environment);
    hemisphere.intensity = mix(LIGHT.hemisphereDark, LIGHT.hemisphere);
    key.intensity = mix(LIGHT.keyDark, LIGHT.key);
    fill.intensity = mix(LIGHT.fillDark, LIGHT.fill);
    rim.intensity = mix(LIGHT.rimDark, LIGHT.rim);
    ids.forEach((id, i) => {
      const bay = bays.get(id), own = bayLevel(p, i), level = Math.max(own, roomUp);
      bay.panel.intensity = level * mix(LIGHT.panelDark, LIGHT.panelLit);
      bay.pool.material.opacity = own * LIGHT.pool * (1 - roomUp);
      const entry = vehicles.get(id);
      if (!entry) return;
      entry.beams.forEach(beam => { beam.material.opacity = LIGHT.beam * Math.max(0, 1 - roomUp * 2.2); });
      // A lamp glares only towards the camera it faces; seen from the side
      // it dims, as a real one does.
      const yaw = marks[id].yaw;
      entry.flares.forEach(flare => {
        flare.getWorldPosition(lamp);
        const facing = (Math.sin(yaw) * (camera.position.x - lamp.x) + Math.cos(yaw) * (camera.position.z - lamp.z)) / Math.hypot(camera.position.x - lamp.x, camera.position.z - lamp.z);
        const f = Math.min(1, Math.max(0, (facing - .55) / .3));
        flare.material.opacity = lamps * LIGHT.flare * f * f * (3 - 2 * f);
      });
      entry.shadow.opacity = LIGHT.shadow * Math.max(.22, roomUp, own * .7);
      entry.car.setHeadlights(.25 + lamps * .75);
    });
    // The sign: lit throughout, its glow fading as the room comes up.
    signMark.opacity = signMark.map ? 1 : 0;
    signGlow.opacity = LIGHT.signGlow * (1 - roomUp);
    // The dark room: the cove brightens a little with every bay that comes
    // up; the gloss and the cove give way to the white.
    const lit = ids.reduce((sum, id, i) => sum + bayLevel(p, i), 0) / ids.length, dim = 1 - roomUp;
    cove.material.color.copy(coveColor).multiplyScalar(LIGHT.cove * (.5 + .5 * lit));
    cove.material.opacity = dim; cove.visible = dim > .002;
    wash.material.opacity = LIGHT.wash * (.45 + .55 * lit) * dim;
    if (floor) {
      const { uniforms } = floor.material;
      uniforms.gloss.value = LIGHT.gloss + (LIGHT.glossLit - LIGHT.gloss) * roomUp;
      uniforms.room.value = roomUp * shown.value;
      // In the dark the reflection runs to the foot of the screen; as the
      // words come it draws back from their bar.
      uniforms.fade.value.set(fade.line * roomUp - 1, Math.max(fade.line * roomUp, fade.full * roomUp));
    }
    // The room itself, from black to the white of the page, and the header
    // with it. The light floods out from behind the cars first, then fills
    // the room, rather than the whole room greying at once. Written only when
    // it changes: a new background repaints the whole section.
    const up = roomUp * shown.value;
    const flooding = `${Math.min(1, up * 2.4).toFixed(3)}|${(.32 + 2.9 * up ** 1.25).toFixed(3)}`;
    if (flood && flooding !== floodState) { floodState = flooding; const [o, k] = flooding.split('|'); flood.style.opacity = o; flood.style.transform = `scale(${k})`; }
    const tone = 1 - (1 - roomUp ** 2.4) * shown.value;
    const color = `rgb(${DARK.map((c, i) => Math.round(c + (WHITE[i] - c) * tone)).join(',')})`;
    if (color !== background) { background = color; section.style.backgroundColor = color; }
    const isDark = shown.value > .5 && roomUp < .5;
    if (isDark !== dark) { dark = isDark; section.classList.toggle('is-dark', dark); document.dispatchEvent(new CustomEvent('stage:tone')); }
  }

  // The words: the coachline draws out from the middle, the headline's lines
  // rise out of their masks, then the line beside it and the action.
  const words = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .fromTo(copy, { '--rule': 0 }, { '--rule': 1, duration: 1.4, ease: 'expo.inOut' }, 0)
    .fromTo(copy.querySelectorAll('.fl-line > span'), { yPercent: 135, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.25, stagger: .09 }, .18)
    .fromTo(copy.querySelectorAll('.fleet-note, .fleet-actions'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, stagger: .08 }, .42);
  let wordsShown = false;
  const showWords = on => { if (on === wordsShown) return; wordsShown = on; on ? words.timeScale(1).play() : words.timeScale(1.8).reverse(); };

  function render() {
    if (disposed) return;
    const p = playhead.progress;
    // The camera's own framing while it tracks; the fitted frame as it
    // swings back to see them all.
    const t = smooth(interval(p, LIGHTS.room[0], LIGHTS.anchor));
    frameCamera(camera, paths[view](p), size.w, size.h, { zoom: 1 + (fit.zoom - 1) * t, offset: fit.offset.map(v => v * t) });
    light(p);
    // With the stills standing in, the words are set as soon as the stage is
    // well into view.
    showWords(p >= LIGHTS.words || (shown.value < .5 && p > .12));
    invalidate();
    if (import.meta.env.DEV) window.__fleetProgress = p;
  }

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
  function scrollTo(progress = LIGHTS.anchor, instant = false) {
    const smoother = ScrollSmoother.get(), y = scrollPosition(progress);
    if (smoother) smoother.scrollTo(y, !instant); else window.scrollTo({ top: y, behavior: instant ? 'instant' : 'smooth' });
  }

  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  async function load() {
    const loader = new THREE.TextureLoader();
    await Promise.all(lightsVehicles.map(async ({ id, paint }) => {
      const item = showcase.find(entry => entry.id === id);
      // Each car wears Baba's dealer plates, as the film's GLS does.
      const spec = { ...models[id], partMap: vehicleParts[id] };
      const [car, shadowTexture] = await Promise.all([loadCar(spec, paint ?? item.paint, { invalidate }), loader.loadAsync(spec.shadow)]);
      textures.push(shadowTexture);
      if (disposed) return;
      filterTexture(shadowTexture, anisotropy);
      const filtered = new Set();
      car.root.traverse(node => {
        if (!node.isMesh) return;
        for (const material of [node.material].flat()) {
          // Dither the final display values, not the low light HDR values.
          if (hdr) material.dithering = false;
          for (const value of Object.values(material)) {
            if (!value?.isTexture || filtered.has(value)) continue;
            filtered.add(value); filterTexture(value, anisotropy);
          }
          // Three's derivative-based geometric roughness and the paint's
          // subpixel flake filtering stay active. Give lacquer a small
          // roughness floor as well, so tiny highlights remain stable.
          if (material.clearcoat > 0) material.clearcoatRoughness = Math.max(material.clearcoatRoughness, .07);
        }
      });
      const holder = new THREE.Group();
      const shadow = new THREE.MeshBasicMaterial({ color: '#2a251e', alphaMap: shadowTexture, transparent: true, opacity: 0, depthWrite: false, dithering: !hdr });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), shadow);
      ground.rotation.x = -Math.PI / 2; ground.position.y = .004; ground.renderOrder = 1; ground.layers.set(DECALS);
      // Headlamps: a flare at each lamp, and its beam on the floor ahead.
      const { headlamps, size: [, , length] } = vehicleParts[id];
      const flares = lampAnchors(car, headlamps).map(position => { const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); flare.position.copy(position); flare.position.z += .025; flare.scale.setScalar(.45); flare.renderOrder = 4; return flare; });
      const beams = headlamps.map(([x]) => { const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7.5), glow(beamTexture)); beam.rotation.x = -Math.PI / 2; beam.position.set(x * 1.15, .007, length / 2 + 3.55); beam.renderOrder = 0; beam.layers.set(DECALS); return beam; });
      holder.add(car.root, ground, ...flares, ...beams);
      car.setCabinLight(.55);
      car.root.traverse(node => { if (node.isRectAreaLight) node.visible = false; });
      vehicles.set(id, { car, holder, shadow, flares, beams });
      scene.add(holder);
    }));
    if (disposed) return;
    place();
    render();
    await studio;
    if (disposed) return;
    await warm();
    if (disposed) return;
    ready = true;
    // Arriving unseen, the cars are simply there; arriving in view, the
    // stills give way to them as the canvas fades in (fleet.css).
    if (active) gsap.to(shown, { value: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: render });
    else shown.value = 1;
    render();
  }
  // Everything the first frames need, a little at a time, while the film
  // still plays above: each car's programs, compiled for the HDR target they
  // really draw into (studio-output.js), then its textures, uploaded a few a
  // frame; then the room's own pieces and the filter passes. Without this the
  // first frame in view built every program and uploaded every texture at
  // once, freezing the page just as the visitor scrolled into the section.
  async function warm() {
    for (const { holder } of vehicles.values()) {
      await output.compile(holder, camera, scene);
      if (disposed) return;
      await upload(holder);
      if (disposed) return;
    }
    await output.compile(scene, camera);
    if (!disposed) await upload(scene);
  }
  async function upload(root) {
    const maps = new Set();
    root.traverse(node => [node.material].flat().forEach(material => material && Object.values(material).forEach(value => { if (value?.isTexture) maps.add(value); })));
    let n = 0;
    for (const texture of maps) {
      renderer.initTexture(texture);
      if (++n % 4 === 0) { await nextFrame(); if (disposed) return; }
    }
    await nextFrame();
  }
  const loaded = load().catch(error => { console.error('The lights-on drive is unavailable; keeping the stills.', error); shown.value = 0; render(); });

  const resizeObserver = new ResizeObserver(() => { if (!disposed) layout(); });
  resizeObserver.observe(canvas); resizeObserver.observe(copy);
  const onVisible = () => { if (!document.hidden) invalidate(); };
  document.addEventListener('visibilitychange', onVisible);
  const onLost = event => { event.preventDefault(); ready = false; rendered = false; stage.classList.remove('is-rendered'); gsap.killTweensOf(shown); shown.value = 0; render(); };
  canvas.addEventListener('webglcontextlost', onLost);
  layout();

  const api = {
    loaded,
    scrollTo,
    snapshot: () => ({
      ready, rendered, active, progress: playhead.progress, view, dark,
      vehicles: ids.filter(id => vehicles.has(id)).map(id => ({ id, position: vehicles.get(id).holder.position.toArray() })),
      lights: ids.map((id, i) => +bayLevel(playhead.progress, i).toFixed(3)),
      words: wordsShown, pinned: pin.isActive,
      quality: { ...output.quality, anisotropy, pixelRatio: ratio },
    }),
    setProgress(p) { playhead.progress = p; render(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); gsap.killTweensOf(shown);
      words.kill(); pin.kill(true); timeline.scrollTrigger?.kill(); timeline.kill();
      resizeObserver.disconnect(); document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost);
      section.classList.remove('is-drive', 'is-lights', 'is-dark'); stage.classList.remove('is-rendered');
      section.style.removeProperty('background-color');
      flood?.removeAttribute('style');
      floor?.getRenderTarget().dispose();
      gsap.set(copy.querySelectorAll('.fl-line > span, .fleet-note, .fleet-actions'), { clearProps: 'all' });
      copy.style.removeProperty('--rule');
      dust?.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) [o.material].flat().forEach(m => materials.add(m)); });
      materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
      output.dispose(); environment.dispose(); renderer.dispose();
      document.dispatchEvent(new CustomEvent('stage:tone'));
      if (import.meta.env.DEV) delete window.__fleet;
    },
  };
  if (import.meta.env.DEV) window.__fleet = {
    snapshot: api.snapshot, setProgress: api.setProgress, scrollTo: p => scrollTo(p, true),
    tune(values) { Object.assign(LIGHT, values); renderer.toneMappingExposure = LIGHT.exposure; scene.environmentRotation.y = LIGHT.rotation; render(); return { ...LIGHT }; },
    // The gloss floor on or off, to weigh its cost.
    reflection(on) { if (floor) { floor.visible = on; render(); } return Boolean(floor?.visible); },
  };
  return api;
}
