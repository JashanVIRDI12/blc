// Turn the supplied Sketchfab BMW X7 into the page's car model.
//
//   node tools/prep-x7.mjs 2019_bmw_x7_xdrive40i.glb build/x7-clean.glb public/models/x7.glb
//
// Writes an uncompressed copy (for the shadow bake) and the compressed model
// the page loads. Run through `npm run model:x7`. Steps:
//   - bake every transform into the vertices, recentre the car on the origin,
//     tyres on the ground, scaled to the real 5,151 mm length
//   - the source merges all four wheels into one mesh per material, so each
//     wheel is cut out piece by piece and grouped under Wheel_FL/FR/RL/RR,
//     origin on the axle, so the page can spin them (the calipers stay put)
//   - likewise both doors of a pair share one mesh, and every window is one
//     glass mesh. Each door (Door_FL/FR/RL/RR) and the upper tailgate
//     (Tailgate) collects the pieces that sit inside its panel's outline
//     under a pivot node on its hinge line
//   - swap the glass's transmission (an extra render pass per frame, too much
//     for a phone) for plain transparency; the page restyles it by name
//   - keep the original baked interior: black quilted leather, open-pore
//     wood and the glass selector, as the source modelled them
//   - WebP textures at 1024 px at most, strip unused vertex colours, merge
//     parts that share a material, meshopt-compress
//
// In the output the car's nose points at +Z and its left side faces +X, the
// same as the GLS.

import { NodeIO, PropertyType, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, textureCompress, transformMesh, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { boundsOf, carve as carveFrom, centre, inside, pieces } from "./mesh-pieces.mjs";

const REAL_LENGTH = 5.151; // metres, X7 G07
const [src, cleanOut, out] = process.argv.slice(2);

// Everything on a wheel that turns with it. Calipers (Koleso_support) don't.
const WHEEL_MATERIALS = new Set(["baked_Tire", "MEtal_R", "Chome_R", "Koleso_tormoz_disk_mat", "badges", "Emblema_texture"]);
const TYRE_MATERIAL = "baked_Tire";

// Door skins: the one paint mesh per pair of doors.
const DOOR_SKINS = { front: "Box170_carpaint_0", rear: "Box171_carpaint_0" };
// Paint meshes allowed to join a door besides its skin: handles, mirror caps.
const DOOR_PAINT = new Set(["Box089_carpaint_0", "Object021_carpaint_0"]);
// Materials that can belong to a door or the tailgate: glass, trim, seals,
// the door cards, mirror glass and indicators.
const OPENING_MATERIALS = new Set([
  "Windows_glass",
  "Kuzov_black",
  "Kuzov_1",
  "Chrome_S",
  "Chome_R",
  "baked_dveri",
  "Mirror",
  "Mirror_lights_mat",
  "Front_lights_glass",
  "chassis",
  "Back_lights_emissive",
  "baked_Back_lights",
  "badges",
  "Emblema_texture",
]);
// Upper tailgate: its paint panels, and the box everything on it sits in.
const TAILGATE_PAINT = new Set(["Box175_carpaint_0", "Box179_carpaint_0"]);
const TAILGATE_BOX = { min: [-0.8, 1.0, -2.62], max: [0.8, 1.84, -1.86] };

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const carve = (prim, tris, material, name) => carveFrom(doc, scene, prim, tris, material, name);

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

const meshNodes = scene.listChildren().filter((n) => n.getMesh());
const prims = meshNodes.flatMap((n) => n.getMesh().listPrimitives().map((p) => ({ node: n, prim: p, mesh: n.getMesh().getName(), mat: p.getMaterial()?.getName() })));
const primNamed = (mesh) => {
  const found = prims.find((p) => p.mesh === mesh);
  if (!found) throw new Error(`Expected mesh ${mesh} not found`);
  return found;
};

// Glass: plain transparency instead of transmission.
for (const mat of root.listMaterials()) {
  if (mat.getExtension("KHR_materials_transmission")) {
    mat.setExtension("KHR_materials_transmission", null);
    mat.setAlphaMode("BLEND");
  }
}

// Wheels, from the tyres out.
const tyrePieces = prims.filter((p) => p.mat === TYRE_MATERIAL).flatMap((p) => pieces(p.prim));
const corner = (c) => `${c[2] > 0 ? "F" : "R"}${c[0] > 0 ? "L" : "R"}`;
const wheelBox = {};
for (const piece of tyrePieces) {
  const key = corner(centre(piece));
  const box = (wheelBox[key] ??= { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  for (let i = 0; i < 3; i++) {
    box.min[i] = Math.min(box.min[i], piece.min[i]);
    box.max[i] = Math.max(box.max[i], piece.max[i]);
  }
}
if (Object.keys(wheelBox).length !== 4) throw new Error(`Expected 4 tyres, found ${Object.keys(wheelBox).join(",")}`);

// Hinged parts. Each opening gathers pieces whose bounds sit inside its box.
const skinOf = (mesh, left) => {
  const found = pieces(primNamed(mesh).prim).filter((p) => (centre(p)[0] > 0) === left);
  return found.reduce((b, p) => ({ min: b.min.map((v, i) => Math.min(v, p.min[i])), max: b.max.map((v, i) => Math.max(v, p.max[i])) }), {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  });
};
// A door's box runs from its skin inward past the door card, and up to the
// top of its window frame.
// Front door glass runs back past the skin, behind the B-pillar trim.
const doorBox = (skin, left, front) => ({
  min: [left ? 0.5 : skin.min[0] - 0.3, skin.min[1] - 0.02, skin.min[2] - (front ? 0.08 : 0.03)],
  max: [left ? skin.max[0] + 0.3 : -0.5, 1.76, skin.max[2] + 0.03],
});
const OPENINGS = {};
for (const [pos, mesh] of Object.entries(DOOR_SKINS)) {
  for (const left of [true, false]) {
    const skin = skinOf(mesh, left);
    const key = `Door_${pos === "front" ? "F" : "R"}${left ? "L" : "R"}`;
    // Hinge on the leading edge, a little in from the skin.
    const hinge = [left ? skin.max[0] - 0.09 : skin.min[0] + 0.09, (skin.min[1] + skin.max[1]) / 2, skin.max[2] - 0.05];
    OPENINGS[key] = { box: doorBox(skin, left, pos === "front"), paint: new Set([mesh, ...DOOR_PAINT]), hinge };
  }
}
{
  const skin = boundsOf([primNamed("Box175_carpaint_0").node]);
  OPENINGS.Tailgate = { box: TAILGATE_BOX, paint: TAILGATE_PAINT, hinge: [0, skin.max[1] - 0.02, skin.max[2] - 0.03] };
}

// The chrome and black window surrounds run the length of both doors on a
// side as one piece; those are split between the doors triangle by triangle.
const sideBox = (left) => {
  const [f, r] = [OPENINGS[`Door_F${left ? "L" : "R"}`].box, OPENINGS[`Door_R${left ? "L" : "R"}`].box];
  return { min: f.min.map((v, i) => Math.min(v, r.min[i])), max: f.max.map((v, i) => Math.max(v, r.max[i])) };
};
const SIDES = [sideBox(true), sideBox(false)];
const TRIM = new Set(["Chrome_S", "Kuzov_black", "Kuzov_1"]);
const members = Object.fromEntries([...Object.keys(OPENINGS), ...Object.keys(wheelBox)].map((k) => [k, []]));
const report = {};
for (const p of prims) {
  const isPaint = p.mat === "carpaint";
  const forWheel = WHEEL_MATERIALS.has(p.mat);
  const forOpening = isPaint || OPENING_MATERIALS.has(p.mat);
  if (!forWheel && !forOpening) continue;
  // Carve one part's pieces at a time; carving renumbers the triangles, so
  // the primitive is re-read before the next part claims its share.
  const total = p.prim.getIndices().getCount() / 3;
  for (;;) {
    const claims = {};
    for (const piece of pieces(p.prim)) {
      let owner = null;
      if (forWheel) owner = Object.keys(wheelBox).find((k) => inside(piece, wheelBox[k], 0.01));
      if (!owner && forOpening) {
        owner = Object.keys(OPENINGS).find((k) => {
          const o = OPENINGS[k];
          if (isPaint && !o.paint.has(p.mesh)) return false;
          return inside(piece, o.box, 0);
        });
      }
      if (owner) (claims[owner] ??= []).push(...piece.tris);
      else if (TRIM.has(p.mat) && SIDES.some((b) => inside(piece, b, 0))) {
        for (const t of piece.tris) {
          const c = triangleCentre(p.prim, t);
          const door = Object.keys(OPENINGS).find((k) => k.startsWith("Door") && inside({ min: c, max: c }, OPENINGS[k].box, 0));
          if (door) (claims[door] ??= []).push(t);
        }
      }
    }
    const [owner, tris] = Object.entries(claims)[0] ?? [];
    if (!owner) break;
    const node = carve(p.prim, tris, p.prim.getMaterial(), `${owner}_${p.mesh}`);
    members[owner].push(node);
    (report[owner] ??= []).push(`${p.mesh}${tris.length === total ? "" : ` (${tris.length} of ${total} tris)`}`);
  }
}
for (const [owner, list] of Object.entries(report)) console.log(`${owner}: ${list.join(", ")}`);

function triangleCentre(prim, t) {
  const pos = prim.getAttribute("POSITION").getArray();
  const idx = prim.getIndices().getArray();
  return [0, 1, 2].map((i) => (pos[idx[t] * 3 + i] + pos[idx[t + 1] * 3 + i] + pos[idx[t + 2] * 3 + i]) / 3);
}

// Pivots: openings on their hinges, wheels on their axles.
const pivots = {
  ...Object.fromEntries(Object.entries(OPENINGS).map(([k, o]) => [k, o.hinge])),
  ...Object.fromEntries(Object.entries(wheelBox).map(([k, b]) => [`Wheel_${k}`, centre(b)])),
};
for (const [key, list] of Object.entries(members)) {
  const name = OPENINGS[key] ? key : `Wheel_${key}`;
  const h = pivots[name];
  const pivot = doc.createNode(name).setTranslation(h);
  for (const n of list) {
    transformMesh(n.getMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -h[0], -h[1], -h[2], 1]);
    scene.removeChild(n);
    pivot.addChild(n);
  }
  scene.addChild(pivot);
  console.log(`${name}: pivot at ${h.map((v) => v.toFixed(3)).join(", ")}, ${list.length} parts`);
}

// Drop emptied primitives, vertex colours and UVs nothing samples.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getIndices().getCount() === 0) {
      mesh.removePrimitive(prim);
      continue;
    }
    const textured = prim.getMaterial()?.getBaseColorTexture();
    for (const semantic of prim.listSemantics()) {
      if (semantic.startsWith("COLOR_") || (!textured && semantic.startsWith("TEXCOORD_"))) prim.setAttribute(semantic, null);
    }
  }
}
for (const mat of root.listMaterials()) mat.setName(mat.getName().replace(/\.\d+$/, ""));

await doc.transform(prune(), weld(), join({ keepNamed: false }), prune());

const fb = getBounds(scene);
const triangles = () => root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, p) => t + p.getIndices().getCount() / 3, 0);
console.log(`Car: ${fb.max.map((v, i) => (v - fb.min[i]).toFixed(3)).join(" x ")} m, ${triangles()} triangles, ${root.listMeshes().length} meshes`);
await io.write(cleanOut, doc);

await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 90 }),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
await io.write(out, doc);
