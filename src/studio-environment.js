import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { showroomRoom } from './showroom-room.js';

// The prepared car showroom (tools/prep-showroom.mjs): a 26.3 m square room
// under a grid of luminous ceiling panels, with a drive-in doorway at the rear
// and a drive-out doorway at the front. Its walls are finished in fluted
// smoked oak, the ceiling glows warm and brightest over the inspection stage,
// and the Baba logo is lit on the back wall, beside the drive-in doorway. The
// car's reflections come from this room (captured below).
const LOGO = '/brand/baba-luxury-car.png';

// The logo as a halo-lit sign on the back wall: the gold mark, and a soft
// warm glow thrown on the wall behind it. Lit for the whole film.
function brandSign(logo, inner, place) {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256; glowCanvas.height = 128;
  const c = glowCanvas.getContext('2d'), gradient = c.createRadialGradient(128, 64, 0, 128, 64, 128);
  gradient.addColorStop(0, 'rgba(255,190,110,.5)'); gradient.addColorStop(.45, 'rgba(255,170,90,.14)'); gradient.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = gradient; c.fillRect(0, 0, 256, 128);
  const mark = new THREE.MeshBasicMaterial({ name: 'showroom_logo', map: logo, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.2, 1.08, 1.0) });
  const halo = new THREE.MeshBasicMaterial({ name: 'showroom_logo_glow', map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, dithering: true });
  const width = place.width, height = width / place.aspect;
  const sign = new THREE.Group();
  sign.position.set(place.x, place.y, -(inner - .012));
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.8, height * 3), halo);
  const markPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mark);
  glowPlane.position.z = .002; markPlane.position.z = .006;
  glowPlane.renderOrder = 1; markPlane.renderOrder = 2;
  sign.add(glowPlane, markPlane);
  return sign;
}

export async function loadStudio(renderer, scene, environment, onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, logo] = await Promise.all([
    loader.loadAsync('/models/showroom.glb', event => { if (event.total) onProgress(event.loaded / event.total); }),
    new THREE.TextureLoader().loadAsync(LOGO),
  ]);
  logo.colorSpace = THREE.SRGBColorSpace; logo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const root = gltf.scene;
  // `reveal` sweeps the ceiling on from the entrance towards the front wall.
  const uniforms = { showroomReveal: { value: 1 }, showroomLevel: { value: 1 } };
  const worldPosition = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 showroomPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nshowroomPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 showroomPosition; uniform float showroomReveal; uniform float showroomLevel;\n'
      + 'float showroomOn(float z){return smoothstep(0.0,3.5,mix(-17.0,20.0,showroomReveal)-z);}\n' + shader.fragmentShader;
  };
  // Dithering throughout: the room's soft falloffs are only a few 8-bit
  // steps deep and would otherwise show as rings that crawl with the camera.
  const panels = new THREE.MeshStandardMaterial({ name: 'showroom_panels', color: '#e9e3d8', emissive: '#ffeedb', emissiveIntensity: 2.4, roughness: .9, metalness: 0, side: THREE.DoubleSide, dithering: true });
  panels.onBeforeCompile = shader => {
    worldPosition(shader);
    // A stage of light over the inspection mark; the panels towards the walls
    // glow at about half, so the room has depth and the type has a calmer sky.
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float stage=1.0-smoothstep(3.5,11.5,length(showroomPosition.xz));
      totalEmissiveRadiance*=(.02+.98*showroomOn(showroomPosition.z))*mix(.3,1.0,stage);`);
  };
  panels.customProgramCacheKey = () => 'showroom-panels-v2';
  // The grid between the panels, in dark bronze.
  const grid = new THREE.MeshStandardMaterial({ name: 'showroom_grid', color: '#2a2119', metalness: .8, roughness: .36, side: THREE.DoubleSide, dithering: true });
  const walls = new THREE.MeshStandardMaterial({ name: 'showroom_walls', color: '#2c231c', metalness: 0, roughness: .6, side: THREE.DoubleSide, dithering: true });
  walls.onBeforeCompile = shader => {
    worldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Which wall: side walls run along z, the front and rear along x.
      vec3 worldNormal=(vec4(normal,0.0)*viewMatrix).xyz;
      bool sideWall=abs(worldNormal.x)>.5;
      float along=sideWall?showroomPosition.z:showroomPosition.x;
      // Vertical flutes, 7 cm apart, fading out where a pixel spans a flute.
      float fluteWidth=fwidth(along)/.07;
      float flute=sin(along/.07*6.2831853)*(1.0-smoothstep(.22,.55,fluteWidth));
      vec3 acrossWall=normalize((viewMatrix*vec4(sideWall?vec3(0.0,0.0,1.0):vec3(1.0,0.0,0.0),0.0)).xyz);
      normal=normalize(normal+acrossWall*flute*.42);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // Light from the ceiling grazes the walls: bright under the panels,
      // falling away towards the floor. It follows the switch-on sweep.
      float graze=exp(-(${showroomRoom.ceiling.toFixed(3)}-showroomPosition.y)/.75);
      totalEmissiveRadiance+=vec3(1.0,.93,.84)*(.014+.16*graze)*showroomOn(showroomPosition.z)*showroomLevel;
    `);
  };
  walls.customProgramCacheKey = () => 'showroom-walls-v4';
  const replace = { showroom_panels: panels, showroom_grid: grid, showroom_walls: walls };
  root.traverse(object => {
    if (object.isMesh && replace[object.material.name]) object.material = replace[object.material.name];
  });
  root.add(brandSign(logo, showroomRoom.wall.inner, showroomRoom.logo));

  // Capture the actual room once, without cars: the panel grid and the logo
  // are what the clearcoat, glass and chrome reflect. A subdued HDR adds
  // indirect bounce.
  const capture = new THREE.Scene();
  capture.background = new THREE.Color('#0d0f10');
  capture.environment = environment; capture.environmentIntensity = .35;
  const captureFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#1d1f21', roughness: .5 }));
  captureFloor.rotation.x = -Math.PI / 2;
  capture.add(root, captureFloor);
  // Reflected panels are kept below their on-screen glow so metallic paint
  // keeps its colour instead of turning to a pale sheen. Larger screens get a
  // sharper capture; phones keep the lighter one.
  panels.emissiveIntensity = 1.3;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const size = matchMedia('(max-width: 760px)').matches ? 256 : 512;
  const target = pmrem.fromScene(capture, 0, .1, 60, { size, position: new THREE.Vector3(0, 1.1, 0) });
  pmrem.dispose(); captureFloor.geometry.dispose(); captureFloor.material.dispose();
  panels.emissiveIntensity = 1.6;
  scene.add(root);
  return {
    root, target,
    setLight(level) {
      uniforms.showroomReveal.value = level;
      uniforms.showroomLevel.value = level;
    },
  };
}
