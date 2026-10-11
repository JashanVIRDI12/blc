// Prepare the supplied Volvo S90 Recharge for the About page's inspection
// (src/inspection.js, src/detail-car.js). The model is kept whole: every
// triangle, and every texture at its full size. What changes is how it is
// delivered, so that a 386 MB file with 45 textures, most of them 4K, can
// open in a browser and open quickly:
//
//   - the geometry is packed (meshopt, positions to 14 bits a mesh, well
//     under a tenth of a millimetre; normals to 12; nothing simplified) and
//     split in two, so the body arrives and is shown before the cabin
//   - the textures leave the file and are written three times each, at 1K,
//     2K and their own 4K: the page shows the car with the 1K set at once,
//     and brings the larger ones in for whatever the camera is close to
//     (45 textures at 4K would need over 3 GB of video memory at once)
//   - colour maps as WebP; normal and roughness maps as JPEG without chroma
//     subsampling, which WebP's would blur
//
//   npm run model:s90   (node tools/prep-s90.mjs [source.glb])
//
// Writes public/models/s90/{exterior,interior}.glb, the textures beside
// them and manifest.json (which texture goes where, and what sizes exist).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2] ?? 'volvo_s90_recharge_free(1).glb', OUT = 'public/models/s90';
// The cabin: loaded second, and looked at closely.
const INTERIOR = new Set(['DoorPanelRear', 'DoorPanelFront', 'Front_Seat', 'Rear_Seats', 'CenterConsole', 'Steeringwheel', 'Dashboard', 'Speedometer', 'infotainmentScreen', 'Shell']);
const TIERS = [['1k', 1024], ['2k', 2048], ['4k', 4096]];

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot(), scene = root.getDefaultScene() ?? root.listScenes()[0];
await mkdir(OUT, { recursive: true });

// Which texture each material wears, and whether it carries colour.
const textures = root.listTextures(), colour = new Set(), manifest = { textures: [], materials: {} };
for (const material of root.listMaterials()) {
  const slots = { map: material.getBaseColorTexture(), normalMap: material.getNormalTexture(), mrMap: material.getMetallicRoughnessTexture(), emissiveMap: material.getEmissiveTexture(), aoMap: material.getOcclusionTexture() };
  const entry = {};
  for (const [slot, texture] of Object.entries(slots)) {
    if (!texture) continue;
    entry[slot] = textures.indexOf(texture);
    if (slot === 'map' || slot === 'emissiveMap') colour.add(texture);
  }
  if (Object.keys(entry).length) manifest.materials[material.getName()] = { ...entry, interior: INTERIOR.has(material.getName()) };
}
if (process.env.ONLY !== 'geometry') {
  let bytes = { '1k': 0, '2k': 0, '4k': 0 };
  for (const [i, texture] of textures.entries()) {
    const image = Buffer.from(texture.getImage()), { width, height } = await sharp(image).metadata(), longest = Math.max(width, height);
    const isColour = colour.has(texture), ext = isColour ? 'webp' : 'jpg', sizes = [];
    for (const [tier, size] of TIERS) {
      // A texture smaller than a tier has no file there: the tier below serves.
      if (size > longest && tier !== '1k') continue;
      let out = sharp(image).resize({ width: Math.min(size, width), height: Math.min(size, height), fit: 'inside', kernel: 'lanczos3' });
      out = isColour ? out.webp({ quality: tier === '1k' ? 84 : 90, effort: 5 }) : out.jpeg({ quality: tier === '1k' ? 88 : 92, chromaSubsampling: '4:4:4', mozjpeg: true });
      const data = await out.toBuffer();
      await writeFile(`${OUT}/${i}-${tier}.${ext}`, data);
      bytes[tier] += data.length; sizes.push(tier);
    }
    manifest.textures.push({ ext, colour: isColour, sizes, size: longest });
    process.stdout.write(`\r  textures ${i + 1}/${textures.length}`);
  }
  console.log(`\n  1K set ${(bytes['1k'] / 1e6).toFixed(1)} MB, 2K ${(bytes['2k'] / 1e6).toFixed(1)} MB, 4K ${(bytes['4k'] / 1e6).toFixed(1)} MB`);
} else manifest.textures = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8')).textures; // ONLY=geometry keeps the textures already written
// Where things are, for framing the shots (model space).
const centre = name => { const boxes = []; scene.traverse(node => { const mesh = node.getMesh(); if (mesh?.listPrimitives().some(p => p.getMaterial()?.getName() === name)) boxes.push(getBounds(node)); }); if (!boxes.length) return null; const min = [0, 1, 2].map(i => Math.min(...boxes.map(b => b.min[i]))), max = [0, 1, 2].map(i => Math.max(...boxes.map(b => b.max[i]))); return `${min.map(v => v.toFixed(2))} -> ${max.map(v => v.toFixed(2))}`; };
for (const name of ['Headlight_Insides', 'Taillight', 'Steeringwheel', 'Dashboard', 'infotainmentScreen', 'Speedometer', 'Front_Seat', 'Rear_Seats', 'CenterConsole', 'Rims.001', 'Glass', 'tailpipes']) console.log(`  ${name.padEnd(20)} ${centre(name)}`);
const whole = getBounds(scene);
manifest.bounds = { min: whole.min, max: whole.max };

// The textures leave the file; the materials keep everything else.
for (const material of root.listMaterials()) material.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
for (const texture of textures) texture.dispose();
const triangles = d => d.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((t, p) => t + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
manifest.triangles = {};
for (const part of ['exterior', 'interior']) {
  const half = cloneDocument(doc);
  for (const mesh of half.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    if (INTERIOR.has(primitive.getMaterial()?.getName()) !== (part === 'interior')) primitive.dispose();
  }
  for (const mesh of half.getRoot().listMeshes()) if (!mesh.listPrimitives().length) mesh.dispose();
  // The texture coordinates stay, though the textures have left the file:
  // the page puts them back on.
  await half.transform(prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeNormal: 12, quantizeTexcoord: 14 }));
  manifest.triangles[part] = Math.round(triangles(half));
  await io.write(`${OUT}/${part}.glb`, half);
  console.log(`  ${part}: ${manifest.triangles[part].toLocaleString()} triangles`);
}
await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest));
console.log(`  bounds ${whole.min.map(v => v.toFixed(3))} -> ${whole.max.map(v => v.toFixed(3))}`);
