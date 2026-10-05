import * as THREE from 'three';

// A lit lamp, seen by eye or by a camera, spreads into a soft glow around its
// light guides; drawn plainly it is a flat shape with hard edges. Each mesh
// that wears `source` gets a halo: the same geometry pushed out along its
// normals by `spread` metres and added over the scene, brightest where it
// faces the eye and fading to nothing at its rim. The halo follows the
// source's emissive intensity (`full` is the intensity at which it is at
// `strength`), so every way of switching the lamp drives it: the film's
// lighting, the unlock blink, the parked running lights.
export function addLampGlow(root, source, { color, full, spread = .016, strength = .5 }) {
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  glow.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float vGlowFacing;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${spread.toFixed(4)};`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\nvGlowFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mvPosition.xyz)));`);
    shader.fragmentShader = 'varying float vGlowFacing;\n' + shader.fragmentShader
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= pow(vGlowFacing, 1.6);\n#include <opaque_fragment>');
  };
  glow.customProgramCacheKey = () => `lamp-glow-${spread}`;
  const level = () => Math.min(1, source.emissiveIntensity / full) * strength;
  const halos = [];
  root.traverse(node => {
    if (!node.isMesh || node.material !== source) return;
    const halo = new THREE.Mesh(node.geometry, glow);
    halo.renderOrder = 3;
    halo.raycast = () => {};
    halo.onBeforeRender = () => { glow.opacity = level(); };
    halos.push([node, halo]);
  });
  halos.forEach(([node, halo]) => node.add(halo));
  return glow;
}
