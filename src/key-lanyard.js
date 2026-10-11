/*! Portions © 2026 David Haz, React Bits (reactbits.dev). MIT + Commons Clause License Condition v1.0: see NOTICE.md. */
// The keys: a Baba Luxury Cars key fob on a woven lanyard, hanging from the
// footer's gold coachline beside "Let's find your car." It swings in when
// the footer arrives, sways a little in the air, can be caught and thrown,
// and a tap turns it over. A tap is also a press of its lock button: the
// footer's coachline blinks twice, as a car's indicators do when it locks.
//
// The strap, the clamp and the physics (a stiff rope of four joints and one
// rigid body, solved in small steps) are React Bits' Lanyard (MIT + Commons
// Clause, © David Haz, reactbits.dev; see NOTICE.md), ported to this module.
// The card is replaced by the fob, built here after the key Baba hands over
// in its delivery photographs: a piano-black pebble with a gold waistline,
// the Baba logo in gold leaf, a row of lock, unlock and boot buttons (their
// relief and satin finish come from painted bump and roughness maps rather
// than extra geometry), and a steel flip-key blade.
//
// The canvas never takes the pointer: the footer does, and only a press on
// the key itself is the key's (a press elsewhere, and the click after a
// press on the key, belong to the page), so the keys never cover the
// button beside them or the links beneath, and a swipe elsewhere scrolls.
import * as THREE from 'three';

const JOINTS = 4;
const NODE_WEIGHT = 1 / 0.05;
const MAX_STEP = 1 / 960;
const ITERATIONS = 2;
const SAMPLES = 72;
const FOV = 24;
const STRAP_WIDTH = 0.3;
const RING_RADIUS = 0.11;
const RING_TUBE = 0.016;
const LOOP_RADIUS = 0.07;
const EYELET_RADIUS = 0.036;
const CLAMP_BODY = 0.15;
const BAND_COLUMNS = [0, 0.07, 0.93, 1];
const BAND_BEND = [-0.95, -0.28, 0.28, 0.95];
const FLIP_SPIN = 9;

// The fob: 0.86 × 1.24 × 0.34 units, the proportions of a real key (about
// 40 × 58 × 16 mm), its corners rounded like a pebble, and the flip key's
// steel blade below it, as on the key Baba hands over in its delivery
// photographs.
const FOB = { width: .86, height: 1.24, radius: .34, depth: .2, bevel: .07 };
const BLADE = { length: .84, width: .19, depth: .05 };
const FACE = 768;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;


const seeded = start => {
  let state = start >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const traceRoundedRect = (path, x, y, width, height, radius) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = r * 0.4477;
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.bezierCurveTo(x + width - k, y, x + width, y + k, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.bezierCurveTo(x + width, y + height - k, x + width - k, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.bezierCurveTo(x + k, y + height, x, y + height - k, x, y + height - r);
  path.lineTo(x, y + r);
  path.bezierCurveTo(x, y + k, x + k, y, x + r, y);
};


const buildClampGeometry = width => {
  const shape = new THREE.Shape();
  const w = width * 1.16;
  traceRoundedRect(shape, -w / 2 + 0.014, -CLAMP_BODY / 2 + 0.014, w - 0.028, CLAMP_BODY - 0.028, 0.024);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 6,
    curveSegments: 10
  });
  geometry.translate(0, 0, -0.01);
  return geometry;
};

const buildBandGeometry = count => {
  const columns = BAND_COLUMNS.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * columns * 2), 2));
  const index = [];
  for (let i = 0; i < count - 1; i++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = i * columns + c;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  geometry.setIndex(index);
  return geometry;
};

const buildEnvironment = renderer => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.035, 0.035, 0.04);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  const panel = (intensity, position, scale, rotation = 0) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(intensity, intensity, intensity),
      side: THREE.DoubleSide
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(scale[0], scale[1], 1);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(rotation);
    scene.add(mesh);
  };
  panel(2.6, [0, 4.5, 8], [9, 4]);
  panel(6, [-5.5, 0.5, 7], [0.9, 14]);
  panel(4, [5, -0.5, 8], [0.6, 14]);
  panel(3.5, [0, -1, 9], [24, 0.35], Math.PI / 3);
  panel(2.5, [1, 2.5, 9], [24, 0.2], Math.PI / 3);
  panel(1.4, [0, 6, -6], [12, 4]);
  panel(0.5, [0, -7, 1], [16, 6]);
  panel(0.9, [8, 0, -2], [4, 10]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  geometry.dispose();
  materials.forEach(material => material.dispose());
  return target;
};


const buildWeaveTexture = () => {
  const size = 128;
  const threads = 8;
  const random = seeded(19);
  const fiber = Float32Array.from({ length: size * size }, () => random());
  const profile = f => Math.sqrt(Math.max(0, 1 - 4 * f * f));
  const height = (x, y) => {
    const px = ((x % size) + size) % size;
    const py = ((y % size) + size) % size;
    const u = (px / size) * threads;
    const v = (py / size) * threads;
    const cu = Math.floor(u);
    const cv = Math.floor(v);
    const fu = u - cu - 0.5;
    const fv = v - cv - 0.5;
    const lift = (cu + cv) % 2 === 0;
    const warp = profile(fu) * (0.55 + 0.45 * Math.cos(fv * Math.PI * (lift ? 1 : 0.6)));
    const weft = profile(fv) * (0.55 + 0.45 * Math.cos(fu * Math.PI * (lift ? 0.6 : 1)));
    return (lift ? Math.max(warp, weft * 0.7) : Math.max(weft, warp * 0.7)) + fiber[py * size + px] * 0.08;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * 1.6;
      const ny = (height(x, y - 1) - height(x, y + 1)) * 1.6;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};


const createSimulation = () => {
  const vectors = () => Array.from({ length: JOINTS + 1 }, () => new THREE.Vector3());
  return {
    nodes: vectors(),
    previous: vectors(),
    velocities: vectors(),
    lengths: new Float64Array(JOINTS),
    impulses: new Float64Array(JOINTS),
    rest: 1,
    anchor: new THREE.Vector3(),
    body: {
      position: new THREE.Vector3(),
      previous: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      previousQuaternion: new THREE.Quaternion(),
      angular: new THREE.Vector3(),
      mass: 1,
      inverseInertia: new THREE.Vector3(1, 1, 1),
      hang: new THREE.Vector3()
    },
    grab: null,
    turn: 0,
    twist: 0,
    twistRaw: 0,
    calm: 0
  };
};

const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  e: new THREE.Vector3(),
  f: new THREE.Vector3(),
  g: new THREE.Vector3(),
  pin: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  r: new THREE.Quaternion()
};

const applyInverseInertia = (body, vector, out) => {
  scratch.r.copy(body.quaternion).invert();
  out.copy(vector).applyQuaternion(scratch.r);
  out.set(out.x * body.inverseInertia.x, out.y * body.inverseInertia.y, out.z * body.inverseInertia.z);
  return out.applyQuaternion(body.quaternion);
};

const rotateBody = (q, w) => {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  q.x += 0.5 * (w.x * qw + w.y * qz - w.z * qy);
  q.y += 0.5 * (w.y * qw + w.z * qx - w.x * qz);
  q.z += 0.5 * (w.z * qw + w.x * qy - w.y * qx);
  q.w += 0.5 * (-w.x * qx - w.y * qy - w.z * qz);
  q.normalize();
};

const bodyWeight = (body, r, normal) => {
  const rn = scratch.c.crossVectors(r, normal);
  return 1 / body.mass + rn.dot(applyInverseInertia(body, rn, scratch.d));
};

const pushBody = (body, r, impulse) => {
  body.position.addScaledVector(impulse, 1 / body.mass);
  rotateBody(body.quaternion, applyInverseInertia(body, scratch.e.crossVectors(r, impulse), scratch.f));
};

const solveSegment = (sim, i, h, physics) => {
  const { nodes, body } = sim;
  const a = nodes[i];
  const wa = i === 0 ? 0 : NODE_WEIGHT;
  const last = i === JOINTS - 1;
  const r = scratch.g;
  let b = nodes[i + 1];
  if (last) {
    r.copy(body.hang).applyQuaternion(body.quaternion);
    b = scratch.b.copy(body.position).add(r);
  }
  const delta = scratch.a.subVectors(b, a);
  const length = delta.length();
  const stretch = length - sim.rest;
  if (stretch <= 0 || length < 1e-9) return;
  const normal = delta.divideScalar(length);
  const wb = last ? bodyWeight(body, r, normal) : NODE_WEIGHT;
  const rate = (length - sim.lengths[i]) / h;
  const tension =
    physics.hold * Math.tanh((physics.stiffness * stretch) / physics.hold) +
    physics.spring * stretch +
    physics.bandDamping * Math.max(0, rate);
  const room = tension * h * h - sim.impulses[i];
  if (room <= 0) return;
  const lambda = Math.min(stretch / (wa + wb), room);
  sim.impulses[i] += lambda;
  if (wa) a.addScaledVector(normal, lambda * wa);
  if (last) pushBody(body, r, normal.multiplyScalar(-lambda));
  else b.addScaledVector(normal, -lambda * wb);
};

const solvePin = (body, grab, target) => {
  const r = scratch.g.copy(grab.local).applyQuaternion(body.quaternion);
  const delta = scratch.a.copy(target).sub(body.position).sub(r);
  const distance = delta.length();
  if (distance < 1e-9) return;
  const normal = delta.divideScalar(distance);
  const lambda = distance / bodyWeight(body, r, normal);
  pushBody(body, r, normal.multiplyScalar(lambda));
};

const placeHanging = (sim, layout, intro) => {
  const { nodes, previous, velocities, body, anchor } = sim;
  nodes[0].copy(anchor);
  for (let i = 1; i <= JOINTS; i++) {
    nodes[i].copy(nodes[i - 1]);
    if (intro) nodes[i].x += sim.rest;
    else nodes[i].y -= sim.rest;
  }
  body.quaternion.identity();
  if (intro) body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  body.hang.set(0, layout.hangY, 0);
  const offset = scratch.a.copy(body.hang).applyQuaternion(body.quaternion);
  body.position.copy(nodes[JOINTS]).sub(offset);
  body.previous.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.velocity.set(0, 0, 0);
  body.angular.set(0, 0, 0);
  for (let i = 0; i <= JOINTS; i++) {
    previous[i].copy(nodes[i]);
    velocities[i].set(0, 0, 0);
  }
  sim.lengths.fill(sim.rest);
  sim.turn = 0;
  sim.twist = 0;
  sim.twistRaw = 0;
  sim.calm = 0;
};

const configureSimulation = (sim, layout, length) => {
  sim.rest = length / JOINTS;
  const { width, height } = layout;
  const body = sim.body;
  const t = layout.depth;
  body.mass = 1;
  body.inverseInertia.set(
    12 / (height * height + t * t),
    12 / (width * width + t * t),
    12 / (width * width + height * height)
  );
  body.hang.set(0, layout.hangY, 0);
};

const stepSimulation = (sim, dt, physics, time) => {
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-6));
  const h = dt / steps;
  const { nodes, previous, velocities, body } = sim;
  const windX = physics.breeze * (Math.sin(time * 0.53) * 0.7 + Math.sin(time * 1.31 + 1.7) * 0.3) * 3;
  const windZ = physics.breeze * Math.sin(time * 0.37 + 0.6) * 2;
  const grab = sim.grab;
  const pin = scratch.pin;
  const nodeDrag = Math.exp(-physics.nodeDrag * h);
  const linearDrag = Math.exp(-physics.linearDrag * h);
  const angularDrag = Math.exp(-physics.angularDrag * h);

  for (let s = 0; s < steps; s++) {
    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i];
      v.y -= physics.gravity * h;
      v.x += windX * h;
      v.z += windZ * h;
      previous[i].copy(nodes[i]);
      nodes[i].addScaledVector(v, h);
    }

    body.previous.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    const q = body.quaternion;
    if (grab) {
      const turn = scratch.q.copy(grab.rotation).multiply(scratch.r.copy(q).invert());
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
      const torque = scratch.a.set(turn.x, turn.y, turn.z).multiplyScalar(2 * physics.grip);
      torque.addScaledVector(body.angular, -physics.gripDamping);
      body.angular.addScaledVector(applyInverseInertia(body, torque, scratch.b), h);
    }
    const up = scratch.a.set(0, 1, 0).applyQuaternion(q);
    const front = scratch.b.set(-up.x * up.z, -up.y * up.z, 1 - up.z * up.z);
    if (front.lengthSq() > 1e-3) {
      const facing = scratch.d.set(0, 0, 1).applyQuaternion(q);
      const raw = Math.atan2(scratch.e.crossVectors(front, facing).dot(up), front.dot(facing));
      let turned = raw - sim.twistRaw;
      if (turned > Math.PI) turned -= Math.PI * 2;
      else if (turned < -Math.PI) turned += Math.PI * 2;
      sim.twist += turned;
      sim.twistRaw = raw;
    }
    if (!grab) {
      const spin = body.angular.dot(up);
      body.angular.addScaledVector(up, (physics.twist * (sim.turn - sim.twist) - physics.twistDamping * spin) * h);
    }
    body.velocity.y -= physics.gravity * h;
    body.velocity.x += windX * 0.35 * h;
    body.velocity.z += windZ * 0.35 * h;
    body.position.addScaledVector(body.velocity, h);
    rotateBody(body.quaternion, scratch.f.copy(body.angular).multiplyScalar(h));

    sim.impulses.fill(0);
    if (grab) pin.lerpVectors(grab.from, grab.target, (s + 1) / steps);
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (let i = 0; i < JOINTS; i++) solveSegment(sim, i, h, physics);
      if (grab) solvePin(body, grab, pin);
    }

    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i].subVectors(nodes[i], previous[i]).divideScalar(h).multiplyScalar(nodeDrag);
      v.multiplyScalar(1 / (1 + physics.nodeAir * v.length() * h));
    }
    body.velocity.subVectors(body.position, body.previous).divideScalar(h);
    const dq = scratch.q.copy(body.previousQuaternion).invert().premultiply(body.quaternion);
    body.angular.set(dq.x, dq.y, dq.z).multiplyScalar((2 / h) * (dq.w < 0 ? -1 : 1));

    const normal = scratch.a.set(0, 0, 1).applyQuaternion(body.quaternion);
    const across = body.velocity.dot(normal);
    const along = scratch.b.copy(body.velocity).addScaledVector(normal, -across);
    along.multiplyScalar(1 / (1 + physics.air * along.length() * h));
    body.velocity
      .copy(along)
      .addScaledVector(normal, across / (1 + physics.broadside * Math.abs(across) * h))
      .multiplyScalar(linearDrag);
    body.angular.multiplyScalar(angularDrag / (1 + physics.spinAir * body.angular.length() * h));
    if (body.velocity.lengthSq() > 3600) body.velocity.setLength(60);
    if (body.angular.lengthSq() > 1600) body.angular.setLength(40);

    nodes[JOINTS].copy(body.hang).applyQuaternion(body.quaternion).add(body.position);
    for (let i = 0; i < JOINTS; i++) sim.lengths[i] = nodes[i].distanceTo(nodes[i + 1]);
  }

  if (grab) grab.from.copy(grab.target);

  let energy = body.velocity.lengthSq() + body.angular.lengthSq() * 0.3;
  for (let i = 1; i < JOINTS; i++) energy += velocities[i].lengthSq() * 0.05;
  sim.calm = energy < 2e-4 ? sim.calm + dt : 0;
};


// ------------------------------------------------------------------ the fob
const fobLayout = () => {
  const { width, height, depth, bevel } = FOB;
  const loopY = height / 2 + .02;
  const ringY = loopY + LOOP_RADIUS;
  // Inertia counts the blade at half weight; the rest is the fob.
  return { width, height: height + BLADE.length * .5, depth: depth + bevel * 2, loopY, ringY, hangY: ringY + RING_RADIUS };
};

const buildFobGeometry = () => {
  const { width, height, radius, depth, bevel } = FOB;
  const inner = new THREE.Shape();
  traceRoundedRect(inner, -width / 2 + bevel, -height / 2 + bevel, width - bevel * 2, height - bevel * 2, radius - bevel);
  const body = new THREE.ExtrudeGeometry(inner, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 10, curveSegments: 40 });
  body.translate(0, 0, -depth / 2);
  const face = new THREE.ShapeGeometry(inner, 40);
  const position = face.getAttribute('position'), uv = face.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
  uv.needsUpdate = true;
  // The gold waistline, standing just proud of the widest point.
  const outer = new THREE.Shape(), lip = .016;
  traceRoundedRect(outer, -width / 2 - lip, -height / 2 - lip, width + lip * 2, height + lip * 2, radius + lip);
  const hole = new THREE.Path();
  traceRoundedRect(hole, -width / 2 + .05, -height / 2 + .05, width - .1, height - .1, radius - .05);
  outer.holes.push(hole);
  const waist = new THREE.ExtrudeGeometry(outer, { depth: .026, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 3, curveSegments: 40 });
  waist.translate(0, 0, -.013);
  return { body, face, waist };
};

// The blade, cut along one edge, rounded at the tip, set into the fob.
const buildBladeGeometry = () => {
  const { length, width, depth } = BLADE, top = -FOB.height / 2 + .05, w = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w, top);
  shape.lineTo(w, top);
  [[.1, 0], [.18, -.03], [.27, -.012], [.36, -.045], [.46, -.02], [.56, -.05], [.66, -.018], [.74, -.04]].forEach(([at, cut], i, cuts) => {
    shape.lineTo(w + cut, top - at * length);
    shape.lineTo(w + cut, top - (cuts[i + 1]?.[0] ?? .82) * length);
  });
  shape.quadraticCurveTo(w - .04, top - length, -w * .1, top - length);
  shape.lineTo(-w + .02, top - length + .05);
  shape.lineTo(-w, top - length + .16);
  shape.closePath();
  const blade = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 12 });
  blade.translate(0, 0, -depth / 2);
  // The milled channel down each face.
  const groove = new THREE.BoxGeometry(.032, length * .72, depth + .016);
  groove.translate(-w * .28, top - length * .48, 0);
  return { blade, groove };
};

// Canvas helpers. Each face is three paintings of the same layout: colour,
// height (for the bump map) and finish (roughness in green, metal in blue).
const canvasOf = (width, height) => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const tinted = (image, width, height, color) => {
  const c = canvasOf(Math.ceil(width), Math.ceil(height)), ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return c;
};

// The three buttons' symbols, drawn as engraved strokes around (0, 0) in a
// unit of r: a shut padlock, an open one, and the boot of a car.
const SYMBOLS = {
  lock(ctx, r) { roundRect(ctx, -r * .42, -r * .08, r * .84, r * .62, r * .1); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -r * .08, r * .27, Math.PI, 0); ctx.stroke(); },
  unlock(ctx, r) { roundRect(ctx, -r * .42, -r * .08, r * .84, r * .62, r * .1); ctx.stroke(); ctx.beginPath(); ctx.arc(r * .3, -r * .2, r * .27, Math.PI * 1.05, Math.PI * 2.02); ctx.stroke(); },
  boot(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(-r * .62, r * .3); ctx.lineTo(-r * .62, -r * .02); ctx.lineTo(-r * .36, -r * .34); ctx.lineTo(r * .36, -r * .34); ctx.lineTo(r * .62, -r * .02); ctx.lineTo(r * .62, r * .3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * .46, -r * .02); ctx.lineTo(r * .46, -r * .02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * .62); ctx.lineTo(0, -r * .9); ctx.moveTo(-r * .14, -r * .76); ctx.lineTo(0, -r * .9); ctx.lineTo(r * .14, -r * .76); ctx.stroke();
  },
};

function paintFaces(logo, side) {
  const W = FACE, H = Math.round(FACE * FOB.height / FOB.width);
  const color = canvasOf(W, H), height = canvasOf(W, H), finish = canvasOf(W, H);
  const c = color.getContext('2d'), h = height.getContext('2d'), f = finish.getContext('2d');
  // Lacquer: a little lighter towards the top, where a softbox would sit.
  const lacquer = c.createLinearGradient(0, 0, 0, H);
  lacquer.addColorStop(0, '#16161a'); lacquer.addColorStop(.45, '#0a0a0c'); lacquer.addColorStop(1, '#050506');
  c.fillStyle = lacquer; c.fillRect(0, 0, W, H);
  h.fillStyle = '#808080'; h.fillRect(0, 0, W, H);
  f.fillStyle = 'rgb(255,38,0)'; f.fillRect(0, 0, W, H);
  // The coachline round the face, inlaid in gold.
  const inset = W * .13, line = (ctx, style, width) => { ctx.strokeStyle = style; ctx.lineWidth = width; roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, W * .26); ctx.stroke(); };
  const gold = c.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#84502c'); gold.addColorStop(.5, '#f2bf5e'); gold.addColorStop(1, '#84502c');
  line(c, gold, 3); line(h, '#5a5a5a', 4); line(f, 'rgb(255,90,255)', 4);
  const mark = (y, width, tone) => {
    if (!logo) return;
    const w = W * width, hgt = w * logo.height / logo.width, x = (W - w) / 2;
    c.drawImage(logo, x, y - hgt / 2, w, hgt);
    h.drawImage(tinted(logo, w, hgt, tone), x, y - hgt / 2);
    f.drawImage(tinted(logo, w, hgt, 'rgb(255,70,255)'), x, y - hgt / 2);
  };
  if (side === 'front') {
    mark(H * .33, .6, '#a8a8a8');
    // The buttons, in a row: satin domes in a fine chrome ring, each with
    // its symbol.
    [['lock', .27], ['unlock', .5], ['boot', .73]].forEach(([symbol, at]) => {
      const x = W * at, y = H * .66, r = W * .098;
      const dome = c.createRadialGradient(x - r * .3, y - r * .4, r * .1, x, y, r);
      dome.addColorStop(0, '#2a2a2e'); dome.addColorStop(1, '#121214');
      c.fillStyle = dome; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#9b8a6e'; c.lineWidth = 3; c.stroke();
      const rise = h.createRadialGradient(x, y, 0, x, y, r);
      rise.addColorStop(0, '#d8d8d8'); rise.addColorStop(.8, '#b0b0b0'); rise.addColorStop(1, '#808080');
      h.fillStyle = rise; h.beginPath(); h.arc(x, y, r, 0, Math.PI * 2); h.fill();
      h.strokeStyle = '#3c3c3c'; h.lineWidth = 6; h.beginPath(); h.arc(x, y, r + 3, 0, Math.PI * 2); h.stroke();
      f.fillStyle = 'rgb(255,140,0)'; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
      f.strokeStyle = 'rgb(255,60,220)'; f.lineWidth = 4; f.beginPath(); f.arc(x, y, r + 1, 0, Math.PI * 2); f.stroke();
      [[c, '#d9c9ad'], [h, '#8a8a8a'], [f, 'rgb(255,120,0)']].forEach(([ctx, ink]) => {
        ctx.save(); ctx.translate(x, y); ctx.strokeStyle = ink; ctx.lineWidth = r * .1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        SYMBOLS[symbol](ctx, r); ctx.restore();
      });
    });
  } else {
    mark(H * .34, .5, '#a0a0a0');
    const words = (ctx, ink) => {
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(W * .036)}px Manrope, system-ui, sans-serif`;
      ctx.letterSpacing = `${Math.round(W * .012)}px`;
      ctx.fillText('BABA LUXURY CARS', W / 2, H * .55);
      ctx.letterSpacing = '0px';
      ctx.font = `italic 300 ${Math.round(W * .062)}px Newsreader, Georgia, serif`;
      ctx.fillText('The art of choosing well.', W / 2, H * .65);
    };
    words(c, '#d6b06c'); words(h, '#9a9a9a'); words(f, 'rgb(255,80,255)');
    c.fillStyle = gold; c.fillRect(W * .38, H * .595, W * .24, 2);
  }
  return { color, height, finish };
}

// The strap: black grosgrain with BABA LUXURY CARS woven along it in gold,
// a stitched edge each side.
function paintStrap() {
  const across = 192, along = across * 7;
  const flat = canvasOf(along, across), ctx = flat.getContext('2d');
  ctx.fillStyle = '#0d0d0f'; ctx.fillRect(0, 0, along, across);
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for (let x = 0; x < along; x += 4) ctx.fillRect(x, 0, 1, across);
  ctx.fillStyle = 'rgba(214,176,108,.55)';
  for (let x = 6; x < along; x += 16) { ctx.fillRect(x, across * .1, 9, 2); ctx.fillRect(x, across * .9 - 2, 9, 2); }
  const gold = ctx.createLinearGradient(0, 0, 0, across);
  gold.addColorStop(0, '#b47a3c'); gold.addColorStop(.5, '#f2c46a'); gold.addColorStop(1, '#a86e34');
  ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${across * .3}px Manrope, system-ui, sans-serif`;
  ctx.letterSpacing = `${across * .07}px`;
  ctx.fillText('BABA  LUXURY  CARS', along * .5, across * .53);
  ctx.letterSpacing = '0px';
  ctx.beginPath(); ctx.arc(along * .06, across / 2, across * .05, 0, Math.PI * 2); ctx.arc(along * .94, across / 2, across * .05, 0, Math.PI * 2); ctx.fill();
  // Turned to run along the strap, as the band's UVs expect.
  const strap = canvasOf(across, along), out = strap.getContext('2d');
  out.translate(across, 0); out.rotate(Math.PI / 2); out.drawImage(flat, 0, 0);
  return { canvas: strap, ratio: along / across };
}

export function createKeyLanyard(container, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'keys-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const host = container.closest('.site-footer') || container.parentElement;
  canvas.style.pointerEvents = 'none';

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const environment = buildEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.1;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.5);
  keyLight.position.set(-2.5, 4, 6);
  const fillLight = new THREE.DirectionalLight(0xffffff, .3);
  fillLight.position.set(3, -1, 4);
  scene.add(keyLight, fillLight);

  // Materials: piano-black lacquer, the painted faces over it, gold metal.
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .05 });
  const faceMaterial = () => new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: .06, bumpScale: 1.2 });
  const frontMaterial = faceMaterial(), backMaterial = faceMaterial();
  const goldMetal = new THREE.MeshStandardMaterial({ color: 0xd9a35a, metalness: 1, roughness: .22 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd3d6db, metalness: 1, roughness: .26 });
  const milled = new THREE.MeshStandardMaterial({ color: 0x8d9096, metalness: 1, roughness: .5 });
  const textures = [];
  const dress = (material, painted) => {
    const map = new THREE.CanvasTexture(painted.color); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = anisotropy;
    const bump = new THREE.CanvasTexture(painted.height); bump.anisotropy = anisotropy;
    const finish = new THREE.CanvasTexture(painted.finish); finish.anisotropy = anisotropy;
    textures.push(map, bump, finish);
    Object.assign(material, { map, bumpMap: bump, roughnessMap: finish, metalnessMap: finish });
    material.needsUpdate = true;
  };
  const paint = logo => { dress(frontMaterial, paintFaces(logo, 'front')); dress(backMaterial, paintFaces(logo, 'back')); start(); };

  const layout = fobLayout();
  const geometry = buildFobGeometry();
  const fob = new THREE.Group();
  const body = new THREE.Mesh(geometry.body, lacquer);
  const front = new THREE.Mesh(geometry.face, frontMaterial);
  const back = new THREE.Mesh(geometry.face.clone(), backMaterial);
  const faceZ = FOB.depth / 2 + FOB.bevel + .0006;
  front.position.z = faceZ;
  back.rotation.y = Math.PI; back.position.z = -faceZ;
  const waist = new THREE.Mesh(geometry.waist, goldMetal);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(LOOP_RADIUS, .022, 16, 48), goldMetal);
  loop.position.y = layout.loopY;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 18, 72), goldMetal);
  ring.rotation.y = Math.PI / 2 - .7;
  ring.position.y = layout.ringY;
  const cut = buildBladeGeometry();
  const blade = new THREE.Mesh(cut.blade, steel), groove = new THREE.Mesh(cut.groove, milled);
  fob.add(body, front, back, waist, loop, ring, blade, groove);
  scene.add(fob);

  const weave = buildWeaveTexture();
  const strap = paintStrap();
  const strapTexture = new THREE.CanvasTexture(strap.canvas);
  strapTexture.colorSpace = THREE.SRGBColorSpace; strapTexture.anisotropy = anisotropy;
  strapTexture.wrapS = THREE.ClampToEdgeWrapping; strapTexture.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(2, 2 * strap.ratio);
  const bandMaterial = new THREE.MeshPhysicalMaterial({ map: strapTexture, normalMap: weave, normalScale: new THREE.Vector2(.7, .7), roughness: .66, sheen: 1, sheenRoughness: .42, sheenColor: new THREE.Color(.34, .3, .26), side: THREE.DoubleSide });
  const bandGeometry = buildBandGeometry(SAMPLES);
  const band = new THREE.Mesh(bandGeometry, bandMaterial);
  band.frustumCulled = false;
  scene.add(band);
  const clampGroup = new THREE.Group();
  const clampMesh = new THREE.Mesh(buildClampGeometry(STRAP_WIDTH), goldMetal);
  clampMesh.position.y = EYELET_RADIUS + CLAMP_BODY / 2 - .004;
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(EYELET_RADIUS, .0105, 14, 40), goldMetal);
  clampGroup.add(clampMesh, eyelet);
  scene.add(clampGroup);
  // Hidden until it is dropped in.
  fob.visible = band.visible = clampGroup.visible = false;

  const sim = createSimulation();
  configureSimulation(sim, layout, 1);
  const controls = [], mouth = new THREE.Vector3(), tuck = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
  const view = { width: 1, height: 1 };
  let raf = 0, last = performance.now(), time = 0, visible = false, alive = true, dropped = false, hovering = false, press = null;
  paint(null);
  const logo = new Image();
  logo.decoding = 'async';
  logo.onload = () => document.fonts.ready.then(() => alive && paint(logo));
  logo.src = '/brand/baba-luxury-car-800.webp';

  // The key hangs from above the top edge at the anchor (--anchor, a share
  // of the width), about 300 px long, its top a little way down.
  const frameView = () => {
    const aspect = view.width / view.height;
    const phone = view.height < 520;
    const keyPx = phone ? view.height * .6 : Math.min(330, Math.max(230, view.height * .38));
    const viewHeight = (FOB.height + BLADE.length) / (keyPx / view.height);
    camera.aspect = aspect;
    camera.position.set(0, 0, viewHeight / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const anchorY = viewHeight / 2 + .2;
    const topPx = phone ? view.height * .1 : Math.min(230, Math.max(130, view.height * .24));
    const top = viewHeight / 2 - viewHeight * topPx / view.height;
    const hangTop = top + (layout.hangY - FOB.height / 2);
    const share = parseFloat(getComputedStyle(container).getPropertyValue('--anchor')) || .5;
    sim.anchor.set((share - .5) * viewHeight * aspect, anchorY, 0);
    configureSimulation(sim, layout, anchorY - hangTop);
    sim.nodes[0].copy(sim.anchor);
    sim.previous[0].copy(sim.anchor);
  };

  const points = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const sides = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const bends = BAND_BEND.map(angle => [Math.cos(angle), Math.sin(angle)]);
  const work = { tangent: new THREE.Vector3(), toCamera: new THREE.Vector3(), basis: new THREE.Matrix4(), up: new THREE.Vector3(), across: new THREE.Vector3(), facing: new THREE.Vector3(), end: new THREE.Vector3() };
  const updateBand = () => {
    const hang = sim.nodes[JOINTS];
    const reach = EYELET_RADIUS + CLAMP_BODY + .05;
    let guide = JOINTS - 1;
    while (guide > 0 && sim.nodes[guide].distanceTo(hang) < reach * 1.1) guide--;
    const axis = work.up.subVectors(sim.nodes[guide], hang);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).applyQuaternion(sim.body.quaternion);
    axis.normalize();
    mouth.copy(hang).addScaledVector(axis, reach);
    tuck.copy(hang).addScaledVector(axis, EYELET_RADIUS + CLAMP_BODY * .35);
    controls.length = 0;
    for (let i = 0; i <= guide; i++) controls.push(sim.nodes[i]);
    controls.push(mouth, tuck);
    curve.updateArcLengths();
    for (let i = 0; i < SAMPLES; i++) curve.getPointAt(i / (SAMPLES - 1), points[i]);
    const length = curve.getLength();
    const held = 1 - mouth.distanceTo(tuck) / Math.max(length, .001);
    const position = bandGeometry.getAttribute('position'), normal = bandGeometry.getAttribute('normal'), uv = bandGeometry.getAttribute('uv');
    const columns = BAND_COLUMNS.length;
    const restLength = sim.rest * JOINTS;
    const repeats = restLength / (STRAP_WIDTH * strap.ratio);
    const width = STRAP_WIDTH / Math.pow(Math.max(1, length / Math.max(restLength, .001)), .35);
    const { tangent, toCamera, across, facing } = work;
    for (let i = 0; i < SAMPLES; i++) {
      tangent.subVectors(points[Math.min(SAMPLES - 1, i + 1)], points[Math.max(0, i - 1)]);
      if (tangent.lengthSq() < 1e-12) tangent.set(0, -1, 0);
      tangent.normalize();
      toCamera.subVectors(camera.position, points[i]).normalize();
      const side = sides[i].crossVectors(toCamera, tangent);
      if (side.lengthSq() < 1e-10) side.copy(i > 0 ? sides[i - 1] : scratch.a.set(1, 0, 0));
      side.normalize();
      if (i > 0 && side.dot(sides[i - 1]) < 0) side.negate();
      const angle = -sim.twist * Math.pow(Math.min(1, i / (SAMPLES - 1) / held), 1.3);
      facing.crossVectors(tangent, side);
      across.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(facing, Math.sin(angle));
      facing.crossVectors(tangent, across);
      const p = points[i], v = (1 - i / (SAMPLES - 1)) * repeats;
      for (let c = 0; c < columns; c++) {
        const k = i * columns + c, offset = (BAND_COLUMNS[c] - .5) * width, [bendCos, bendSin] = bends[c];
        position.setXYZ(k, p.x + across.x * offset, p.y + across.y * offset, p.z + across.z * offset);
        normal.setXYZ(k, facing.x * bendCos + across.x * bendSin, facing.y * bendCos + across.y * bendSin, facing.z * bendCos + across.z * bendSin);
        uv.setXY(k, BAND_COLUMNS[c], v);
      }
    }
    work.end.copy(across);
    position.needsUpdate = normal.needsUpdate = uv.needsUpdate = true;
    across.copy(work.end).addScaledVector(axis, -work.end.dot(axis)).normalize();
    facing.crossVectors(across, axis).normalize();
    work.basis.makeBasis(across, axis, facing);
    clampGroup.quaternion.setFromRotationMatrix(work.basis);
    clampGroup.position.copy(hang);
  };
  const render = () => {
    fob.position.copy(sim.body.position);
    fob.quaternion.copy(sim.body.quaternion);
    updateBand();
    renderer.render(scene, camera);
  };

  const physics = {
    gravity: 40, hold: 40 * mix(2.2, 5.5, .45), stiffness: 40 * 10 * JOINTS, spring: 40 * mix(.1, .4, .45) * JOINTS,
    bandDamping: 40 * mix(.3, .08, .45) * JOINTS, linearDrag: .25 * Math.pow(16, .5), angularDrag: .5 * Math.pow(12, .5),
    air: .15, broadside: .5, spinAir: .03, nodeDrag: 2, nodeAir: .2, twist: 30, twistDamping: 3, grip: 40, gripDamping: 6,
    breeze: reduced ? 0 : .28,
  };
  const tick = now => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
    last = now; time += dt;
    stepSimulation(sim, dt, physics, time);
    const b = sim.body;
    if (!Number.isFinite(b.position.x + b.position.y + b.position.z + b.quaternion.w)) { sim.grab = null; placeHanging(sim, layout, false); }
    render();
    const resting = sim.calm > 1.2 && !sim.grab && physics.breeze === 0;
    if (visible && !document.hidden && !resting) raf = requestAnimationFrame(tick);
  };
  function start() {
    if (raf || !visible || !alive || !dropped) return;
    sim.calm = 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  // In from the side, on its strap, the first time the footer is in view.
  const drop = () => {
    if (dropped) return;
    dropped = true;
    placeHanging(sim, layout, !reduced);
    fob.visible = band.visible = clampGroup.visible = true;
    start();
  };

  // Catching, throwing and turning it over (a tap), as in the Lanyard.
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const toPointer = event => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const pick = () => { fob.updateMatrixWorld(); return dropped ? raycaster.intersectObjects([body, front, back, blade], false)[0] || null : null; };
  const flip = point => {
    const b = sim.body, up = scratch.a.set(0, 1, 0).applyQuaternion(b.quaternion);
    let direction = sim.turn > 0 ? -1 : 1;
    if (sim.turn === 0) {
      const away = scratch.c.subVectors(point, camera.position).normalize();
      direction = scratch.b.subVectors(point, b.position).cross(away).dot(up) < 0 ? -1 : 1;
    }
    sim.turn = sim.turn === 0 ? Math.PI * direction : 0;
    b.angular.addScaledVector(up, FLIP_SPIN * direction);
    container.dispatchEvent(new CustomEvent('keys:press', { bubbles: true }));
  };
  // Over the key the loupe says Drag; the footer carries the label so it
  // shows wherever the key hangs.
  const setHover = (on, event) => {
    if (on === hovering) return;
    hovering = on;
    if (on) host.dataset.cursor = 'Drag'; else delete host.dataset.cursor;
    if (event) document.dispatchEvent(new CustomEvent('loupe:refresh', { detail: event }));
  };
  let swallow = false;
  const onPointerDown = event => {
    swallow = false;
    if (event.button > 0) return;
    toPointer(event);
    const hit = pick();
    if (!hit) return;
    sim.grab = { local: hit.point.clone().sub(sim.body.position).applyQuaternion(sim.body.quaternion.clone().invert()), rotation: sim.body.quaternion.clone(), reach: hit.distance, from: hit.point.clone(), target: hit.point.clone() };
    press = { x: event.clientX, y: event.clientY, time: performance.now(), point: hit.point.clone() };
    swallow = true;
    host.setPointerCapture?.(event.pointerId);
    container.classList.add('is-holding');
    event.preventDefault();
    start();
  };
  const onPointerMove = event => {
    toPointer(event);
    if (sim.grab) {
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press = null;
      raycaster.ray.at(sim.grab.reach, sim.grab.target);
      start();
      return;
    }
    if (event.pointerType !== 'touch') setHover(!!pick(), event);
  };
  const onPointerUp = event => {
    if (!sim.grab) return;
    sim.grab = null;
    if (press && event.type === 'pointerup' && performance.now() - press.time < 450) flip(press.point);
    press = null;
    host.releasePointerCapture?.(event.pointerId);
    container.classList.remove('is-holding');
    start();
  };
  // The click that ends a press on the key is the key's, not the page's.
  const onClick = event => { if (swallow) { swallow = false; event.preventDefault(); event.stopPropagation(); } };
  // A touch that lands on the key holds it instead of scrolling the page.
  const onTouchStart = event => { if (event.touches.length !== 1) return; toPointer(event.touches[0]); if (pick()) event.preventDefault(); };
  const onLeave = event => { if (!sim.grab) setHover(false, event); };
  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerUp);
  host.addEventListener('lostpointercapture', onPointerUp);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('click', onClick, true);
  host.addEventListener('touchstart', onTouchStart, { passive: false });

  const resize = () => {
    view.width = Math.max(1, container.clientWidth);
    view.height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(view.width, view.height, false);
    frameView();
    if (dropped) placeHanging(sim, layout, false);
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const watcher = new IntersectionObserver(entries => {
    const entry = entries.at(-1);
    visible = entry.isIntersecting;
    if (entry.intersectionRatio > .35) drop();
    if (visible) start();
  }, { threshold: [0, .35, .6] });
  watcher.observe(container);
  const onVisibility = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  if (import.meta.env.DEV) window.__keys = {
    sim, drop,
    snapshot: () => ({ dropped, visible, hovering, turn: sim.turn, position: sim.body.position.toArray().map(v => +v.toFixed(3)) }),
    screen: () => { const v = sim.body.position.clone().project(camera), r = canvas.getBoundingClientRect(); return [Math.round(r.left + (v.x + 1) / 2 * r.width), Math.round(r.top + (1 - v.y) / 2 * r.height)]; },
  };
  return {
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect(); watcher.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('lostpointercapture', onPointerUp);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick, true);
      host.removeEventListener('touchstart', onTouchStart);
      delete host.dataset.cursor;
      [body, front, back, waist, loop, ring, blade, groove, clampMesh, eyelet, band].forEach(mesh => mesh.geometry?.dispose());
      [lacquer, frontMaterial, backMaterial, goldMetal, steel, milled, bandMaterial].forEach(material => material.dispose());
      [...textures, strapTexture, weave].forEach(texture => texture.dispose());
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
