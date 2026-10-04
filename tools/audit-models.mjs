import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { writeFile } from 'node:fs/promises';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const inputs = {
  gls: { source: 'source/mersedes-_benz_gls.glb', prepared: 'build/gls-clean.glb' },
  x7: { source: '2019_bmw_x7_xdrive40i.glb', prepared: 'build/x7-clean.glb' },
};
const report = {};
const triangles = node => { let count = 0; node.traverse(n => n.getMesh()?.listPrimitives().forEach(p => { count += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3; })); return count; };
for (const [id, paths] of Object.entries(inputs)) {
  const source = (await io.read(paths.source)).getRoot();
  const root = (await io.read(paths.prepared)).getRoot();
  const nodes = root.listNodes();
  report[id] = {
    files: paths,
    bounds: getBounds(root.listScenes()[0]),
    nodes: nodes.length,
    meshes: root.listMeshes().length,
    triangles: root.listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??0)/3,0),0),
    moving: nodes.filter(n=>/^(Wheel_|Door_|Bonnet|Tailgate)/.test(n.getName())).map(n=>({name:n.getName(),pivot:n.getTranslation(),bounds:getBounds(n),triangles:triangles(n)})),
    sourceParts: source.listNodes().filter(n=>n.listChildren().length && /hood|bonnet|dvig|engine|steer|torped|dash|light|screen|wheel|seat|door/i.test(n.getName())).map(n=>({name:n.getName(),triangles:triangles(n)})),
    materials: root.listMaterials().map(m=>m.getName()),
  };
  console.log(id, JSON.stringify({bounds:report[id].bounds,nodes:report[id].nodes,triangles:report[id].triangles,moving:report[id].moving,sourceParts:report[id].sourceParts}));
}
await writeFile('docs/model-audit.json',JSON.stringify(report,null,2));
