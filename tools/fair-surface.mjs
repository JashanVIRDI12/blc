// Panel beating for a game-weight body. A car body of a few tens of thousands
// of triangles keeps its outline, but its faces no longer agree on which way
// each panel faces: wherever the triangles run small or thin the normals
// wander by degrees, and lit, and above all reflecting, the panel looks
// dented. The shape is left exactly as it is; the normals are faired:
//
//   1. long edges are halved until none is longer than the grain, so a wide
//      flat panel carries as many normals as a tight curve does
//   2. each vertex gets a normal from the faces round it, one for each side
//      of a crease, so a panel's edge or a swage line stays sharp
//   3. each normal is then averaged with those within a few centimetres of
//      it across the panel, by area, nearer ones counting for more (never
//      across a crease, and less with a normal that points well away, so a
//      soft fold survives). The averaging is over the surface, not over the
//      mesh, so it does not depend on how the panel happens to be cut up.
//
// Plain typed arrays in and out, so it runs in Node and in a browser.
//
//   position  Float32Array, three per vertex
//   index     triangle indices
//   grain     the longest edge left after refining, metres (0 leaves them)
//   crease    edges folded more sharply than this (degrees) stay sharp
//   spread    how far the averaging reaches: its Gaussian's sigma, metres
//   accord    how unlike a normal may be and still count (sigma, degrees)
//   passes    times the averaging runs
export function fairSurface(position, index, { grain = .08, crease = 38, spread = .07, accord = 25, passes = 2, weld = 1e-5 } = {}) {
  // Vertices at one position are one point of the surface.
  const count = position.length / 3, point = new Uint32Array(count), points = [], seen = new Map();
  for (let v = 0; v < count; v++) {
    const key = `${Math.round(position[v * 3] / weld)},${Math.round(position[v * 3 + 1] / weld)},${Math.round(position[v * 3 + 2] / weld)}`;
    let id = seen.get(key);
    if (id === undefined) { id = points.length / 3; seen.set(key, id); points.push(position[v * 3], position[v * 3 + 1], position[v * 3 + 2]); }
    point[v] = id;
  }
  let tris = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = point[index[i]], b = point[index[i + 1]], c = point[index[i + 2]];
    if (a !== b && b !== c && c !== a) tris.push(a, b, c);
  }

  // 1. Halve every edge longer than the grain, in each triangle that has it,
  // so the mesh stays closed: one, two or all three of a triangle's edges.
  const apart = (a, b) => Math.hypot(points[a * 3] - points[b * 3], points[a * 3 + 1] - points[b * 3 + 1], points[a * 3 + 2] - points[b * 3 + 2]);
  for (let round = 0; grain > 0 && round < 10; round++) {
    const halves = new Map(), out = [];
    const halve = (a, b) => {
      if (apart(a, b) <= grain) return -1;
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let id = halves.get(key);
      if (id === undefined) { id = points.length / 3; halves.set(key, id); for (let j = 0; j < 3; j++) points.push((points[a * 3 + j] + points[b * 3 + j]) / 2); }
      return id;
    };
    for (let i = 0; i < tris.length; i += 3) {
      let a = tris[i], b = tris[i + 1], c = tris[i + 2], ab = halve(a, b), bc = halve(b, c), ca = halve(c, a);
      const cut = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (!cut) out.push(a, b, c);
      else if (cut === 3) out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      else if (cut === 1) {
        if (ab >= 0) out.push(a, ab, c, ab, b, c);
        else if (bc >= 0) out.push(a, b, bc, a, bc, c);
        else out.push(a, b, ca, ca, b, c);
      } else {
        // Turn the triangle so its whole edge is c to a; the corner at b
        // comes off, and what is left is cut along its shorter diagonal.
        if (ab < 0) [a, b, c, ab, bc] = [b, c, a, bc, ca];
        else if (bc < 0) [a, b, c, ab, bc] = [c, a, b, ca, ab];
        out.push(ab, b, bc);
        if (apart(a, bc) <= apart(ab, c)) out.push(a, ab, bc, a, bc, c); else out.push(a, ab, c, ab, bc, c);
      }
    }
    tris = out;
    if (!halves.size) break;
  }
  const P = Float64Array.from(points), total = P.length / 3;
  const F = tris.length / 3, normal = new Float64Array(F * 3), area = new Float64Array(F);
  for (let f = 0; f < F; f++) {
    const a = tris[f * 3] * 3, b = tris[f * 3 + 1] * 3, c = tris[f * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx, l = Math.hypot(x, y, z) || 1;
    normal[f * 3] = x / l; normal[f * 3 + 1] = y / l; normal[f * 3 + 2] = z / l; area[f] = l / 2;
  }

  // Faces across each edge. An edge is a crease where the panel ends, where
  // more than two faces meet, or where it is folded past the crease angle.
  const across = new Map();
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const a = tris[f * 3 + k], b = tris[f * 3 + (k + 1) % 3], key = a < b ? a * total + b : b * total + a;
    const faces = across.get(key);
    if (faces) faces.push(f); else across.set(key, [f]);
  }
  const fold = Math.cos(crease * Math.PI / 180), neighbours = new Int32Array(F * 3).fill(-1);
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const a = tris[f * 3 + k], b = tris[f * 3 + (k + 1) % 3], faces = across.get(a < b ? a * total + b : b * total + a);
    if (faces.length !== 2) continue;
    const g = faces[0] === f ? faces[1] : faces[0];
    if (normal[f * 3] * normal[g * 3] + normal[f * 3 + 1] * normal[g * 3 + 1] + normal[f * 3 + 2] * normal[g * 3 + 2] >= fold) neighbours[f * 3 + k] = g;
  }

  // 2. The faces round a vertex fall into fans that no crease divides. Each
  // fan is one vertex of the result, with one normal: its faces', weighted
  // by the angle each subtends there.
  const around = Array.from({ length: total }, () => []);
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) around[tris[f * 3 + k]].push(f);
  const fan = new Int32Array(F * 3).fill(-1), at = [], raw = [], weight = [];
  const corner = (f, v) => tris[f * 3] === v ? 0 : tris[f * 3 + 1] === v ? 1 : 2;
  for (let v = 0; v < total; v++) {
    for (const start of around[v]) {
      if (fan[start * 3 + corner(start, v)] >= 0) continue;
      const id = at.length, members = [start], sum = [0, 0, 0];
      let share = 0;
      fan[start * 3 + corner(start, v)] = id;
      for (let i = 0; i < members.length; i++) {
        const f = members[i], k = corner(f, v);
        // The two edges of this face that meet at v: k (v to the next) and k + 2 (the previous to v).
        for (const edge of [k, (k + 2) % 3]) {
          const g = neighbours[f * 3 + edge];
          if (g < 0) continue;
          const c = corner(g, v);
          if (fan[g * 3 + c] < 0) { fan[g * 3 + c] = id; members.push(g); }
        }
        const b = tris[f * 3 + (k + 1) % 3] * 3, c = tris[f * 3 + (k + 2) % 3] * 3, a = v * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
        const angle = Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy + uz * wz) / ((Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz)) || 1))));
        for (let j = 0; j < 3; j++) sum[j] += normal[f * 3 + j] * angle;
        share += area[f] / 3;
      }
      const l = Math.hypot(...sum) || 1;
      at.push(v); raw.push(sum[0] / l, sum[1] / l, sum[2] / l); weight.push(share);
    }
  }
  const nodes = at.length;

  // 3. Each normal with those near it on the same panel. Fans that share a
  // face are neighbours; the search walks out from each over neighbours and
  // stops at 2.5 sigma.
  const links = Array.from({ length: nodes }, () => new Set());
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) { const a = fan[f * 3 + k], b = fan[f * 3 + (k + 1) % 3]; links[a].add(b); links[b].add(a); }
  const linked = links.map(set => Int32Array.from(set));
  let faired = Float64Array.from(raw);
  if (spread > 0) {
    const limit = (spread * 2.5) ** 2, near = 2 * spread * spread, like = 2 * (accord * Math.PI / 180) ** 2;
    const visited = new Int32Array(nodes).fill(-1), queue = new Int32Array(nodes);
    for (let pass = 0; pass < passes; pass++) {
      const next = new Float64Array(nodes * 3);
      for (let s = 0; s < nodes; s++) {
        const sx = P[at[s] * 3], sy = P[at[s] * 3 + 1], sz = P[at[s] * 3 + 2];
        const nx = faired[s * 3], ny = faired[s * 3 + 1], nz = faired[s * 3 + 2];
        let x = 0, y = 0, z = 0, head = 0, tail = 0;
        queue[tail++] = s; visited[s] = s;
        while (head < tail) {
          const u = queue[head++], p = at[u] * 3;
          const d = (P[p] - sx) ** 2 + (P[p + 1] - sy) ** 2 + (P[p + 2] - sz) ** 2;
          const dot = Math.max(-1, Math.min(1, faired[u * 3] * nx + faired[u * 3 + 1] * ny + faired[u * 3 + 2] * nz)), turn = Math.acos(dot);
          const w = weight[u] * Math.exp(-d / near - turn * turn / like);
          x += faired[u * 3] * w; y += faired[u * 3 + 1] * w; z += faired[u * 3 + 2] * w;
          for (const n of linked[u]) {
            if (visited[n] === s) continue;
            const q = at[n] * 3;
            if ((P[q] - sx) ** 2 + (P[q + 1] - sy) ** 2 + (P[q + 2] - sz) ** 2 > limit) continue;
            visited[n] = s; queue[tail++] = n;
          }
        }
        const l = Math.hypot(x, y, z) || 1;
        next[s * 3] = x / l; next[s * 3 + 1] = y / l; next[s * 3 + 2] = z / l;
      }
      faired = next; visited.fill(-1);
    }
  }

  const outPosition = new Float32Array(nodes * 3);
  for (let s = 0; s < nodes; s++) for (let j = 0; j < 3; j++) outPosition[s * 3 + j] = P[at[s] * 3 + j];
  // How far the fairing turned the normals: the median and the most, degrees.
  const turned = [];
  for (let s = 0; s < nodes; s++) turned.push(Math.acos(Math.max(-1, Math.min(1, raw[s * 3] * faired[s * 3] + raw[s * 3 + 1] * faired[s * 3 + 1] + raw[s * 3 + 2] * faired[s * 3 + 2]))) * 180 / Math.PI);
  turned.sort((a, b) => a - b);
  return { position: outPosition, normal: Float32Array.from(faired), index: Uint32Array.from(fan), turned: { median: turned[nodes >> 1] ?? 0, most: turned.at(-1) ?? 0 } };
}
