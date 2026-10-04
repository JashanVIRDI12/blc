import * as THREE from 'three';

// Glass as it behaves on a car. Its tint takes away part of what lies behind
// it (`opacity`), but reflections are added at full strength and grow towards
// grazing angles (Fresnel), where glass turns into a mirror. Left to itself,
// three.js multiplies everything a transparent surface returns, reflections
// included, by its opacity, so a clear window or headlamp lens all but
// vanishes. Here the colour is written premultiplied: the lit tint scaled by
// opacity, plus the reflection unscaled, over the background scaled by what
// the glass lets through. Glass absorbs rather than scatters: its colour
// should be dark (a pale tint, lit by the ceiling, reads as haze).
export function glassFinish(material) {
  material.transparent = true;
  material.depthWrite = false;
  // The reflection model below has no room for a second, clearcoat layer.
  material.clearcoat = 0;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <opaque_fragment>', `
        float glassFresnel = pow(1.0 - saturate(dot(normal, geometryViewDir)), 5.0);
        float glassCover = 1.0 - (1.0 - diffuseColor.a) * (1.0 - glassFresnel);
        gl_FragColor = vec4(totalDiffuse * diffuseColor.a + (outgoingLight - totalDiffuse), glassCover);`)
      // Fog over premultiplied colour fades towards the fog colour scaled by
      // the glass's own cover, not towards the full colour.
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        #ifdef USE_FOG
        gl_FragColor.rgb -= fogFactor * fogColor * (1.0 - gl_FragColor.a);
        #endif`);
  };
  material.customProgramCacheKey = () => 'car-glass-v1';
  return material;
}

// A clone of a glass material keeps its blending but not the shader that
// goes with it: make it glass again, or plainly transparent.
export function plainTransparent(material) {
  material.blending = THREE.NormalBlending;
  return material;
}
