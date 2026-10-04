import * as THREE from 'three';
import { showroomRoom } from './showroom-room.js';

// The showroom floor: large-format polished stone, laid in 1.33 m tiles on
// the walls' 2.66 m panel grid, each tile a shade apart and faintly mottled,
// with fine dark joints. The inspection mark is a flush turntable: a darker,
// glossier disc ringed by a warm LED line. A shadow-gap LED skirting runs
// round the walls (stopping at the doorways) and spills onto the floor, and
// a light strip crosses each threshold. The same material lines the
// reflection capture, so the paint reflects the ring and the skirting too.
export const floorLayout = { tile: 1.33, stage: 3.3, ring: 3.42 };

export const floorShader = /* glsl */`
  float floorHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float floorNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(floorHash(i), floorHash(i + vec2(1, 0)), f.x), mix(floorHash(i + vec2(0, 1)), floorHash(i + vec2(1, 1)), f.x), f.y);
  }
  // Distance (m) to the nearest tile joint, and the tile's own index.
  float floorJoint(vec2 xz, out vec2 tile) {
    vec2 q = xz / ${floorLayout.tile.toFixed(3)};
    tile = floor(q);
    vec2 d = abs(fract(q) - .5) * ${floorLayout.tile.toFixed(3)};
    return ${(floorLayout.tile / 2).toFixed(4)} - max(d.x, d.y);
  }
  // 1 inside the room, fading to 0 just past the walls.
  float floorInside(vec2 xz) { return 1.0 - smoothstep(-.05, .3, max(abs(xz.x), abs(xz.y)) - ${showroomRoom.wall.inner.toFixed(3)}); }
  // Light the floor gives off: the turntable's ring, the skirting's spill
  // and the threshold strips (before the room's switch-on level).
  vec3 floorGlow(vec2 xz) {
    vec3 warm = vec3(1.0, .82, .62);
    float r = length(xz);
    float aa = max(fwidth(r), 1e-4);
    float ring = 1.0 - smoothstep(.012, .012 + aa * 1.5, abs(r - ${floorLayout.ring.toFixed(3)}));
    float ringSpill = exp(-abs(r - ${floorLayout.ring.toFixed(3)}) / .16) * .05;
    float wall = ${showroomRoom.wall.inner.toFixed(3)} - max(abs(xz.x), abs(xz.y));
    bool frontBack = abs(xz.y) > abs(xz.x);
    float doorway = frontBack ? 1.0 - smoothstep(${(showroomRoom.doorways[0].x[1] - .05).toFixed(3)}, ${(showroomRoom.doorways[0].x[1] + .05).toFixed(3)}, abs(xz.x)) : 0.0;
    float skirting = exp(-max(wall, 0.0) / .22) * .2 * (1.0 - doorway) * step(0.0, wall);
    float threshold = doorway * (1.0 - smoothstep(.02, .02 + max(fwidth(wall), 1e-4) * 1.5, abs(wall + .06)));
    return warm * (ring * 2.4 + ringSpill + skirting) + vec3(1.0, .9, .78) * threshold * 1.6;
  }
`;

export function createFloorMaterial(uniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    name: 'showroom_floor', color: 0x161617, metalness: 0, roughness: .2,
    specularIntensity: .55, emissive: 0xffffff, dithering: true,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 floorWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfloorWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 floorWorld; uniform float showroomLevel;\n' + floorShader + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 floorTile;
        float floorEdge = floorJoint(floorWorld.xz, floorTile);
        float floorAA = max(fwidth(floorEdge), 1e-4);
        float floorJointLine = 1.0 - smoothstep(.001, .001 + floorAA * 1.5, floorEdge);
        // Each tile a shade apart; slow mottling in the stone.
        float floorShade = .96 + .08 * floorHash(floorTile) + .07 * (floorNoise(floorWorld.xz * 2.3) - .5) + .04 * (floorNoise(floorWorld.xz * 11.0) - .5);
        float floorRadius = length(floorWorld.xz);
        float floorStage = 1.0 - smoothstep(${floorLayout.stage.toFixed(2)} - .004, ${floorLayout.stage.toFixed(2)} + .004, floorRadius);
        float floorSeam = 1.0 - smoothstep(.003, .003 + max(fwidth(floorRadius), 1e-4) * 1.5, abs(floorRadius - ${floorLayout.stage.toFixed(2)}));
        floorShade = mix(floorShade, .62, floorStage);
        diffuseColor.rgb *= floorShade * (1.0 - .45 * max(floorJointLine * (1.0 - floorStage), floorSeam));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor + .06 * (floorHash(floorTile + 7.0) - .5), .12, floorStage);
        roughnessFactor = mix(roughnessFactor, .7, max(floorJointLine * (1.0 - floorStage), floorSeam));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = floorGlow(floorWorld.xz) * showroomLevel * floorInside(floorWorld.xz);`);
  };
  material.customProgramCacheKey = () => 'showroom-floor-v1';
  // The reflection capture lights the floor at full, whatever the film's level.
  material.userData.level = uniforms.showroomLevel;
  return material;
}
