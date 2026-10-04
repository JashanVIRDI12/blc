import * as THREE from "three";

const STRIP_RADIUS = 0.0028; // metres
const HALO_RADIUS = 0.009;
const STEP = 0.035; // metres between samples along a strip
const LIFT = 0.006; // how far a strip stands off the trim it's laid on
const LIGHT_POWER = 0.2; // candela at full brightness
const LIGHT_REACH = 0.9; // metres

// Contour lighting inside the car: thin strips of light along the dashboard
// and door cards, and small lights next to them that throw their colour onto
// the leather around. The GLS model came with its strips; for other cars
// they're laid by casting rays onto the trim (spec.ambient in models.js).
//
// level 0..1 is how bright it all is: dim in daylight, full with the studio
// lights down. Strips and lights hang off `body` (the car on its suspension);
// door strips off their doors.
export function createAmbient(root, body, spec, made) {
  const cfg = spec.ambient;
  // Keep the authored hue and geometry, but let the real strips emit light.
  if (cfg.preserveOriginal) {
    const originals = new Set();
    root.traverse(o => { if (o.isMesh && o.material.name === cfg.material) originals.add(o.material); });
    const tint = [...originals][0]?.color.clone() ?? new THREE.Color('#995cff');
    const lamps = [[0,.8,.52],[0,.52,-.12]].map(position=>{
      const lamp=new THREE.PointLight(tint,0,1.1,2);lamp.position.set(...position);body.add(lamp);return lamp;
    });
    let level=0;
    return {
      get level() { return level; },
      setLevel(value) {
        level=THREE.MathUtils.clamp(value,0,1);
        originals.forEach(m=>{m.emissive.copy(tint);m.emissiveIntensity=.25+level*.8;});
        lamps.forEach(lamp=>{lamp.intensity=.2*level;});
      },
      setColor() {},
    };
  }
  const color = new THREE.Color(cfg.color ?? "#ffb45a");
  const glow = new THREE.MeshBasicMaterial({ color: color.clone(), toneMapped: false });
  const halo = new THREE.MeshBasicMaterial({
    color: color.clone(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const builtIn = cfg.material ? made.get(cfg.material) : null;

  if (cfg.dash || cfg.doors) layStrips(root, body, cfg, glow, halo);

  const lights = (cfg.lights ?? []).map((p) => {
    const light = new THREE.PointLight(color, 0, LIGHT_REACH, 2);
    light.position.set(...p);
    body.add(light);
    return light;
  });

  let level = 0;
  const tint = color.clone();
  function apply() {
    glow.color.copy(tint).multiplyScalar(0.25 + 0.75 * level);
    halo.color.copy(tint);
    halo.opacity = 0.05 + 0.4 * level;
    if (builtIn) {
      builtIn.color.copy(tint);
      builtIn.emissive.copy(tint);
      builtIn.emissiveIntensity = 0.6 + 3.4 * level;
    }
    for (const l of lights) {
      l.color.copy(tint);
      l.intensity = LIGHT_POWER * level * level;
    }
  }
  apply();

  return {
    get level() {
      return level;
    },
    setLevel(t) {
      level = t;
      apply();
    },
    setColor(hex) {
      tint.set(hex);
      apply();
    },
  };
}

// Strips follow the trim: along the dash at a set height, and along each
// door card, fixed to the door so they swing open with it.
function layStrips(root, body, cfg, glow, halo) {
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const meshesOf = (material, within = root) => {
    const found = [];
    within.traverse((o) => o.isMesh && o.material.name === material && found.push(o));
    return found;
  };
  const hit = (origin, dir, targets) => {
    ray.set(origin, dir);
    ray.far = 2;
    const h = ray.intersectObjects(targets, false)[0];
    return h ? h.point.addScaledVector(dir, -LIFT) : null;
  };

  if (cfg.dash) {
    const { material, y, z, x } = cfg.dash;
    const targets = meshesOf(material);
    const points = [];
    for (let px = x[0]; px <= x[1]; px += STEP) {
      const p = hit(new THREE.Vector3(px, y, z), new THREE.Vector3(0, 0, 1), targets);
      if (p) points.push(p);
    }
    addStrip(body, points, glow, halo);
  }

  if (cfg.doors) {
    const { material, y, inset } = cfg.doors;
    for (const name of ["Door_FL", "Door_FR", "Door_RL", "Door_RR"]) {
      const door = root.getObjectByName(name);
      if (!door) continue;
      const box = new THREE.Box3().setFromObject(door);
      const side = Math.sign(box.min.x + box.max.x);
      const targets = meshesOf(material, door);
      const points = [];
      for (let pz = box.min.z + inset; pz <= box.max.z - inset; pz += STEP) {
        const p = hit(new THREE.Vector3(side * 0.2, y, pz), new THREE.Vector3(side, 0, 0), targets);
        if (p) points.push(door.worldToLocal(p));
      }
      addStrip(door, points, glow, halo);
    }
  }
}

function addStrip(parent, points, glow, halo) {
  if (points.length < 3) return;
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = points.length * 3;
  const line = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, STRIP_RADIUS, 6), glow);
  const soft = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, HALO_RADIUS, 8), halo);
  soft.renderOrder = 3;
  parent.add(line, soft);
}
