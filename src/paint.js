import * as THREE from 'three';

// A rest-pose paint boundary travels with each hinged panel. Only authored
// body-paint meshes receive it; leather, wood, chrome and glass stay original.
export function prepareTwoTone(mesh) {
  mesh.geometry=mesh.geometry.clone();
  const vertices=mesh.geometry.attributes.position,zone=new Float32Array(vertices.count);
  const point=new THREE.Vector3();
  for(let i=0;i<vertices.count;i++) {
    point.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);
    const beltline=1.09-.09*THREE.MathUtils.smoothstep(point.z,.8,2.5);
    zone[i]=point.y-beltline;
  }
  mesh.geometry.setAttribute('paintZone',new THREE.BufferAttribute(zone,1));
}

export function applyTwoTone(material,upperColor) {
  const gold=new THREE.Color(upperColor),pinstripe=new THREE.Color('#d5bc91');
  material.metalness=.68;material.roughness=.24;material.clearcoatRoughness=.055;
  material.onBeforeCompile=shader=>{
    shader.uniforms.upperPaint={value:gold};shader.uniforms.paintPinstripe={value:pinstripe};
    shader.vertexShader='attribute float paintZone; varying float vPaintZone;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaintZone=paintZone;');
    shader.fragmentShader='uniform vec3 upperPaint; uniform vec3 paintPinstripe; varying float vPaintZone;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float edge=max(fwidth(vPaintZone),.0005);
      diffuseColor.rgb=mix(diffuseColor.rgb,upperPaint,smoothstep(-edge,edge,vPaintZone));
      float stripe=1.0-smoothstep(.0015,.0015+edge,abs(vPaintZone+.010));
      diffuseColor.rgb=mix(diffuseColor.rgb,paintPinstripe,stripe*.8);
    `);
  };
  material.customProgramCacheKey=()=>`two-tone-${upperColor}`;
}
