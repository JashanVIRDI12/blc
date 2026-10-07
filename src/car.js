import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import gsap from "gsap";
import { createAmbient } from "./ambient.js";
import { createCabin } from "./cabin.js";
import { applyTwoTone, carPaint, prepareTwoTone } from './paint.js';
import { mountPlates } from './plates.js';
import { addStarBadges } from './badges.js';
import { glassFinish } from './glass.js';
import { addLampGlow } from './lamp-glow.js';

const WHEELS = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"];

// Base coat under the lacquer (paint.js adds flakes, flop and orange peel).
// The roughness is the flakes' average, seen from beyond a few metres. A
// solid base reflects little of its own: the lacquer does the shining.
const FINISH = {
  metallic: { metalness: 0.6, roughness: 0.32 },
  solid: { metalness: 0.0, roughness: 0.34, specularIntensity: 0.4 },
  // A matte ("Frozen") finish: satin lacquer, no gloss coat.
  matte: { metalness: 0.45, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5 },
};

const easeOpen = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Decode the compressed meshes on background threads, so a model arriving
// mid-scroll (the About cars load while the film plays) never stalls a frame.
MeshoptDecoder.useWorkers(Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)));
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// Some source meshes pack unrelated pieces under one material: the GLS's
// coolant tank shares a mesh with the bay's rubber seal. Give the disconnected
// pieces that lie wholly inside
// `box` (car space, metres; or any of several boxes) their own material,
// leaving the rest as it was. `inherit: true` keeps the original's texture
// under the new finish. Returns the new material, if any.
function splitPieces(root, { node: name, box, material: { inherit, ...look } }) {
  // GLTFLoader removes punctuation from imported node names, and numbers
  // repeated ones (`logo_chrome`, then `logo_chrome_1`).
  const node = root.getObjectByName(name);
  if (!node?.isMesh || !node.geometry.index) return;
  const geometry = node.geometry;
  const indices = geometry.index.array;
  const position = geometry.getAttribute('position');
  const parent = new Int32Array(position.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = value => {
    while (parent[value] !== value) {
      parent[value] = parent[parent[value]];
      value = parent[value];
    }
    return value;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const rootIndex = find(indices[i]);
    parent[find(indices[i + 1])] = rootIndex;
    parent[find(indices[i + 2])] = rootIndex;
  }
  const bounds = new Map();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const component = find(i);
    let box = bounds.get(component);
    if (!box) {
      box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      bounds.set(component, box);
    }
    point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
    for (let axis = 0; axis < 3; axis++) {
      const value = point.getComponent(axis);
      box.min[axis] = Math.min(box.min[axis], value);
      box.max[axis] = Math.max(box.max[axis], value);
    }
  }
  const boxes = [box].flat();
  const inside = new Set([...bounds].filter(([, piece]) => boxes.some(limits =>
    piece.min.every((v, axis) => v > limits.min[axis]) && piece.max.every((v, axis) => v < limits.max[axis]),
  )).map(([component]) => component));
  if (!inside.size) return;
  const rest = [], piece = [];
  for (let i = 0; i < indices.length; i += 3) {
    (inside.has(find(indices[i])) ? piece : rest).push(indices[i], indices[i + 1], indices[i + 2]);
  }
  if (!piece.length) return;
  geometry.setIndex(new THREE.BufferAttribute(new indices.constructor([...rest, ...piece]), 1));
  geometry.clearGroups();
  geometry.addGroup(0, rest.length, 0);
  geometry.addGroup(rest.length, piece.length, 1);
  node.material = [node.material, new THREE.MeshPhysicalMaterial({ ...look, ...(inherit ? { map: node.material.map } : {}) })];
  return node.material[1];
}

// Loads one car (a spec from models.js) and dresses it in its real-world
// materials and the paint it's for sale in. `invalidate` asks the studio for
// a redraw.
export async function loadCar(spec, paintSpec, { invalidate, onProgress }) {
  const gltf = await new Promise((resolve, reject) =>
    loader.load(spec.url, resolve, (e) => e.total && onProgress?.(e.loaded / e.total), reject),
  );
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintSpec.color),
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    side: THREE.DoubleSide,
    ...FINISH[paintSpec.finish],
  });
  if(paintSpec.upperColor)applyTwoTone(paint,paintSpec.upperColor);
  carPaint(paint, { metallic: paintSpec.finish !== 'solid' });
  const { material: rimOf, ...rimLook } = spec.rim ?? {};
  const rim = spec.rim && new THREE.MeshPhysicalMaterial(rimLook);
  const made = new Map();
  // Parts with a texture (baked interiors, tyres) keep it. `glass` parts
  // reflect at full strength over their tint (glass.js).
  const material = (name, original) => {
    if (!made.has(name)) {
      const { glass, ...look } = spec.parts[name];
      const finish = new THREE.MeshPhysicalMaterial({ name, map: original.map ?? null, ...look });
      made.set(name, glass ? glassFinish(finish) : finish);
    }
    return made.get(name);
  };

  const wheels = Object.values(spec.partMap?.wheels ?? WHEELS).map((n) => root.getObjectByName(n));
  if (wheels.some(w => !w)) throw new Error(`Missing audited wheel nodes in ${spec.url}`);
  root.traverse((node) => {
    if (!node.isMesh) return;
    const name = node.material.name;
    const onWheel = wheels.some((w) => w !== node && isInside(node, w));
    if (name === spec.paint) {
      if(paintSpec.upperColor)prepareTwoTone(node);
      node.material = paint;
    }
    else if (rim && name === rimOf && onWheel) node.material = rim;
    else if (spec.parts[name]) node.material = material(name, node.material);
    if (node.material.transparent) node.renderOrder = 2;
  });
  for (const piece of spec.pieces ?? []) {
    const split = splitPieces(root, piece);
    if (split) made.set(split.name, split);
  }
  if (spec.starBadges) addStarBadges(root, spec.starBadges);
  // Dither every surface: black paint and soft reflections fall away through
  // only a few 8-bit levels and would otherwise band. Filter textures
  // anisotropically: baked interiors and tyres are mostly seen at an angle,
  // where plain mipmapping smears them (three clamps to the GPU's maximum).
  root.traverse(node => {
    if (!node.isMesh) return;
    [node.material].flat().forEach(m => {
      m.dithering = true;
      for (const texture of [m.map, m.emissiveMap, m.normalMap, m.roughnessMap]) if (texture) texture.anisotropy = 8;
    });
  });

  const box = new THREE.Box3().setFromObject(wheels[0]);
  const wheelRadius = spec.partMap?.wheelRadius ?? (box.max.y - box.min.y) / 2;
  const drl = made.get(spec.drl);
  // Lit lamps glow beyond their edges (lamp-glow.js): the tail lamps' light
  // guides in red, the daytime running lights in a cool white.
  const rearLights = (spec.partMap?.rearLightMaterials ?? []).map(name => made.get(name)).filter(Boolean);
  const reflectors = (spec.partMap?.rearReflectorMaterials ?? []).map(name => made.get(name)).filter(Boolean);
  rearLights.forEach(material => addLampGlow(root, material, { color: '#ff2617', full: 5, spread: .018, strength: .6 }));
  if (drl) addLampGlow(root, drl, { color: '#e4ecff', full: 3, spread: .012, strength: .4 });

  // Everything that isn't a wheel sits on the suspension.
  const chassis = new THREE.Group();
  chassis.add(...root.children.filter((c) => !wheels.includes(c)));
  root.add(chassis);

  // Steering and rolling need different pivots. Preserve the audited hub
  // locations; only the wheel's local X axis rolls around that hub.
  const steering = wheels.slice(0, 2).map((wheel) => {
    const hub = new THREE.Group();
    hub.position.copy(wheel.position);
    root.add(hub);
    hub.add(wheel);
    wheel.position.set(0, 0, 0);
    return hub;
  });

  const parts = {};
  for (const [name, openSpec] of Object.entries(spec.openings)) {
    const node = root.getObjectByName(name);
    if (node) parts[name] = { node, ...openSpec, open: 0, tween: { value: 0 }, wanted: false };
  }
  const ambient = createAmbient(root, chassis, spec, made);
  const cabin = createCabin(root, chassis, spec);
  await mountPlates(chassis, spec.partMap?.plates);
  const pose = (name) => {
    const p = parts[name];
    p.open = easeOpen(p.tween.value);
    p.node.rotation[p.axis] = THREE.MathUtils.degToRad(p.angle) * p.open;
    invalidate();
  };

  return {
    root,
    spec,
    wheels,
    wheelRadius,
    chassis,
    cabin,
    setCabinLight(level) { cabin.setLevel(level); ambient.setLevel(.12+level*.88); },
    openings: Object.keys(parts),
    applyMotion(distance, steer, pitch) {
      const wheelbase = spec.partMap?.wheelbase ?? 3.1;
      const track = spec.partMap?.track ?? 1.65;
      const curvature = Math.tan(steer) / wheelbase;
      steering.forEach((hub, i) => {
        const side = i === 0 ? 1 : -1;
        hub.rotation.y = Math.atan(wheelbase * curvature / (1 - side * track * curvature / 2));
      });
      wheels.forEach(wheel => { wheel.rotation.x = distance / wheelRadius; });
      chassis.rotation.x = pitch;
    },
    setHeadlights(level) {
      if (drl) drl.emissiveIntensity = level * 3;
      for(const [name,full] of Object.entries(spec.partMap?.projectorMaterials??{})) {
        const material=made.get(name);
        if(material)material.emissiveIntensity=level*full;
      }
    },
    // LED light guides run hot: at full output the core of each guide
    // overexposes towards orange-white, as it does on camera. The chrome
    // reflectors behind them catch their light.
    setTaillights(level) {
      rearLights.forEach(material=>{material.emissive.set('#ff1426');material.emissiveIntensity=level*5;});
      reflectors.forEach(material=>{material.emissiveIntensity=level*.35;});
    },
    lightState:()=>({headlight:drl?.emissiveIntensity??0,taillights:(spec.partMap?.rearLightMaterials??[]).map(name=>made.get(name)?.emissiveIntensity??0)}),

    // Contour lighting: 0 = daylight glow, 1 = full, with the studio dark.
    setAmbient(level) {
      ambient.setLevel(level);
      invalidate();
    },
    setAmbientColor(hex) {
      ambient.setColor(hex);
      invalidate();
    },
    get ambientLevel() {
      return ambient.level;
    },

    // Daytime running lights off, then a quick double blink on, like a car
    // being unlocked.
    wake() {
      if (!drl) return gsap.timeline();
      const full = spec.parts[spec.drl].emissiveIntensity;
      return gsap
        .timeline({ onUpdate: invalidate })
        .set(drl, { emissiveIntensity: 0 })
        .to(drl, { emissiveIntensity: full, duration: 0.08 }, 0.1)
        .to(drl, { emissiveIntensity: 0.2, duration: 0.12 })
        .to(drl, { emissiveIntensity: full, duration: 0.5, ease: "power2.out" });
    },
    lightsOff() {
      if (drl) drl.emissiveIntensity = 0;
      invalidate();
    },

    // Open or shut a part; names this car doesn't have are ignored.
    setOpen(name, open, instant = false) {
      const p = parts[name];
      if (!p) return;
      p.wanted = open;
      gsap.to(p.tween, { value: open ? 1 : 0, duration: instant ? 0 : 1.1, ease: "none", overwrite: true, onUpdate: () => pose(name) });
      document.dispatchEvent(new CustomEvent("car:parts"));
    },
    // Direct control for the scroll-linked cabin move; it reverses exactly
    // with the scrollbar instead of running a separate timed animation.
    setOpenProgress(name, value) {
      const p = parts[name];
      if (!p || Math.abs(p.tween.value - value) < .00001) return;
      gsap.killTweensOf(p.tween);
      p.tween.value = THREE.MathUtils.clamp(value, 0, 1);
      p.wanted = p.tween.value > 0.5;
      pose(name);
    },
    toggle(name) {
      if (!parts[name]) return false;
      this.setOpen(name, !parts[name].wanted);
      return parts[name].wanted;
    },
    // Open exactly these parts and shut the rest.
    openOnly(names, instant = false) {
      for (const name of Object.keys(parts)) {
        const want = names.includes(name);
        if (parts[name].wanted !== want) this.setOpen(name, want, instant);
      }
    },
    closeAll(instant = false) {
      this.openOnly([], instant);
    },
    isOpen: (name) => parts[name]?.wanted ?? false,

    // Which opening part (if any) a ray hits first.
    pick(raycaster) {
      const hit = raycaster.intersectObject(root, true).find((h) => h.object.visible);
      for (let o = hit?.object; o; o = o.parent) if (parts[o.name]) return o.name;
      return null;
    },
  };
}

function isInside(node, ancestor) {
  for (let o = node.parent; o; o = o.parent) if (o === ancestor) return true;
  return false;
}
