// A silk cover, simulated: a grid of particles held by stretch, shear and
// bend constraints (position-based dynamics, Verlet integration), dropped
// over a car and drawn off it by one edge. It is cut from a satin of some
// body: stiffer in bending than a thin silk (bending stiffness grows with the
// cube of thickness), so it falls in fewer, softer folds, and a curvature
// constraint keeps it from kinking at the scale of its own particles. The
// air of a closed studio is still: the cloth moves only when it is moved.
// Air resists it across its face, with the square of its speed (a sheet of
// satin falls flat at about a metre and a half a second, so it floats and
// billows), and hardly at all along it, so a slide is checked by friction,
// not by the air. It comes to rest (`motion` says how much it is still
// moving, so the page can stop simulating it).
//
// The car is a height map seen from above (bakeHeight): everything under its
// top surface is solid down to the floor, which is all a cloth lying on a
// car can ever touch. A particle that sinks into it is lifted back onto the
// surface when it lies on top, or walked outward down the slope of a softened
// copy of the map when it has swung into a side, so the cover hangs down the
// doors instead of jumping onto the roof. Neither correction gives it any
// speed of its own. Friction is Coulomb's: a contact grips in proportion to
// how hard it is pressed, holds outright against a slight pull, and slows a
// slide by a constant amount, so silk either stays where it lies or slips
// off cleanly, never crawls.
//
// Held by its hem, the sheet is tethered (long-range attachments, after Kim,
// Chentanez and Müller, 2012): no particle may stray farther from the hand
// than it lies across the cloth, so a hanging length cannot stretch, however
// few the solver's iterations, and stops when the hand stops.
import * as THREE from 'three';

const HEIGHT_RANGE = 2.4; // metres the bake can record
// How deep a contact can press for friction's sake: an impact grips no
// harder than a heavy rest.
const GRIP_DEPTH = .004;
// The share of a step's slide friction takes back: all of it while the slide
// is within the static grip (a little more than the sliding one), otherwise
// a constant amount.
const grip = (slide, depth, mu) => {
  const d = Math.min(depth, GRIP_DEPTH);
  return slide <= mu * 1.3 * d + 1e-6 ? 1 : Math.min(1, mu * d / slide);
};

// The car's top surface on a grid over `domain` ({ x0, x1, z0, z1 }, metres),
// rendered from above into an 8-bit target (two channels per height, so it
// reads back on every WebGL device). Returns a sampler.
export function bakeHeight(renderer, root, domain, { cols = 220, rows = 280, lift = .025, grow = 2 } = {}) {
  const target = new THREE.WebGLRenderTarget(cols, rows, { type: THREE.UnsignedByteType, depthBuffer: true });
  const camera = new THREE.OrthographicCamera(domain.x0, domain.x1, -domain.z0, -domain.z1, .01, 30);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  // Screen right is +x, screen up is -z: the frustum's top is the most
  // negative z. (top = -z0 > bottom = -z1, as z0 < z1.)
  camera.top = -domain.z0; camera.bottom = -domain.z1;
  camera.updateProjectionMatrix();
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying float vY; void main(){ float v = clamp(vY / ${HEIGHT_RANGE.toFixed(2)}, 0.0, 1.0) * 255.0; float hi = floor(v); gl_FragColor = vec4(hi / 255.0, fract(v), 0.0, 1.0); }`,
  });
  const scene = new THREE.Scene();
  const parent = root.parent;
  scene.add(root);
  scene.overrideMaterial = material;
  const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha(), tone = renderer.toneMapping;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = new Uint8Array(cols * rows * 4);
  renderer.readRenderTargetPixels(target, 0, 0, cols, rows, pixels);
  renderer.setRenderTarget(null);
  renderer.setClearColor(clear, alpha);
  renderer.toneMapping = tone;
  scene.remove(root);
  parent?.add(root);
  target.dispose(); material.dispose();

  // Row 0 is the image's foot: screen-down, the most positive z.
  const raw = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = (r * cols + c) * 4;
    raw[(rows - 1 - r) * cols + c] = (pixels[k] + pixels[k + 1] / 255) / 255 * HEIGHT_RANGE;
  }
  // Grown a little (mirrors, trim) and smoothed, so the silk never catches on
  // a handle; then a much softer copy whose slope points outward.
  const grown = maxFilter(raw, cols, rows, grow);
  const sharp = boxBlur(grown, cols, rows, 1);
  for (let i = 0; i < sharp.length; i++) if (sharp[i] > .02) sharp[i] += lift;
  const soft = boxBlur(boxBlur(sharp, cols, rows, 7), cols, rows, 7);
  const sx = (domain.x1 - domain.x0) / cols, sz = (domain.z1 - domain.z0) / rows;
  const sample = (field, x, z) => {
    const fx = (x - domain.x0) / sx - .5, fz = (z - domain.z0) / sz - .5;
    const c0 = Math.floor(fx), r0 = Math.floor(fz), tx = fx - c0, tz = fz - r0;
    const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows) ? 0 : field[r * cols + c];
    return (at(c0, r0) * (1 - tx) + at(c0 + 1, r0) * tx) * (1 - tz) + (at(c0, r0 + 1) * (1 - tx) + at(c0 + 1, r0 + 1) * tx) * tz;
  };
  return {
    height: (x, z) => sample(sharp, x, z),
    // The soft map's slope, uphill: a particle inside the car walks against it.
    slope(x, z, out) {
      out.x = (sample(soft, x + sx * 2, z) - sample(soft, x - sx * 2, z)) / (sx * 4);
      out.z = (sample(soft, x, z + sz * 2) - sample(soft, x, z - sz * 2)) / (sz * 4);
      return out;
    },
    top: Math.max(...sharp),
    step: Math.min(sx, sz),
  };
}

function maxFilter(src, cols, rows, radius) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let k = -radius; k <= radius; k++) { const cc = c + k; if (cc >= 0 && cc < cols) m = Math.max(m, src[r * cols + cc]); }
    tmp[r * cols + c] = m;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let k = -radius; k <= radius; k++) { const rr = r + k; if (rr >= 0 && rr < rows) m = Math.max(m, tmp[rr * cols + c]); }
    out[r * cols + c] = m;
  }
  return out;
}

function boxBlur(src, cols, rows, radius) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), n = radius * 2 + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += src[r * cols + Math.min(cols - 1, Math.max(0, c + k))];
    tmp[r * cols + c] = s / n;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += tmp[Math.min(rows - 1, Math.max(0, r + k)) * cols + c];
    out[r * cols + c] = s / n;
  }
  return out;
}

// The sheet: `nx` × `nz` particles over `width` × `length` metres, centred on
// x = 0, z = `centreZ`, lying flat at `height`. Index i runs along x, j along
// z (towards the car's nose).
export function createCloth({ nx, nz, width, length, height, centreZ = 0, shear = .7, bending = .2, curvature = .02 }) {
  const count = nx * nz;
  const position = new Float32Array(count * 3), previous = new Float32Array(count * 3), weight = new Float32Array(count).fill(1);
  const dx = width / (nx - 1), dz = length / (nz - 1);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = (j * nx + i) * 3;
    position[k] = -width / 2 + i * dx; position[k + 1] = height; position[k + 2] = centreZ - length / 2 + j * dz;
  }
  previous.set(position);
  // Where each particle stood at the end of the last step: how far it moves
  // from step to step is what can be seen.
  const settled = position.slice();
  // The sheet's normal at each particle, for the air.
  const facing = new Float32Array(count * 3);
  // Constraints: stretch (neighbours), shear (diagonals), bend (every other).
  const pairs = [], rests = [];
  const link = (a, b) => {
    pairs.push(a, b);
    const pa = a * 3, pb = b * 3;
    rests.push(Math.hypot(position[pb] - position[pa], position[pb + 1] - position[pa + 1], position[pb + 2] - position[pa + 2]));
  };
  const id = (i, j) => j * nx + i;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (i + 1 < nx) link(id(i, j), id(i + 1, j));
    if (j + 1 < nz) link(id(i, j), id(i, j + 1));
  }
  // Shear and bend links after the stretch: woven cloth gives on the bias
  // and folds readily, so they are soft, and solved every other iteration.
  const firm = rests.length;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (i + 1 < nx && j + 1 < nz) { link(id(i, j), id(i + 1, j + 1)); link(id(i + 1, j), id(i, j + 1)); }
  }
  const bent = rests.length;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (i + 2 < nx) link(id(i, j), id(i + 2, j));
    if (j + 2 < nz) link(id(i, j), id(i, j + 2));
  }
  const A = Uint32Array.from(pairs.filter((_, k) => k % 2 === 0)), B = Uint32Array.from(pairs.filter((_, k) => k % 2 === 1));
  const R = Float32Array.from(rests);
  // Curvature, along every run of three: the middle particle is drawn to its
  // neighbours' midpoint. Distance constraints two apart cannot feel a zigzag
  // one particle wide; this resists a kink that small strongly and the broad
  // folds of the cloth hardly at all.
  const runs = [];
  for (let j = 0; j < nz; j++) for (let i = 1; i + 1 < nx; i++) runs.push(id(i - 1, j), id(i, j), id(i + 1, j));
  for (let j = 1; j + 1 < nz; j++) for (let i = 0; i < nx; i++) runs.push(id(i, j - 1), id(i, j), id(i, j + 1));
  const T = Uint32Array.from(runs);

  // Triangles facing up (+y) while the sheet lies flat: the silk's face.
  const index = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), d = id(i + 1, j + 1);
    index.push(a, b, c, c, b, d);
  }
  const uv = new Float32Array(count * 2);
  // v runs from the tail (1) to the nose (0): the artwork's top lies towards
  // the tail, so it reads the right way up to someone at the front of the car.
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = id(i, j) * 2; uv[k] = i / (nx - 1); uv[k + 1] = 1 - j / (nz - 1); }
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(position, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  const slope = { x: 0, z: 0 };
  const pins = new Map(); // particle -> target [x, y, z]
  let tethers = null; // per particle: anchor, longest reach
  const sim = {
    nx, nz, count, position, previous, weight, geometry, id,
    gravity: 9.81, damping: .993, air: 4.8, iterations: 6, friction: .45, floorFriction: .6, floor: .014,
    field: null, motion: 0,
    pin(k, target) { pins.set(k, target); weight[k] = 0; },
    unpin(k) { pins.delete(k); weight[k] = 1; },
    // Tethers to the held particles: each free particle to the one nearest
    // it across the flat sheet, no farther than that distance (and a hair).
    tether(held) {
      tethers = new Float32Array(count * 2).fill(-1);
      for (let p = 0; p < count; p++) {
        if (held.includes(p)) continue;
        let best = Infinity, anchor = -1;
        for (const h of held) {
          const d = Math.hypot((p % nx - h % nx) * dx, (Math.floor(p / nx) - Math.floor(h / nx)) * dz);
          if (d < best) { best = d; anchor = h; }
        }
        tethers[p * 2] = anchor; tethers[p * 2 + 1] = (best * 1.02) ** 2;
      }
    },
    // One step of `dt` seconds.
    step(dt) {
      const g = sim.gravity * dt * dt, damp = sim.damping, air = sim.air;
      if (air) face();
      for (let p = 0; p < count; p++) {
        const k = p * 3;
        if (!weight[p]) {
          const target = pins.get(p);
          previous[k] = position[k]; previous[k + 1] = position[k + 1]; previous[k + 2] = position[k + 2];
          position[k] = target[0]; position[k + 1] = target[1]; position[k + 2] = target[2];
          continue;
        }
        const x = position[k], y = position[k + 1], z = position[k + 2];
        let vx = (x - previous[k]) * damp, vy = (y - previous[k + 1]) * damp, vz = (z - previous[k + 2]) * damp;
        previous[k] = x; previous[k + 1] = y; previous[k + 2] = z;
        // Drag across the face: a share of the normal speed, growing with it
        // (`air` per metre; the step's displacement is its speed × dt).
        if (air) {
          const nx3 = facing[k], ny3 = facing[k + 1], nz3 = facing[k + 2];
          const vn = vx * nx3 + vy * ny3 + vz * nz3, cut = Math.min(1, air * Math.abs(vn)) * vn;
          vx -= nx3 * cut; vy -= ny3 * cut; vz -= nz3 * cut;
        }
        position[k] = x + vx; position[k + 1] = y + vy - g; position[k + 2] = z + vz;
      }
      const n = A.length, iterations = sim.iterations;
      // The soft constraints (shear, bending, curvature) are solved every other
      // iteration, stiffened to hold as firmly as ten passes at the cloth's
      // own figures would.
      const passes = Math.max(1, iterations >> 1);
      const stiffen = k => 1 - Math.pow(1 - k, 10 / passes);
      const ks = stiffen(shear), kb = stiffen(bending), kc = stiffen(curvature);
      for (let it = 0; it < iterations; it++) {
        if (tethers) for (let p = 0; p < count; p++) {
          const anchor = tethers[p * 2];
          if (anchor < 0 || !weight[p]) continue;
          const k = p * 3, a = anchor * 3;
          const ex = position[k] - position[a], ey = position[k + 1] - position[a + 1], ez = position[k + 2] - position[a + 2];
          const l2 = ex * ex + ey * ey + ez * ez, reach = tethers[p * 2 + 1];
          if (l2 <= reach) continue;
          const f = Math.sqrt(reach / l2);
          position[k] = position[a] + ex * f; position[k + 1] = position[a + 1] + ey * f; position[k + 2] = position[a + 2] + ez * f;
        }
        const soft = (it & 1) === 1 || iterations === 1;
        solve(0, firm, 1);
        if (soft) { solve(firm, bent, ks); solve(bent, n, kb); }
        if (soft && kc) for (let r = 0; r < T.length; r += 3) {
          const a = T[r], b = T[r + 1], c = T[r + 2], wa = weight[a], wb = weight[b], wc = weight[c];
          const w = wb + (wa + wc) / 4;
          if (!w) continue;
          const pa = a * 3, pb = b * 3, pc = c * 3;
          const kx = (position[pb] - (position[pa] + position[pc]) / 2) * kc / w;
          const ky = (position[pb + 1] - (position[pa + 1] + position[pc + 1]) / 2) * kc / w;
          const kz = (position[pb + 2] - (position[pa + 2] + position[pc + 2]) / 2) * kc / w;
          position[pb] -= kx * wb; position[pb + 1] -= ky * wb; position[pb + 2] -= kz * wb;
          position[pa] += kx * wa / 2; position[pa + 1] += ky * wa / 2; position[pa + 2] += kz * wa / 2;
          position[pc] += kx * wc / 2; position[pc + 1] += ky * wc / 2; position[pc + 2] += kz * wc / 2;
        }
        if (it === iterations >> 1 || it === iterations - 1) collide();
      }
      // How much it is still moving, as the eye judges a sheet: the average
      // speed of its particles since the end of the last step (corrections
      // made and undone within a step cannot be seen, so they do not count).
      let sum = 0;
      for (let k = 0; k < position.length; k += 3) {
        const mx = position[k] - settled[k], my = position[k + 1] - settled[k + 1], mz = position[k + 2] - settled[k + 2];
        sum += Math.sqrt(mx * mx + my * my + mz * mz);
      }
      settled.set(position);
      sim.motion = sum / count / dt;
    },
  };
  // Normals from the grid, by central differences (one-sided at the hems).
  function face() {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const l = id(Math.max(0, i - 1), j) * 3, r = id(Math.min(nx - 1, i + 1), j) * 3;
      const d = id(i, Math.max(0, j - 1)) * 3, u = id(i, Math.min(nz - 1, j + 1)) * 3;
      const ax = position[r] - position[l], ay = position[r + 1] - position[l + 1], az = position[r + 2] - position[l + 2];
      const bx = position[u] - position[d], by = position[u + 1] - position[d + 1], bz = position[u + 2] - position[d + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1, k = (j * nx + i) * 3;
      facing[k] = cx / len; facing[k + 1] = cy / len; facing[k + 2] = cz / len;
    }
  }
  // Distance constraints `from` to `to`, at `stiffness`.
  function solve(from, to, stiffness) {
    for (let c = from; c < to; c++) {
      const a = A[c], b = B[c], wa = weight[a], wb = weight[b], ws = wa + wb;
      if (!ws) continue;
      const pa = a * 3, pb = b * 3;
      const ex = position[pb] - position[pa], ey = position[pb + 1] - position[pa + 1], ez = position[pb + 2] - position[pa + 2];
      const len = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-9;
      const f = (len - R[c]) / (len * ws) * stiffness;
      position[pa] += ex * f * wa; position[pa + 1] += ey * f * wa; position[pa + 2] += ez * f * wa;
      position[pb] -= ex * f * wb; position[pb + 1] -= ey * f * wb; position[pb + 2] -= ez * f * wb;
    }
  }
  function collide() {
    const field = sim.field, mu = sim.friction, floorMu = sim.floorFriction, floor = sim.floor;
    for (let p = 0; p < count; p++) {
      if (!weight[p]) continue;
      const k = p * 3;
      let x = position[k], y = position[k + 1], z = position[k + 2];
      if (field) {
        const h = field.height(x, z);
        if (y < h) {
          // Out by the shorter way: up onto the surface, or (beside a steep
          // flank, where a centimetre sideways clears it) outward.
          const up = h - y;
          let wx = x, wz = z, walked = 0, clear = false;
          while (walked < Math.max(up, .98)) {
            field.slope(wx, wz, slope);
            const l = Math.hypot(slope.x, slope.z);
            if (l < 1e-5) break;
            // Fine steps close in, where the choice is made; longer beyond.
            const stride = walked < .1 ? .01 : .035;
            wx -= slope.x / l * stride; wz -= slope.z / l * stride; walked += stride;
            if (field.height(wx, wz) <= y) { clear = true; break; }
            if (up < .14 && walked >= up) break;
          }
          if (up < .14 && !(clear && walked < up)) {
            // On top: back onto the surface, pressed in by `up`, and its slide
            // over the step gripped.
            position[k + 1] = h;
            const sx = x - previous[k], sz = z - previous[k + 2];
            const cut = grip(Math.sqrt(sx * sx + sz * sz), up, mu);
            position[k] = x - sx * cut; position[k + 2] = z - sz * cut;
            previous[k + 1] = Math.max(previous[k + 1], h);
          } else {
            // In a side: out to where the walk came clear of it.
            if (clear) {
              // Out onto the side. The push itself is not motion: the particle
              // keeps no speed into or off the side (or the silk would rattle
              // against the car), only its slide along it, gripped.
              const ox = wx - x, oz = wz - z, ol = Math.sqrt(ox * ox + oz * oz) || 1, ux = ox / ol, uz = oz / ol;
              let sx = wx - previous[k], sy = y - previous[k + 1], sz = wz - previous[k + 2];
              const into = sx * ux + sz * uz;
              previous[k] += into * ux; previous[k + 2] += into * uz;
              sx -= into * ux; sz -= into * uz;
              const cut = grip(Math.sqrt(sx * sx + sy * sy + sz * sz), ol, mu);
              position[k] = wx - sx * cut; position[k + 1] = y - sy * cut; position[k + 2] = wz - sz * cut;
            } else position[k + 1] = h;
          }
        }
      }
      if (position[k + 1] < floor) {
        const depth = floor - position[k + 1];
        position[k + 1] = floor;
        const sx = position[k] - previous[k], sz = position[k + 2] - previous[k + 2];
        const cut = grip(Math.sqrt(sx * sx + sz * sz), depth, floorMu);
        position[k] -= sx * cut; position[k + 2] -= sz * cut;
        previous[k + 1] = floor;
      }
    }
  }
  return sim;
}
