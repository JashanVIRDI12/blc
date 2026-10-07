// A compact look inside a car model before preparing it: overall size,
// materials (colour, textures, glass) and the mesh nodes by material.
//   node tools/inspect-car.mjs model.glb [--nodes]
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [file, flag] = process.argv.slice(2);
const doc = await io.read(file);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const b = getBounds(scene);
const fmt = v => v.map(x => x.toFixed(3)).join(', ');
const tris = p => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log(`bounds min [${fmt(b.min)}] max [${fmt(b.max)}] size [${fmt(b.max.map((v, i) => v - b.min[i]))}]`);
console.log(`nodes ${root.listNodes().length}, meshes ${root.listMeshes().length}, materials ${root.listMaterials().length}, textures ${root.listTextures().length}`);
for (const t of root.listTextures()) console.log(`  texture ${t.getName() || t.getURI()} ${t.getSize()?.join('x')} ${t.getMimeType()} ${(t.getImage()?.byteLength / 1024 | 0)} KB`);
const usage = new Map();
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? '(none)';
    const entry = usage.get(name) ?? { tris: 0, nodes: [] };
    entry.tris += tris(prim);
    entry.nodes.push(node);
    usage.set(name, entry);
  }
}
for (const mat of root.listMaterials()) {
  const u = usage.get(mat.getName()) ?? { tris: 0, nodes: [] };
  const c = mat.getBaseColorFactor().slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const ext = mat.listExtensions().map(e => e.extensionName.replace('KHR_materials_', '')).join('+');
  console.log(`  mat "${mat.getName()}" #${c} a${mat.getBaseColorFactor()[3].toFixed(2)} m${mat.getMetallicFactor().toFixed(2)} r${mat.getRoughnessFactor().toFixed(2)} ${mat.getAlphaMode()}${mat.getBaseColorTexture() ? ' tex' : ''}${mat.getNormalTexture() ? ' nrm' : ''}${ext ? ' ' + ext : ''} · ${u.nodes.length} nodes ${u.tris | 0} tris`);
  if (flag === '--nodes') for (const n of u.nodes.slice(0, 12)) { const nb = getBounds(n); console.log(`      ${n.getName()} c[${fmt(nb.min.map((v, i) => (v + nb.max[i]) / 2))}] s[${fmt(nb.max.map((v, i) => v - nb.min[i]))}]`); }
}
