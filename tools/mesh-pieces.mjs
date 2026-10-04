// Helpers shared by the model prep scripts for cutting one game/Sketchfab
// mesh into the parts the page moves on its own.

import { getBounds } from "@gltf-transform/core";

// Connected pieces of a primitive (vertices welded by position), each with
// its triangles (offsets into the index array) and bounds.
export function pieces(prim) {
  const pos = prim.getAttribute("POSITION").getArray();
  const idx = prim.getIndices().getArray();
  const count = pos.length / 3;
  const parent = Int32Array.from({ length: count }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const byPosition = new Map();
  for (let v = 0; v < count; v++) {
    const k = `${pos[v * 3].toFixed(4)},${pos[v * 3 + 1].toFixed(4)},${pos[v * 3 + 2].toFixed(4)}`;
    if (byPosition.has(k)) parent[find(v)] = find(byPosition.get(k));
    else byPosition.set(k, v);
  }
  for (let t = 0; t < idx.length; t += 3) {
    parent[find(idx[t + 1])] = find(idx[t]);
    parent[find(idx[t + 2])] = find(idx[t]);
  }
  const found = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t]);
    if (!found.has(r)) found.set(r, { tris: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    const piece = found.get(r);
    piece.tris.push(t);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 3; i++) {
        const c = pos[idx[t + k] * 3 + i];
        piece.min[i] = Math.min(piece.min[i], c);
        piece.max[i] = Math.max(piece.max[i], c);
      }
    }
  }
  return [...found.values()];
}

// Move triangles out of a primitive into a new node (added to `scene`) with
// its own copy of the vertex data, so it can be transformed on its own.
export function carve(doc, scene, prim, tris, material, name) {
  const idx = prim.getIndices().getArray();
  const moving = new Set(tris);
  const keep = [];
  const remap = new Map();
  const moved = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!moving.has(t)) {
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      if (!remap.has(v)) remap.set(v, remap.size);
      moved.push(remap.get(v));
    }
  }
  prim.getIndices().setArray(new Uint32Array(keep));
  const order = [...remap.keys()];
  const copy = doc.createPrimitive().setMaterial(material);
  for (const semantic of prim.listSemantics()) {
    const a = prim.getAttribute(semantic);
    const size = a.getElementSize();
    const from = a.getArray();
    const to = new from.constructor(order.length * size);
    order.forEach((v, i) => to.set(from.subarray(v * size, v * size + size), i * size));
    copy.setAttribute(semantic, doc.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(to).setBuffer(a.getBuffer()));
  }
  copy.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(moved)).setBuffer(prim.getIndices().getBuffer()));
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(copy));
  scene.addChild(node);
  return node;
}

export function inside(piece, bounds, margin) {
  return [0, 1, 2].every((i) => piece.min[i] >= bounds.min[i] - margin && piece.max[i] <= bounds.max[i] + margin);
}

export function centre(bounds) {
  return bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
}

export function boundsOf(nodes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    const nb = getBounds(n);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], nb.min[i]);
      max[i] = Math.max(max[i], nb.max[i]);
    }
  }
  return { min, max };
}
