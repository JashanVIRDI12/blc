// Prepare the supplied car showroom (car-showroom_2.glb) for the film.
// Keep its luminous ceiling grid, panelled walls and proportions (metres, as
// authored). Cut two drive-through doorways at existing wall-panel seams:
// vehicles enter at the rear and leave at the front. The source floor plane
// and the emissive panel hidden beneath it are removed; the film supplies a
// polished floor that continues beyond the doorways.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { stat, writeFile } from 'node:fs/promises';
import { showroomRoom } from '../src/showroom-room.js';

await MeshoptEncoder.ready;
const source = 'car-showroom_2.glb', output = 'public/models/showroom.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(source), root = doc.getRoot(), scene = root.getDefaultScene();
const sourceBounds = getBounds(scene);
await doc.transform(flatten());
for (const n of scene.listChildren()) clearNodeTransform(n);

const rename = { Light: 'showroom_panels', Metallic_Dark_Grey: 'showroom_grid', Wall: 'showroom_walls', 'Material.006': 'showroom_floor' };
for (const mat of root.listMaterials()) if (rename[mat.getName()]) mat.setName(rename[mat.getName()]);
const primitiveOf = name => root.listMeshes().flatMap(m => m.listPrimitives()).find(p => p.getMaterial()?.getName() === name);

// Triangle soup helpers. The showroom has no textures, so UVs are dropped.
function readTriangles(primitive) {
  const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL');
  const index = primitive.getIndices().getArray(), triangles = [];
  for (let i = 0; i < index.length; i += 3) triangles.push([0, 1, 2].map(k => ({
    p: position.getElement(index[i + k], []), n: normal.getElement(index[i + k], []),
  })));
  return triangles;
}
function writeTriangles(primitive, triangles) {
  const p = new Float32Array(triangles.length * 9), n = new Float32Array(triangles.length * 9);
  triangles.forEach((t, i) => t.forEach((v, k) => { p.set(v.p, i * 9 + k * 3); n.set(v.n, i * 9 + k * 3); }));
  const buffer = root.listBuffers()[0];
  primitive.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p).setBuffer(buffer));
  primitive.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(buffer));
  primitive.setAttribute('TEXCOORD_0', null);
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from({ length: triangles.length * 3 }, (_, i) => i)).setBuffer(buffer));
}
const lerp = (a, b, t) => ({ p: a.p.map((v, i) => v + (b.p[i] - v) * t), n: a.n.map((v, i) => v + (b.n[i] - v) * t) });
// Sutherland-Hodgman against one half-space: keep axis value * sign >= limit * sign.
function clip(polygon, axis, limit, sign) {
  const out = [];
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const da = (a.p[axis] - limit) * sign, db = (b.p[axis] - limit) * sign;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) out.push(lerp(a, b, da / (da - db)));
  });
  return out;
}
const fan = polygon => polygon.slice(1, -1).map((v, i) => [polygon[0], v, polygon[i + 2]]);

// Drop the hidden emissive plane at floor level (it sits under the old floor).
const panels = primitiveOf('showroom_panels');
writeTriangles(panels, readTriangles(panels).filter(t => t.some(v => v.p[1] > .05)));

// Doorways: remove the wall between two panel seams up to the lintel, then
// close the cut with jambs and a lintel soffit so the wall reads as solid.
const walls = primitiveOf('showroom_walls');
let wallTriangles = readTriangles(walls);
const { inner, outer } = showroomRoom.wall;
for (const door of showroomRoom.doorways) {
  const side = Math.sign(door.z), [x0, x1] = door.x, top = door.height;
  const inWall = t => t.every(v => v.p[2] * side > inner - .05);
  const next = [];
  for (const t of wallTriangles) {
    if (!inWall(t)) { next.push(t); continue; }
    const left = clip(t, 0, x0, -1), right = clip(t, 0, x1, 1);
    const above = clip(clip(clip(t, 0, x0, 1), 0, x1, -1), 1, top, 1);
    for (const piece of [left, right, above]) if (piece.length >= 3) next.push(...fan(piece));
  }
  const zi = inner * side, zo = outer * side;
  // Wind each new face towards its normal; the material is double-sided and
  // three.js flips the shading normal of back faces.
  const face = (points, n) => {
    const [a, b, c] = points, u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]);
    const facing = (u[1] * w[2] - u[2] * w[1]) * n[0] + (u[2] * w[0] - u[0] * w[2]) * n[1] + (u[0] * w[1] - u[1] * w[0]) * n[2];
    next.push((facing < 0 ? [a, c, b] : points).map(p => ({ p, n })));
  };
  const quad = (a, b, c, d, n) => { face([a, b, c], n); face([a, c, d], n); };
  quad([x0, 0, zi], [x0, top, zi], [x0, top, zo], [x0, 0, zo], [1, 0, 0]);
  quad([x1, 0, zo], [x1, top, zo], [x1, top, zi], [x1, 0, zi], [-1, 0, 0]);
  quad([x0, top, zi], [x1, top, zi], [x1, top, zo], [x0, top, zo], [0, -1, 0]);
  wallTriangles = next;
}
writeTriangles(walls, wallTriangles);
primitiveOf('showroom_grid').setAttribute('TEXCOORD_0', null);

// The film draws its own continuous floor.
for (const node of root.listNodes()) if (node.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName() === 'showroom_floor') node.dispose();

await doc.transform(prune(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(output, doc);
const audit = {
  source, output, sourceBytes: (await stat(source)).size, outputBytes: (await stat(output)).size,
  sourceBounds, preparedBounds: getBounds(scene), room: showroomRoom,
  changes: [
    'Rear and front doorways cut at existing panel seams, closed with jambs and lintel soffits',
    'Source floor plane and hidden floor-level emissive plane removed; the film supplies the floor',
    'Materials renamed for the film; untextured, so UVs removed',
  ],
  triangles: root.listMeshes().flatMap(m => m.listPrimitives()).reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0),
};
await writeFile('docs/showroom-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(audit);
