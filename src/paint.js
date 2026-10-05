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

// Automotive paint as it is built up on a real car: a pigmented base coat
// with metallic flakes suspended in it, under a clear lacquer.
// - Flakes: each cell of the base coat (a quarter millimetre) holds one flake,
//   tilted a little off the surface, so close up the highlights break into
//   fine glints. Where a cell is smaller than a pixel the glints would only
//   flicker; there they fade into the base coat's roughness, which is what
//   the eye sees of them from further away.
// - Flop: a metallic base is brightest face-on and darkens towards the
//   flanks, where the flakes, lying flat, no longer face the eye. Solid
//   colours flop far less.
// - Orange peel: sprayed lacquer never dries perfectly flat. A faint, smooth
//   ripple a few millimetres across makes reflections in it read as paint
//   rather than as a mirror, again only where it can be resolved.
// Object-space positions keep the flakes fixed to the panel as it moves.
const PAINT_GLSL = `
varying vec3 vPaintPosition;
uniform mat3 normalMatrix;
vec3 paintHash(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec3 paintNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(paintHash(i), paintHash(i + vec3(1, 0, 0)), f.x), mix(paintHash(i + vec3(0, 1, 0)), paintHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(paintHash(i + vec3(0, 0, 1)), paintHash(i + vec3(1, 0, 1)), f.x), mix(paintHash(i + vec3(0, 1, 1)), paintHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z) * 2. - 1.;
}
`;
export function carPaint(material, { metallic }) {
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey.bind(material);
  const flop = metallic ? .58 : .9;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = 'varying vec3 vPaintPosition;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPosition = position;');
    shader.fragmentShader = PAINT_GLSL + shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        ${metallic ? `
        vec3 cell = vPaintPosition * 4000.0;
        float resolve = 1.0 - smoothstep(.45, 1.1, length(fwidth(cell)));
        // Skipped wherever the flakes can't be resolved: most of the frame.
        if (resolve > 0.0) {
          vec3 flake = paintHash(floor(cell)) * 2.0 - 1.0;
          normal = normalize(normal + normalize(normalMatrix * flake) * .22 * resolve);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * .55, resolve);
        }` : ''}
        float paintFacing = saturate(dot(normal, normalize(vViewPosition)));
        diffuseColor.rgb *= mix(${flop.toFixed(2)}, 1.0, pow(paintFacing, .65));
      }`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
      #ifdef USE_CLEARCOAT
      {
        vec3 peel = vPaintPosition * 240.0;
        float peelResolve = 1.0 - smoothstep(.3, .9, length(fwidth(peel)));
        if (peelResolve > 0.0) clearcoatNormal = normalize(clearcoatNormal + normalMatrix * paintNoise(peel) * .009 * peelResolve);
      }
      #endif`);
  };
  material.customProgramCacheKey = () => `${previousKey()}|car-paint-v2-${metallic ? 'metallic' : 'solid'}`;
  return material;
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
