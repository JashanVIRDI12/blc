import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { loadCar } from './car.js';
import { models } from './models.js';
import { vehicleParts } from './vehicle-parts.js';
import { showcase, filmVehicles } from './config.js';
import { loadStudio } from './studio-environment.js';
import { showroomRoom } from './showroom-room.js';
import { createVehicleLighting } from './vehicle-lighting.js';
import { createTypePlane } from './type-plane.js';
import { createRenderDensity } from './render-density.js';

// Draw order: the room, then the film's headlines, then the cars. A car that
// crosses a headline passes in front of it; the room never covers the type.
const ROOM = 0, CARS = 1;

// The room's lights are unshadowed, so on their own they would also light the
// floor and cars beyond the doorways. Fade everything outside the walls into
// the dark instead: cars arrive from, and leave into, darkness. Only the
// film's exponential fog does this; linear fog (the white About studio in
// about-drive.js) stays plain.
if (!THREE.ShaderChunk.fog_fragment.includes('showroomOutside')) {
  THREE.ShaderChunk.fog_pars_vertex += '\n#ifdef USE_FOG\nvarying vec3 vFogWorld;\n#endif\n';
  THREE.ShaderChunk.fog_vertex += '\n#ifdef USE_FOG\nvFogWorld=cameraPosition+mvPosition.xyz*mat3(viewMatrix);\n#endif\n';
  THREE.ShaderChunk.fog_pars_fragment += '\n#ifdef USE_FOG\nvarying vec3 vFogWorld;\n#endif\n';
  THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix(',
    `#ifdef FOG_EXP2
    float showroomOutside=max(abs(vFogWorld.x),abs(vFogWorld.z))-${(showroomRoom.wall.inner + .1).toFixed(3)};
    fogFactor=max(fogFactor,smoothstep(0.0,7.0,showroomOutside));
    #endif
    gl_FragColor.rgb = mix(`);
}

export function createShowroom(canvas, onFailure) {
  const mobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // A colour background clears on every render call; clear once per frame.
  renderer.autoClear = false; renderer.info.autoReset = false;
  renderer.setClearColor('#090c0d', 1);
  const type = createTypePlane(renderer);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#090c0d', .011);
  scene.environmentRotation.y = 0;
  const camera = new THREE.PerspectiveCamera(34, 1, .06, 180);
  camera.position.set(7, 1.9, 10);
  camera.lookAt(0, .9, 0);
  RectAreaLightUniformsLib.init();
  const lights = [];
  const area = (color, intensity, w, h, pos, target) => {
    const light = new THREE.RectAreaLight(color, intensity, w, h);
    light.position.set(...pos); light.lookAt(...target);
    light.userData.power = intensity; light.layers.enableAll();
    scene.add(light); lights.push(light);
    return light;
  };
  // The luminous ceiling is the one area light: a broad panel over the
  // inspection mark. The room itself, captured into the environment map,
  // supplies the reflected panel grid and the bounce from the walls; the
  // hemisphere adds their soft diffuse fill. Every area light is shaded for
  // every pixel of the car, so the walls carry none: this is what lets the
  // film scroll at full resolution. No area light may stand across a doorway,
  // where a passing car would be lit hard on one side of its plane only.
  const low = showroomRoom.ceiling - .06;
  area(0xfff6ea, 1.15, 13, 15, [0, low, 0], [0, 0, 0]);
  const fill = new THREE.HemisphereLight(0xe6e2d9, 0x17191b, .25);
  fill.layers.enableAll();
  scene.add(fill);

  // Polished black stone floor. It continues past the doorways into the
  // dark. Dithered: the dark floor's light and shadow falloffs span only a
  // few 8-bit levels and would otherwise band.
  const polished = new THREE.MeshPhysicalMaterial({ color: 0x111214, metalness: 0, roughness: .27, specularIntensity: .4, dithering: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), polished);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.025;
  scene.add(floor);

  // A low-resolution, softly sampled floor reflection. Portrait devices use
  // the PBR floor alone. The reflection never replaces the contact shadow.
  let mirror;
  if (!mobile) {
    const shader = {
      uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
      vertexShader: Reflector.ReflectorShader.vertexShader,
      fragmentShader: `#include <common>
        #include <dithering_pars_fragment>
        uniform sampler2D tDiffuse; varying vec4 vUv;
        void main() {
          vec2 uv=vUv.xy/vUv.w; vec2 d=vec2(.005,.008);
          vec3 c=texture2D(tDiffuse,uv).rgb*.28;
          c+=texture2D(tDiffuse,uv+d).rgb*.18;
          c+=texture2D(tDiffuse,uv-d).rgb*.18;
          c+=texture2D(tDiffuse,uv+vec2(d.x,-d.y)).rgb*.18;
          c+=texture2D(tDiffuse,uv+vec2(-d.x,d.y)).rgb*.18;
          gl_FragColor=vec4(c,.16);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <dithering_fragment>
        }`,
    };
    mirror = new Reflector(new THREE.PlaneGeometry(2*showroomRoom.wall.inner, 2*showroomRoom.wall.inner), { textureWidth: 768, textureHeight: 512, multisample: 0, clipBias: .002, shader });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = .002;
    mirror.material.transparent = true;
    mirror.material.depthWrite = false;
    mirror.material.dithering = true;
    mirror.renderOrder = 0;
    // The reflection shows the cars as well as the room.
    mirror.getReflectionCamera(camera).layers.enableAll();
    scene.add(mirror);
  }

  let studio;

  const vehicles = new Map();
  const lampCanvas = document.createElement('canvas');
  lampCanvas.width = lampCanvas.height = 64;
  const lampContext = lampCanvas.getContext('2d');
  const gradient = lampContext.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,250,234,1)');
  gradient.addColorStop(.12,'rgba(255,249,232,.8)');
  gradient.addColorStop(.35,'rgba(255,249,232,.13)');
  gradient.addColorStop(1,'rgba(255,249,232,0)');
  lampContext.fillStyle=gradient;lampContext.fillRect(0,0,64,64);
  const lampTexture = new THREE.CanvasTexture(lampCanvas);
  const direction = new THREE.Vector3();
  let size = { w: 1, h: 1 }, frame, enabled = true, dirty = true, disposed = false;
  // Pointer depth (fine pointers): the camera eases a little around its
  // subject; the headline plane, set behind the subject, shifts less than the
  // room. Touch and keyboard visitors get the same film without it.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const base = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const axis = new THREE.Vector3(), probe = new THREE.Vector3();
  let tethers = [];
  let raf = 0;
  // One density, moving or still, so the picture never softens while
  // scrolling (render-density.js: native up to 2x, desktop supersampled
  // towards 2x). A device that cannot keep up first loses the floor
  // reflection, then steps its density down for good: once, not back and
  // forth.
  const density = createRenderDensity({ mobile });
  let ratio = density.ratio(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
  let headings = null;
  const invalidate = () => { dirty = true; schedule(); };
  function schedule() { if (!raf && enabled && !document.hidden && !disposed) raf = requestAnimationFrame(draw); }
  function draw(now) {
    raf = 0;
    if (!dirty || !enabled || disposed) return;
    dirty = false;
    if (density.slow(now)) {
      if (mirror?.visible) mirror.visible = false;
      else if (density.step(size.w, size.h)) {
        ratio = density.ratio(size.w, size.h);
        renderer.setPixelRatio(ratio); renderer.setSize(size.w, size.h, false);
        // Headlines are rasterised texel for pixel at the canvas density.
        if (headings) type.layout(headings, canvas.getBoundingClientRect());
      }
    }
    pointer.x += (pointer.tx - pointer.x) * .075; pointer.y += (pointer.ty - pointer.y) * .075;
    if (Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > .0005) { dirty = true; schedule(); }
    aim();
    renderer.info.reset(); renderer.clear();
    camera.layers.set(ROOM); renderer.render(scene, camera);
    type.render(false);
    camera.layers.set(CARS); renderer.render(scene, camera);
    type.render(true);
    camera.layers.enableAll();
    placeTethers();
  }
  // Looking around by hand: the shot turns about the parked car by `orbit`
  // radians. The camera keeps clear of the body and of the open driver's door
  // (on the car's left, +X), and inside the walls.
  let orbit = 0;
  const shot = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  function orbitShot() {
    shot.position.copy(base.position); shot.target.copy(base.target);
    const holder = vehicles.get(filmVehicles.first)?.holder;
    if (!orbit || !holder) return;
    const pivot = holder.position, c = Math.cos(orbit), s = Math.sin(orbit);
    for (const v of [shot.position, shot.target]) {
      const x = v.x - pivot.x, z = v.z - pivot.z;
      v.x = pivot.x + x * c + z * s; v.z = pivot.z - x * s + z * c;
    }
    if (shot.position.y < 2.3) {
      const yaw = holder.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw);
      const wx = shot.position.x - pivot.x, wz = shot.position.z - pivot.z;
      const lx = wx * cy - wz * sy, lz = wx * sy + wz * cy, r = Math.hypot(lx, lz) || 1;
      const halfWidth = (lx > 0 ? 1.15 + (frame?.door ?? 0) * 1.05 : 1.15) + .7, halfLength = 2.9 + .7;
      const clear = Math.min(halfWidth / Math.max(Math.abs(lx) / r, 1e-3), halfLength / Math.max(Math.abs(lz) / r, 1e-3));
      if (r < clear) { shot.position.x = pivot.x + wx / r * clear; shot.position.z = pivot.z + wz / r * clear; }
    }
    const wall = showroomRoom.wall.inner - .6;
    shot.position.x = THREE.MathUtils.clamp(shot.position.x, -wall, wall);
    shot.position.z = THREE.MathUtils.clamp(shot.position.z, -wall, wall);
  }
  function aim() {
    orbitShot();
    camera.position.copy(shot.position); camera.lookAt(shot.target);
    const reach = THREE.MathUtils.clamp(shot.position.distanceTo(shot.target) / 8, .2, 1);
    camera.position.addScaledVector(axis.set(1, 0, 0).applyQuaternion(camera.quaternion), pointer.x * .34 * reach);
    camera.position.addScaledVector(axis.set(0, 1, 0).applyQuaternion(camera.quaternion), -pointer.y * .16 * reach);
    camera.lookAt(shot.target);
    camera.updateMatrixWorld();
    // The type sits about 60% further away than the subject.
    const focal = size.h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const depth = (1 - 1 / 1.6) / Math.max(shot.position.distanceTo(shot.target), 1) * focal;
    type.setOffset(pointer.x * .34 * reach * depth, -pointer.y * .16 * reach * depth);
  }
  // Labels tethered to points on a car, re-projected every frame.
  function placeTethers() {
    for (const tether of tethers) {
      const entry = vehicles.get(tether.id);
      if (!entry || tether.alpha <= 0) { tether.element.style.opacity = 0; continue; }
      probe.set(...tether.point);
      entry.car.root.localToWorld(probe);
      const distance = probe.distanceTo(camera.position);
      probe.project(camera);
      const onScreen = probe.z < 1 && Math.abs(probe.x) < 1.1 && Math.abs(probe.y) < 1.1;
      tether.element.style.opacity = onScreen ? tether.alpha : 0;
      const x = (probe.x + 1) / 2 * size.w, y = (1 - probe.y) / 2 * size.h;
      tether.element.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      // Keep the label on screen: flip it away from a near edge.
      const prefer = tether.element.dataset.prefer ??= tether.element.dataset.side || 'right';
      const side = x > size.w - 170 ? 'left' : x < 170 ? 'right' : prefer;
      if (tether.element.dataset.side !== side) tether.element.dataset.side = side;
      tether.element.dataset.near = distance < 3.2 ? 'true' : 'false';
    }
  }
  const finePointer = matchMedia('(pointer: fine)').matches && !mobile;
  const onPointer = event => {
    pointer.tx = THREE.MathUtils.clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
    pointer.ty = THREE.MathUtils.clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
    invalidate();
  };
  const onPointerLeave = () => { pointer.tx = pointer.ty = 0; invalidate(); };
  if (finePointer) { addEventListener('pointermove', onPointer, { passive: true }); document.documentElement.addEventListener('pointerleave', onPointerLeave); }
  function resize() {
    size = { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
    ratio = density.ratio(size.w, size.h);
    renderer.setPixelRatio(ratio); renderer.setSize(size.w, size.h, false);
    if (frame) setFrame(frame); else { camera.aspect = size.w/size.h; camera.updateProjectionMatrix(); }
    invalidate();
  }
  function setFrame(next) {
    frame = next;
    const { shot, motion, light, cabin, bonnet, door } = next;
    base.position.set(...shot.position); base.target.set(...shot.target);
    camera.fov = shot.fov; camera.near = cabin ? .025 : .08;
    camera.aspect = size.w / size.h;
    camera.setViewOffset(size.w, size.h, -shot.offset[0]*size.w, -shot.offset[1]*size.h, size.w, size.h);
    camera.updateProjectionMatrix();
    aim();
    if (next.type) type.update(next.type);
    if (next.tethers) tethers = next.tethers;
    renderer.toneMappingExposure = cabin ? 1.08 : 1.0;
    scene.environmentIntensity = .012 + light * .56;
    lights.forEach(l => { l.intensity = l.userData.power * light * (cabin ? .45 : 1); });
    fill.intensity = .012 + light * (cabin ? .62 : .5);
    studio?.setLight(light);
    for (const [id, entry] of vehicles) {
      const state = motion[id];
      entry.holder.position.set(...state.position);
      entry.holder.rotation.y = state.yaw;
      entry.holder.visible = state.visible;
      entry.car.applyMotion(state.distance, state.steer, state.pitch);
      entry.car.setCabinLight(light*(id===filmVehicles.first ? .32+door*.45 : .23));
      updateVehicleLights(entry, state.presence);
    }
    const first = vehicles.get(filmVehicles.first)?.car;
    if (first?.spec.partMap.supports.engine) first.setOpenProgress(first.spec.partMap.bonnet, bonnet);
    first?.setOpenProgress(first.spec.partMap.doors[0], door);
    invalidate();
  }
  function updateVehicleLights(entry, presence=1) {
    const level=(.5+(frame?.light??1)*.3)*presence;
    direction.copy(camera.position).sub(entry.holder.position).normalize();
    const yaw=entry.holder.rotation.y;
    const alignment=direction.x*Math.sin(yaw)+direction.z*Math.cos(yaw);
    const facing=Math.max(0,alignment);
    entry.lighting.setLevel(level,false,Math.max(0,-alignment),camera.position.distanceTo(entry.holder.position));
    entry.lamps.forEach(lamp=>{lamp.material.opacity=facing*facing*.52*level;});
  }
  const onVisibility = () => { if (!document.hidden) invalidate(); };
  const onContextLost = event => { event.preventDefault(); onFailure?.(); };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resize();

  async function load(onProgress) {
    const ids = Object.values(filmVehicles);
    const progress = Object.fromEntries([['env', 0], ...ids.map(id => [id, 0])]);
    const report = (id, value) => { progress[id] = value; onProgress((progress.env*.2 + ids.reduce((sum, v) => sum + progress[v], 0)*.8/ids.length)*.95); };
    const textureLoader = new THREE.TextureLoader();
    const envTask = new EXRLoader().loadAsync('/env/studio-1k.exr').then(async env => {
      if (disposed) { env.dispose(); return; }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const bounce = pmrem.fromEquirectangular(env);
      env.dispose(); pmrem.dispose(); report('env', .4);
      studio = await loadStudio(renderer, scene, bounce.texture, p => report('env', .4+p*.5));
      bounce.dispose();
      if (disposed) { studio.target.dispose(); return; }
      scene.environment = studio.target.texture;
      scene.userData.environmentTarget = studio.target;
      studio.setLight(frame?.light ?? 0);
      report('env', 1);
    });
    const selected = ids.map(id=>{
      const item=showcase.find(entry=>entry.id===id);
      if(!item || !models[id] || !vehicleParts[id]) throw new Error(`Missing showcase configuration for ${id}`);
      return item;
    });
    const carTasks = selected.map(async item => {
      const spec = { ...models[item.id], partMap: vehicleParts[item.id] };
      const [car, shadowTexture] = await Promise.all([
        loadCar(spec, item.paint, { invalidate, onProgress: p => report(item.id, p*.9) }),
        textureLoader.loadAsync(spec.shadow),
      ]);
      const holder = new THREE.Group();
      // Sharp at grazing angles, so the shadow never shimmers as the camera moves.
      shadowTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTexture, transparent: true, opacity: .78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, dithering: true }));
      shadow.rotation.x = -Math.PI/2; shadow.position.y = .005; shadow.renderOrder = 1;
      holder.add(car.root, shadow);
      const lamps=vehicleParts[item.id].headlamps.map(position=>{
        const lamp=new THREE.Sprite(new THREE.SpriteMaterial({map:lampTexture,color:0xfff5df,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false}));
        lamp.position.set(...position);lamp.scale.set(.22,.22,1);holder.add(lamp);return lamp;
      });
      if (!spec.ambient.preserveOriginal) {
        car.setAmbientColor('#b4a28b'); car.setAmbient(.03);
      }
      holder.position.set(...(frame?.motion[item.id]?.position ?? [0,0,-100]));
      const lighting=createVehicleLighting(holder,car,vehicleParts[item.id]);
      vehicles.set(item.id, { car, holder, lamps, lighting });
      // Cars draw after the type; the floor shadow and lamp pools stay with the room.
      holder.traverse(node => {
        if (node.isLight) node.layers.enableAll();
        else if (node !== shadow && !node.userData.floorDecal) node.layers.set(CARS);
      });
      scene.add(holder); report(item.id, 1);
    });
    await Promise.all([envTask, ...carTasks]);
    if (disposed) return;
    if (frame) setFrame(frame);
    camera.layers.enableAll();
    await renderer.compileAsync(scene, camera);
    onProgress(1); invalidate();
  }
  function dispose() {
    disposed = true; cancelAnimationFrame(raf); observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('pointermove', onPointer); document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    type.dispose();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
    materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
    mirror?.dispose(); scene.userData.environmentTarget?.dispose(); renderer.dispose();
  }
  function viewSurface() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0,0), camera); ray.layers.enableAll();
    const hit = ray.intersectObjects([...vehicles.values()].map(v=>v.car.root), true)[0];
    if (!hit) return null;
    const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face.materialIndex] : hit.object.material;
    return { distance: hit.distance, material: material.name };
  }
  return {
    load, setFrame, resize, dispose,
    // Film headlines: [{ id, element, color, front }]. Behind the cars unless `front`.
    layoutType(next) { headings = next; type.layout(headings, canvas.getBoundingClientRect()); invalidate(); },
    typeLines: id => type.lineCount(id),
    setActive(value) { enabled = value; if (value) invalidate(); },
    // Radians the shot is turned about the parked car; applied by setFrame.
    setOrbit(value) { orbit = value; },
    snapshot: () => ({ orbit, type: type.snapshot(), pointer: { x: pointer.x, y: pointer.y }, studio: Boolean(studio), viewSurface: viewSurface(), camera: camera.position.toArray(), target: frame?.shot.target, dpr: ratio, render: { ...renderer.info.render }, vehicles: [...vehicles].map(([id, v]) => ({ id, position: v.holder.position.toArray(), yaw: v.holder.rotation.y, scale: v.holder.scale.toArray(), wheel: v.car.wheels[0].rotation.x, steer: v.car.wheels[0].parent.rotation.y, visible: v.holder.visible, door:v.car.root.getObjectByName('Door_FL')?.rotation.y??0, lights:v.lighting.snapshot(), screens: v.car.cabin.screens.map(m=>({name:m.name,lit:m.emissiveIntensity,texture:Boolean(m.emissiveMap)})) })) }),
  };
}
