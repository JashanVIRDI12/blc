// Prepare the supplied studio as a drive-through inspection gallery.
// Keep its walls, ceiling, slate floor and strip fixtures. Open only the rear
// wall so vehicles can enter without passing through visible geometry.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, meshopt, prune, textureCompress, transformMesh } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { stat, writeFile } from 'node:fs/promises';

await MeshoptEncoder.ready;
const source = 'studio_v1_for_car.glb', output = 'public/models/studio.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(source), root = doc.getRoot(), scene = root.getDefaultScene();
const sourceBounds = getBounds(scene);
await doc.transform(flatten());
for (const n of scene.listChildren()) clearNodeTransform(n);
const wall = root.listNodes().find(n => n.getName() === 'wall_Material_0');
const primitive = wall.getMesh().listPrimitives()[0];
const positions = primitive.getAttribute('POSITION'), indices = primitive.getIndices();
const kept = [], indexArray = indices.getArray();
for (let i = 0; i < indexArray.length; i += 3) {
  const triangle = [...indexArray.slice(i, i + 3)];
  const isRearWall = triangle.every(v => Math.abs(positions.getElement(v, [])[2] + 9.8793787) < .002);
  if (!isRearWall) kept.push(...triangle);
}
if (kept.length !== indexArray.length - 6) throw new Error('Expected exactly two rear-wall triangles');
indices.setArray(new Uint16Array(kept));
// In metres: 40 m wide, 80 m long, ceiling 7.9 m; floor at Y=0.
const scale = [6.25, 2.6, 3.2], centre = [-.4938851, .0129553, 2.6206213];
for (const mesh of root.listMeshes()) transformMesh(mesh, [
  scale[0],0,0,0, 0,scale[1],0,0, 0,0,scale[2],0,
  -centre[0]*scale[0], -centre[1]*scale[1], -centre[2]*scale[2], 1,
]);
for (const mat of root.listMaterials()) {
  if (mat.getName() === 'Material') mat.setName('studio_walls');
  if (mat.getName() === 'TilesSlateSquare001_2K') mat.setName('studio_slate');
  if (mat.getName() === 'lights') mat.setName('studio_strips');
}
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024,1024], quality: 86 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(output, doc);
const audit = { source, output, sourceBytes: (await stat(source)).size, outputBytes: (await stat(output)).size, sourceBounds, preparedBounds: getBounds(scene), clearInterior: { halfWidth: 20, halfLength: 40, ceiling: 7.89 }, changes: ['Rear wall opened for vehicle access', 'Gallery scaled and floor levelled', 'Original three floor textures compressed to 1024px WebP'], triangles: root.listMeshes().flatMap(m => m.listPrimitives()).reduce((sum,p) => sum+p.getIndices().getCount()/3,0) };
await writeFile('docs/studio-audit.json', JSON.stringify(audit,null,2)+'\n');
console.log(audit);
