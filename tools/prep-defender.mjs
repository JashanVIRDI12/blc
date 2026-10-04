// Turn the supplied Sketchfab Land Rover Defender 110 into the page's car model.
//
//   node tools/prep-defender.mjs land_rover_defender_-_edition_grasmere_green.glb build/defender-clean.glb public/models/defender.glb
//
// Writes an uncompressed copy (for the shadow bake) and the compressed model
// the page loads. Run through `npm run model:defender`. Steps:
//   - drop two stray copies of a badge that sit 98 m away, and the source's
//     own number plates (src/plates.js mounts Baba's)
//   - bake every transform into the vertices, recentre the car on the origin,
//     tyres on the ground, scaled to the real 5,018 mm length (spare included)
//   - group each tyre with the parts centred on its axle (rim, centre cap,
//     hub) under Wheel_FL/FR/RL/RR, origin on the axle, so the page can spin
//     them; the calipers sit off the axle and stay put
//   - give the Portuguese source materials English names the page restyles
//     by (models.js), and swap the glass's transmission for transparency
//   - lighten only the tyre treads and wheel internals, never the body
//   - WebP textures at 1024 px at most, merge parts that share a material,
//     meshopt-compress
//
// In the output the car's nose points at +Z and its left side faces +X.

import { NodeIO, PropertyType, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, simplifyPrimitive, textureCompress, transformMesh, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { centre } from "./mesh-pieces.mjs";

const REAL_LENGTH = 5.018; // metres, Defender 110 including the spare wheel
const [src, cleanOut, out] = process.argv.slice(2);
const DROP = new Set(["Object_291", "Object_292", "Object_294", "Object_296"]);
const RENAME = {
  "Pintura": "defender_paint",
  "Pintura_.001": "defender_gloss_black",
  "Pintura_.002": "defender_vents",
  "Pintura_.003": "defender_wheel",
  "Plstico_Externo": "defender_cladding",
  "mascara_negra": "defender_black",
  "mascara_negra_2": "defender_lamp_black",
  "wire_000000000": "defender_wheel_black",
  "Cromados": "defender_chrome",
  "Borracha_.001": "defender_tyre",
  "logo": "defender_badge",
  "Vidro_Dispolarizado": "defender_glass",
  "Vidro_-__Freio": "defender_tail_lens",
  "Vidro_-_Lanterna": "defender_lamp_lens",
};
// Dense detail that reads the same with fewer triangles at page sizes.
const SIMPLIFY = { defender_tyre: 0.0006, defender_wheel_black: 0.0006 };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

for (const node of root.listNodes()) if (DROP.has(node.getName())) node.dispose();
await doc.transform(prune());
for (const mat of root.listMaterials()) {
  const name = RENAME[mat.getName()];
  if (!name) throw new Error(`Unmapped material ${mat.getName()}`);
  mat.setName(name);
  // Glass: plain transparency instead of transmission.
  if (mat.getExtension("KHR_materials_transmission")) {
    mat.setExtension("KHR_materials_transmission", null);
    mat.setAlphaMode("BLEND");
  }
}

await doc.transform(flatten());
for (const node of scene.listChildren()) clearNodeTransform(node);

// Recentre and scale to real size.
{
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
}

// Wheels, from the tyres out: every part centred on a tyre's axle and no
// bigger than it, from the tyre's outer face to the hub inside it.
const meshNodes = scene.listChildren().filter((n) => n.getMesh());
const materialOf = (n) => n.getMesh().listPrimitives()[0]?.getMaterial()?.getName();
const tyres = meshNodes.filter((n) => materialOf(n) === "defender_tyre");
if (tyres.length !== 4) throw new Error(`Expected 4 tyres, found ${tyres.length}`);
const wheels = {};
for (const tyre of tyres) {
  const box = getBounds(tyre), axle = centre(box);
  const radius = (box.max[1] - box.min[1]) / 2, width = box.max[0] - box.min[0], side = Math.sign(axle[0]);
  const key = `${axle[2] > 0 ? "F" : "R"}${side > 0 ? "L" : "R"}`;
  const members = meshNodes.filter((n) => {
    const b = getBounds(n), c = centre(b);
    if (Math.abs(c[1] - axle[1]) > radius * 0.12 || Math.abs(c[2] - axle[2]) > radius * 0.12) return false;
    if (b.max[1] - b.min[1] > radius * 2.04 || b.max[2] - b.min[2] > radius * 2.04) return false;
    const outer = side > 0 ? b.max[0] : -b.min[0], inner = side > 0 ? b.min[0] : -b.max[0];
    return outer <= side * (side > 0 ? box.max[0] : box.min[0]) + 0.01 && inner >= Math.abs(axle[0]) - width * 1.6;
  });
  wheels[key] = { axle, radius, members };
}
if (Object.keys(wheels).length !== 4) throw new Error(`Expected four wheel corners, found ${Object.keys(wheels).join(",")}`);
const claimed = new Set();
for (const [key, { axle, radius, members }] of Object.entries(wheels)) {
  const pivot = doc.createNode(`Wheel_${key}`).setTranslation(axle);
  for (const n of members) {
    if (claimed.has(n)) throw new Error(`${n.getName()} claimed by two wheels`);
    claimed.add(n);
    transformMesh(n.getMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -axle[0], -axle[1], -axle[2], 1]);
    scene.removeChild(n);
    pivot.addChild(n);
  }
  scene.addChild(pivot);
  console.log(`Wheel_${key}: axle at ${axle.map((v) => v.toFixed(3)).join(", ")}, radius ${radius.toFixed(3)} m, ${members.length} parts (${[...new Set(members.map(materialOf))].join(", ")})`);
}

// Drop vertex colours and UVs nothing samples.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const textured = prim.getMaterial()?.getBaseColorTexture();
    for (const semantic of prim.listSemantics()) {
      if (semantic.startsWith("COLOR_") || (!textured && semantic.startsWith("TEXCOORD_"))) prim.setAttribute(semantic, null);
    }
  }
}

await doc.transform(prune(), weld(), join({ keepNamed: false }), prune());

const fb = getBounds(scene);
const triangles = () => root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, p) => t + p.getIndices().getCount() / 3, 0);
console.log(`Car: ${fb.max.map((v, i) => (v - fb.min[i]).toFixed(3)).join(" x ")} m, ${triangles()} triangles, ${root.listMeshes().length} meshes`);
await io.write(cleanOut, doc);

for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) {
  const error = SIMPLIFY[prim.getMaterial()?.getName()];
  if (error) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error, lockBorder: true });
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 86 }),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
console.log(`Compressed: ${triangles()} triangles`);
await io.write(out, doc);
