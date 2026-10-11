// List a GLB's bounds, materials (with triangle counts) and mesh nodes, to
// prepare a supplied model: node tools/inspect-glb.mjs model.glb
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const b = getBounds(scene);
console.log('bounds', b.min.map(v => v.toFixed(3)), b.max.map(v => v.toFixed(3)));
console.log('extensions', root.listExtensionsUsed().map(e => e.extensionName).join(', '));
const tris = {};
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) { const n = p.getMaterial()?.getName() ?? '(none)'; tris[n] = (tris[n] ?? 0) + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; }
console.log('materials (name: triangles, color, metal/rough, alpha, texture, transmission)');
for (const m of root.listMaterials()) {
  const c = m.getBaseColorFactor().map(v => v.toFixed(2)).join(',');
  console.log(' ', JSON.stringify(m.getName()), Math.round(tris[m.getName()] ?? 0), `[${c}]`, m.getMetallicFactor().toFixed(2), m.getRoughnessFactor().toFixed(2), m.getAlphaMode(), m.getBaseColorTexture() ? 'tex' : '', m.getExtension('KHR_materials_transmission') ? 'transmission' : '');
}
console.log('total triangles', Math.round(Object.values(tris).reduce((a, b) => a + b, 0)));
let count = 0;
scene.traverse(node => { if (node.getMesh() && count++ < 400) { const nb = getBounds(node); const mats = [...new Set(node.getMesh().listPrimitives().map(p => p.getMaterial()?.getName()))].join('|'); console.log('node', JSON.stringify(node.getName()), mats, nb.min.map(v => v.toFixed(2)).join(','), '->', nb.max.map(v => v.toFixed(2)).join(',')); } });
console.log('mesh nodes', count);
