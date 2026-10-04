// Turn one of the supplied Sketchfab GLBs of the GLS game mod into a car
// model for the page. Which car, and the names of its parts, come from
// tools/cars/<car>.mjs.
//
//   node tools/prep-model.mjs gls source/mersedes-_benz_gls.glb build/gls-clean.glb public/models/gls.glb
//
// Writes an uncompressed copy (for the shadow bake) and the compressed model
// the page loads. Run through `npm run model`.
// Steps:
//   - drop duplicate trim variants that sit on top of each other and flicker
//   - bake every transform into the vertices, recentre the car on the origin,
//     tyres on the ground, scaled to its real length
//   - group each tyre with its rim under Wheel_FL/FR/RL/RR, origin on the axle,
//     so the page can spin them (the brake calipers stay put)
//   - hinge the bonnet, four doors and tailgate: each gets a pivot node on its
//     hinge line (Bonnet, Door_FL/FR/RL/RR, Tailgate) carrying its panels,
//     trim, mirror and glass. The rear-door and tailgate windows were baked
//     into one fixed-glass mesh, so those pieces are cut out and moved across
//   - cut the grille face out of the shared black-plastic material so the page
//     can give it its own finish (material "grille_face"), and likewise the
//     badges ("logo_chrome"), the radar cover ("star_cover") and the steering
//     wheel ("steering_leather")
//   - strip unused vertex colours and UVs, tidy material names, and merge
//     parts that share a material to cut draw calls
//   - meshopt-compress. Deliberately no material dedup: several parts share
//     identical game settings (badges, mirror indicators, brake light) but
//     get different real-world materials on the page by name.
//
// In the output the car's nose points at +Z and its left side faces +X.

import { NodeIO, PropertyType, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, simplifyPrimitive, transformMesh, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { boundsOf, carve as carveFrom, centre, inside, pieces } from "./mesh-pieces.mjs";

const [carName, src, cleanOut, out] = process.argv.slice(2);
const { default: car } = await import(`./cars/${carName}.mjs`);
const { realLength: REAL_LENGTH, tyre: TYRE, rim: RIM, moving: MOVING, fixedGlass: FIXED_GLASS, grille: GRILLE } = car;
const DROP = new Set(car.drop);
const BADGES = car.badges ?? [];
const STEERING_WHEEL = car.steeringWheel;
// Only the cabin is simplified. Simplifying the body panels tore holes in
// the doors and bumpers, so paint, glass and trim keep every triangle.
const SIMPLIFY = new Set(["gls_interior", "gls_interior1", "gls_torpedka1", "gls_leather_niz", "gls_din"]);
const SIMPLIFY_ERROR = 0.0008; // fraction of each mesh's size

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

const carve = (prim, tris, material, name) => carveFrom(doc, scene, prim, tris, material, name);
const byName = (name) => root.listNodes().find((n) => n.getName() === name || n.getName().replace(/\.\d+$/, "") === name);
const meshNodes = (node) => {
  const found = [];
  node.traverse((n) => n.getMesh() && found.push(n));
  return found;
};

for (const name of DROP) {
  const node = byName(name);
  if (!node) throw new Error(`Expected part ${name} not found`);
  const doomed = [];
  node.traverse((n) => doomed.push(n));
  doomed.forEach((n) => n.dispose());
}

// Separate real engine surfaces from shared exterior paint/chrome before
// joining meshes, so inspecting the engine doesn't recolour the body.
for (const [name, mapping] of Object.entries(car.materialOverrides ?? {})) {
  const node = byName(name);
  if (!node) throw new Error(`Expected material override part ${name} not found`);
  for (const n of meshNodes(node)) for (const prim of n.getMesh().listPrimitives()) {
    const material = prim.getMaterial();
    const key = material?.getName().replace(/\.\d+$/, '');
    if (mapping[key]) prim.setMaterial(material.clone().setName(mapping[key]));
  }
}

// Remember which mesh nodes make up each wheel before the hierarchy goes.
const midX = centre(getBounds(scene))[0];
const wheelParts = root.listNodes().filter((n) => TYRE.test(n.getName()) || RIM.test(n.getName()));
const tyres = wheelParts.filter((n) => TYRE.test(n.getName()));
const wheelOf = new Map();
for (const part of wheelParts) {
  const c = centre(getBounds(part));
  const key = `${c[2] > 0 ? "F" : "R"}${c[0] > midX ? "L" : "R"}`;
  for (const n of meshNodes(part)) wheelOf.set(n, key);
}
if (tyres.length !== 4) throw new Error(`Expected 4 tyres, found ${tyres.length}`);

// Likewise for every named part the later steps need.
const partNodes = new Map();
for (const name of new Set([...Object.values(MOVING).flatMap((m) => m.parts), FIXED_GLASS, GRILLE].filter(Boolean))) {
  const node = byName(name);
  if (!node) throw new Error(`Expected part ${name} not found`);
  partNodes.set(name, meshNodes(node));
}

await doc.transform(flatten());
for (const node of scene.listChildren()) clearNodeTransform(node);

// Recentre and scale to real size.
const b = getBounds(scene);
const s = REAL_LENGTH / (b.max[2] - b.min[2]);
const cx = (b.min[0] + b.max[0]) / 2;
const cz = (b.min[2] + b.max[2]) / 2;
const fit = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -cx * s, -b.min[1] * s, -cz * s, 1];
const done = new Set();
for (const node of scene.listChildren()) {
  const mesh = node.getMesh();
  if (mesh && !done.has(mesh)) {
    transformMesh(mesh, fit);
    done.add(mesh);
  }
}

// Grille face: the biggest piece of black plastic in the front bumper.
if (GRILLE) {
  const [node, prim] = partNodes.get(GRILLE).flatMap((n) => n.getMesh().listPrimitives().map((p) => [n, p]))
    .find(([, p]) => p.getMaterial()?.getName().startsWith("gls_kaki"));
  const grille = pieces(prim).sort((a, b) => b.tris.length - a.tris.length)[0];
  const width = grille.max[0] - grille.min[0];
  if (width < 0.9 || width > 1.2) throw new Error(`Grille piece is ${width.toFixed(2)} m wide; the model changed`);
  carve(prim, grille.tris, prim.getMaterial().clone().setName("grille_face"), "Grille");
  console.log(`Grille: ${grille.tris.length} triangles, ${width.toFixed(2)} m wide`);
}

// Hinged parts.
const skins = Object.fromEntries(Object.entries(MOVING).map(([key, m]) => [key, boundsOf(partNodes.get(m.skin))]));
const members = Object.fromEntries(Object.entries(MOVING).map(([key, m]) => [key, m.parts.flatMap((p) => partNodes.get(p))]));
for (const node of FIXED_GLASS ? partNodes.get(FIXED_GLASS) : []) {
  for (const prim of node.getMesh().listPrimitives()) {
    for (const piece of pieces(prim)) {
      const owner = Object.keys(MOVING).find((key) => inside(piece, skins[key], 0.03));
      if (owner) members[owner].push(carve(prim, piece.tris, prim.getMaterial(), `${owner}_glass`));
    }
  }
}
// Badges: the grille star and the star on the tailgate share the dark trim
// material with half the car, so they're cut out to be finished in chrome.
// The radar cover over the grille star gets its own clear glass, and the
// steering wheel rim its own leather (it shares the seats'). Pieces cut from
// an opening part stay with it.
for (const node of scene.listChildren().filter((n) => n.getMesh())) {
  const owner = Object.keys(MOVING).find((key) => members[key].includes(node));
  for (const prim of node.getMesh().listPrimitives()) {
    const mat = prim.getMaterial()?.getName() ?? "";
    const as = /^(gls_)?black_chrome/.test(mat) ? "logo_chrome" : mat.startsWith("gls_glass_1") ? "star_cover" : STEERING_WHEEL && /^gls_interior(\.|$)/.test(mat) ? "steering_leather" : null;
    if (!as) continue;
    const boxes = as === "steering_leather" ? [STEERING_WHEEL] : BADGES;
    const tris = pieces(prim).filter((piece) => boxes.some((b) => inside(piece, b, 0))).flatMap((piece) => piece.tris);
    if (!tris.length) continue;
    const cut = carve(prim, tris, prim.getMaterial().clone().setName(as), as);
    if (owner) members[owner].push(cut);
    console.log(`${as}: ${tris.length} triangles${owner ? ` on ${owner}` : ""}`);
  }
}

for (const [key, m] of Object.entries(MOVING)) {
  const h = m.hinge(skins[key]);
  const pivot = doc.createNode(key).setTranslation(h);
  for (const n of members[key]) {
    transformMesh(n.getMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -h[0], -h[1], -h[2], 1]);
    scene.removeChild(n);
    pivot.addChild(n);
  }
  scene.addChild(pivot);
  console.log(`${key}: hinge at ${h.map((v) => v.toFixed(3)).join(", ")}, ${members[key].length} parts`);
}

// Build the four wheel pivots.
const groups = {};
for (const [node, key] of wheelOf) (groups[key] ??= []).push(node);
for (const [key, nodes] of Object.entries(groups)) {
  const tyreNodes = nodes.filter((n) => n.getMesh().listPrimitives().some((p) => /Scene_-_Root/.test(p.getMaterial()?.getName() ?? "")));
  const wb = boundsOf(tyreNodes.length ? tyreNodes : nodes);
  const c = centre(wb);
  const pivot = doc.createNode(`Wheel_${key}`).setTranslation(c);
  for (const n of nodes) {
    transformMesh(n.getMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -c[0], -c[1], -c[2], 1]);
    scene.removeChild(n);
    pivot.addChild(n);
  }
  scene.addChild(pivot);
  console.log(`Wheel_${key}: axle at ${c.map((v) => v.toFixed(3)).join(", ")}, radius ${((wb.max[1] - wb.min[1]) / 2).toFixed(3)} m`);
}

for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) {
  for (const semantic of prim.listSemantics()) {
    if (semantic.startsWith("COLOR_") || semantic.startsWith("TEXCOORD_")) prim.setAttribute(semantic, null);
  }
}
for (const mat of root.listMaterials()) mat.setName(mat.getName().replace(/\.\d+$/, ""));

await doc.transform(prune(), weld(), join({ keepNamed: false }), prune());

const fb = getBounds(scene);
const triangles = () => root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, p) => t + p.getIndices().getCount() / 3, 0);
console.log(`Car: ${fb.max.map((v, i) => (v - fb.min[i]).toFixed(3)).join(" x ")} m, ${triangles()} triangles, ${root.listMeshes().length} meshes`);
await io.write(cleanOut, doc);

await MeshoptSimplifier.ready;
for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) {
  if (SIMPLIFY.has(prim.getMaterial()?.getName())) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR, lockBorder: true });
  }
}
await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
console.log(`Compressed: ${triangles()} triangles`);
await io.write(out, doc);
