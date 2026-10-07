// Prepare the supplied S-Class Maybach, BMW i7 and Land Cruiser models for
// the home page's collection drive (src/fleet-drive.js).
//
//   node tools/prep-fleet.mjs sclass|i7|landcruiser
//   (npm run model:fleet prepares all three and bakes their shadows)
//
// Writes build/<id>-clean.glb (uncompressed, for the shadow bake) and
// public/models/<id>.glb. For each car:
//   - give the materials the page restyles by plain names (paint, glass,
//     tyre…), and swap glass transmission for transparency
//   - bake every transform into the vertices, turn the nose to +Z, recentre
//     on the origin, tyres on the ground, scaled to the real length
//   - split tyres modelled one per axle into a left and a right
//   - group each tyre with the parts centred on its axle under
//     Wheel_FL/FR/RL/RR, origin on the axle, so the page can roll them
//   - merge parts that share a material, simplify, WebP textures at 1024 px
//     at most, meshopt-compress
//
// In the output the car's nose points at +Z and its left side faces +X.
import { NodeIO, PropertyType, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, simplifyPrimitive, textureCompress, transformMesh, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// Lengths: mercedes-benz.co.in (Maybach S 580, 5,469 mm), bmw.in (i7,
// 5,391 mm), toyotabharat.com (Land Cruiser 300, 4,985 mm).
const CARS = {
  sclass: {
    src: '2021_mercedes-benz_s-class_maybach(1).glb', length: 5.469, yaw: 0,
    materials: {
      Mphong4SG1: 'sclass_paint', Mphong6SG1: 'sclass_paint_upper',
      Mphong13SG1: 'sclass_glass', Mphong2SG1: 'sclass_glass', Mphong3SG1: 'sclass_tail_lens',
      Material_2125663091: 'sclass_tyre', Material_2125663092: 'sclass_tyre_wall', Material_2125663093: 'sclass_tyre_wall2',
    },
    tyre: 'sclass_tyre',
    // Tyres are modelled one mesh per axle.
    split: /^sclass_tyre/,
    drop: /LicensePlate/,
  },
  i7: {
    src: 'build/i7-raw.glb', length: 5.391, yaw: 90,
    materials: {
      // Its doors and sills carry a second paint material: one colour, as one car.
      'Carpaint Simple Ruby': 'i7_paint', 'Material #2125700745': 'i7_paint',
      glasss2222: 'i7_glass', 'Material #2125682976': 'i7_glass', glasss2222111: 'i7_lamp_lens',
      'Rubber Rough': 'i7_tyre', 'Rubber Rough222': 'i7_tyre_wall', Red_Light: 'i7_tail', lightt: 'i7_drl',
    },
    tyre: 'i7_tyre',
    // The source's blank number plates.
    drop: /^Object_1[12]$/,
  },
  landcruiser: {
    src: '2024_toyota_land_cruiser_lc300_vxr_409_tt(1).glb', length: 4.985, yaw: 0,
    materials: { CarPaint: 'lc_paint', ClearGlass: 'lc_glass', Light_glass: 'lc_lamp_lens', GlassRed: 'lc_tail_lens', Wheel: 'lc_tyre' },
    tyre: 'lc_tyre',
    // Over a million triangles, most of them in the cabin: simplify harder.
    error: 0.0012,
  },
};

const id = process.argv[2];
const car = CARS[id];
if (!car) throw new Error(`Usage: node tools/prep-fleet.mjs ${Object.keys(CARS).join('|')}`);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(car.src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

for (const mat of root.listMaterials()) {
  const name = car.materials[mat.getName()];
  if (name) mat.setName(name);
  // Glass: plain transparency instead of transmission.
  if (mat.getExtension('KHR_materials_transmission')) {
    mat.setExtension('KHR_materials_transmission', null);
    mat.setAlphaMode('BLEND');
  }
}
if (car.drop) for (const node of root.listNodes()) if (car.drop.test(node.getName())) node.dispose();
await doc.transform(prune(), flatten());
for (const node of scene.listChildren()) clearNodeTransform(node);
const meshNodes = () => scene.listChildren().filter(n => n.getMesh());
const fit = matrix => { const done = new Set(); for (const node of meshNodes()) { const mesh = node.getMesh(); if (!done.has(mesh)) { transformMesh(mesh, matrix); done.add(mesh); } } };

// Nose to +Z, then recentre and scale to the real length.
const a = car.yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
if (car.yaw) fit([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
{
  const b = getBounds(scene);
  const k = car.length / (b.max[2] - b.min[2]);
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  fit([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -cx * k, -b.min[1] * k, -cz * k, 1]);
}

const materialOf = node => node.getMesh().listPrimitives()[0]?.getMaterial()?.getName() ?? '';
const centre = b => b.min.map((v, i) => (v + b.max[i]) / 2);

// A tyre mesh spanning both sides of the car becomes a left and a right.
if (car.split) for (const node of meshNodes()) {
  const b = getBounds(node);
  if (!car.split.test(materialOf(node)) || b.min[0] > -0.3 || b.max[0] < 0.3) continue;
  for (const side of [1, -1]) {
    const mesh = doc.createMesh(`${node.getMesh().getName()}_${side}`);
    for (const original of node.getMesh().listPrimitives()) {
      const prim = original.clone();
      mesh.addPrimitive(prim);
      const position = prim.getAttribute('POSITION'), indices = prim.getIndices();
      const kept = [];
      for (let i = 0; i < indices.getCount(); i += 3) {
        const tri = [indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)];
        const x = tri.reduce((sum, v) => sum + position.getElement(v, [])[0], 0) / 3;
        if (Math.sign(x) === side) kept.push(...tri);
      }
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(indices.getBuffer()));
    }
    scene.addChild(doc.createNode(`${node.getName()}_${side > 0 ? 'L' : 'R'}`).setMesh(mesh));
  }
  node.dispose();
}

// Wheels, from the tyres out: every part centred on a tyre's axle and no
// bigger than it, from the tyre's outer face to a little inside it.
const tyres = meshNodes().filter(n => materialOf(n) === car.tyre);
if (process.env.DEBUG) for (const n of meshNodes().filter(n => /tyre/.test(materialOf(n)))) { const b = getBounds(n); console.log('tyre?', n.getName(), materialOf(n), b.min.map(v => v.toFixed(2)), b.max.map(v => v.toFixed(2))); }
if (tyres.length !== 4) throw new Error(`Expected 4 tyres, found ${tyres.length}: ${tyres.map(n => n.getName()).join(', ')}`);
const claimed = new Set();
const wheels = {};
for (const tyre of tyres) {
  const box = getBounds(tyre), axle = centre(box);
  const radius = (box.max[1] - box.min[1]) / 2, width = box.max[0] - box.min[0], side = Math.sign(axle[0]);
  const key = `${axle[2] > 0 ? 'F' : 'R'}${side > 0 ? 'L' : 'R'}`;
  const outer = side > 0 ? box.max[0] : -box.min[0];
  const members = meshNodes().filter(n => {
    if (claimed.has(n)) return false;
    const b = getBounds(n), m = centre(b);
    if (Math.abs(m[1] - axle[1]) > radius * 0.15 || Math.abs(m[2] - axle[2]) > radius * 0.15) return false;
    if (b.max[1] - b.min[1] > radius * 2.06 || b.max[2] - b.min[2] > radius * 2.06) return false;
    const out = side > 0 ? b.max[0] : -b.min[0], inner = side > 0 ? b.min[0] : -b.max[0];
    return out <= outer + 0.02 && inner >= Math.abs(axle[0]) - width * 1.8;
  });
  members.forEach(n => claimed.add(n));
  wheels[key] = { axle, radius, width, members };
}
if (Object.keys(wheels).length !== 4) throw new Error(`Expected four wheel corners, found ${Object.keys(wheels).join(',')}`);
const paintName = Object.values(car.materials).find(name => name.endsWith('_paint'));
let rim = null;
for (const [key, { axle, radius, members }] of Object.entries(wheels)) {
  const pivot = doc.createNode(`Wheel_${key}`).setTranslation(axle);
  for (const n of members) {
    transformMesh(n.getMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -axle[0], -axle[1], -axle[2], 1]);
    scene.removeChild(n);
    pivot.addChild(n);
  }
  scene.addChild(pivot);
  // Wheels modelled in the body's paint get their own rim finish.
  for (const n of members) for (const prim of n.getMesh().listPrimitives()) {
    const mat = prim.getMaterial();
    if (mat?.getName() !== paintName) continue;
    rim ??= mat.clone().setName(`${id}_rim`);
    prim.setMaterial(rim);
  }
  console.log(`Wheel_${key}: axle ${axle.map(v => v.toFixed(3)).join(', ')}, radius ${radius.toFixed(3)} m, ${members.length} parts (${[...new Set(members.map(materialOf))].join(', ')})`);
}

// Drop vertex colours and UVs nothing samples.
for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) {
  const textured = prim.getMaterial()?.getBaseColorTexture() || prim.getMaterial()?.getNormalTexture();
  for (const semantic of prim.listSemantics()) if (semantic.startsWith('COLOR_') || (!textured && semantic.startsWith('TEXCOORD_'))) prim.setAttribute(semantic, null);
}
// Each triangle faces the way its vertex normals do: mirrored parts, baked,
// would otherwise show their insides (dark patches under double-sided paint).
let flipped = 0;
for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) {
  const position = prim.getAttribute('POSITION'), normal = prim.getAttribute('NORMAL'), indices = prim.getIndices();
  if (!normal || !indices) continue;
  const p = [[], [], []], n = [[], [], []];
  const array = indices.getArray();
  for (let i = 0; i < array.length; i += 3) {
    for (let k = 0; k < 3; k++) { position.getElement(array[i + k], p[k]); normal.getElement(array[i + k], n[k]); }
    const u = p[1].map((v, j) => v - p[0][j]), w = p[2].map((v, j) => v - p[0][j]);
    const face = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const dot = face.reduce((sum, v, j) => sum + v * (n[0][j] + n[1][j] + n[2][j]), 0);
    if (dot < 0) { [array[i + 1], array[i + 2]] = [array[i + 2], array[i + 1]]; flipped++; }
  }
  indices.setArray(array);
}
console.log(`  ${flipped} triangles turned to face out`);
if (car.smooth) for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) if (car.smooth.test(prim.getMaterial()?.getName() ?? '')) prim.setAttribute('NORMAL', null);
await doc.transform(prune(), weld());
// Smooth normals where they were dropped: each vertex takes the area-weighted
// normals of the faces around its position, across UV seams too.
for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) {
  if (prim.getAttribute('NORMAL') || !prim.getIndices()) continue;
  const position = prim.getAttribute('POSITION'), array = prim.getIndices().getArray();
  const count = position.getCount(), sums = new Map(), keyOf = new Array(count), p = [[], [], []];
  for (let v = 0; v < count; v++) keyOf[v] = position.getElement(v, []).map(x => Math.round(x * 1e4)).join(',');
  for (let i = 0; i < array.length; i += 3) {
    for (let k = 0; k < 3; k++) position.getElement(array[i + k], p[k]);
    const u = p[1].map((v, j) => v - p[0][j]), w = p[2].map((v, j) => v - p[0][j]);
    const face = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (let k = 0; k < 3; k++) { const key = keyOf[array[i + k]]; const sum = sums.get(key) ?? [0, 0, 0]; sums.set(key, sum.map((v, j) => v + face[j])); }
  }
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) { const n = sums.get(keyOf[v]) ?? [0, 1, 0]; const l = Math.hypot(...n) || 1; out.set(n.map(x => x / l), v * 3); }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(position.getBuffer()));
}
await doc.transform(join({ keepNamed: false }), prune());

const triangles = () => root.listMeshes().flatMap(m => m.listPrimitives()).reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const fb = getBounds(scene);
const w = wheels;
console.log(`${id}: ${fb.max.map((v, i) => (v - fb.min[i]).toFixed(3)).join(' x ')} m, ${triangles() | 0} triangles, ${root.listMeshes().length} meshes`);
console.log(`  wheelbase ${(w.FL.axle[2] - w.RL.axle[2]).toFixed(3)}, track ${(w.FL.axle[0] - w.FR.axle[0]).toFixed(3)}, wheel radius ${((w.FL.radius + w.RL.radius) / 2).toFixed(3)}`);
await io.write(`build/${id}-clean.glb`, doc);

for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) {
  // Paint and glass are thin double layers: simplified coarsely they fold
  // through each other, so they keep nearly every triangle.
  const fine = /_(paint|glass)/.test(prim.getMaterial()?.getName() ?? '');
  if (prim.getIndices()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: fine ? 0.00015 : car.error ?? 0.0006, lockBorder: true });
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 84 }),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
console.log(`  compressed: ${triangles() | 0} triangles`);
await io.write(`public/models/${id}.glb`, doc);
