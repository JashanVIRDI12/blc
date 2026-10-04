import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { showroomRoom } from './showroom-room.js';

// The prepared car showroom (tools/prep-showroom.mjs): a 26.3 m square room
// under a grid of luminous ceiling panels, with a drive-in doorway at the rear
// and a drive-out doorway at the front, each in a bronze portal. Its walls are
// fluted smoked oak, slat by slat a shade apart, with a shadow gap at each
// panel seam; recessed light slots stand in some of the seams and an LED
// skirting runs along the floor. The ceiling glows warm and brightest over
// the inspection stage, each panel a softly lit diffuser, and the Baba logo
// is lit on the back wall, beside the drive-in doorway. The car's
// reflections come from this room (captured below).
const LOGO = '/brand/baba-luxury-car.png';
// Panel seams on the walls (2.66 m pitch); light slots stand in those at
// 5.32 m and 10.64 m from each wall's centre line, but not behind the logo.
const SEAM = 2.66;

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

// Bronze portal frames round the doorways, on the room side of each wall.
function portals(material) {
  const group = new THREE.Group();
  const { inner } = showroomRoom.wall, face = .05, depth = .07;
  for (const door of showroomRoom.doorways) {
    const side = Math.sign(door.z), [x0, x1] = door.x, z = side * (inner - depth / 2 + .012);
    const jamb = new THREE.BoxGeometry(face, door.height + face, depth);
    const lintel = new THREE.BoxGeometry(x1 - x0 + 2 * face, face, depth);
    for (const [geometry, x, y] of [[jamb, x0 - face / 2, (door.height + face) / 2], [jamb, x1 + face / 2, (door.height + face) / 2], [lintel, (x0 + x1) / 2, door.height + face / 2]]) {
      const piece = new THREE.Mesh(geometry, material);
      piece.position.set(x, y, z);
      group.add(piece);
    }
  }
  return group;
}

export async function loadStudio(renderer, scene, environment, floor, onProgress) {
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
      // Each 1.38 m panel is a backlit diffuser: even across its middle,
      // falling off a little towards the grid that frames it.
      vec2 cell=abs(fract(showroomPosition.xz/1.55+.5)-.5)*1.55;
      float diffuser=mix(1.0,.7,smoothstep(.3,.69,max(cell.x,cell.y)));
      totalEmissiveRadiance*=(.02+.98*showroomOn(showroomPosition.z))*mix(.3,1.0,stage)*diffuser;`);
  };
  panels.customProgramCacheKey = () => 'showroom-panels-v3';
  // The grid between the panels, in dark bronze.
  const grid = new THREE.MeshStandardMaterial({ name: 'showroom_grid', color: '#2a2119', metalness: .8, roughness: .36, side: THREE.DoubleSide, dithering: true });
  const walls = new THREE.MeshStandardMaterial({ name: 'showroom_walls', color: '#4a382a', metalness: 0, roughness: .62, side: THREE.DoubleSide, dithering: true });
  const inner = showroomRoom.wall.inner.toFixed(3), back = (showroomRoom.wall.outer - showroomRoom.wall.inner - .02).toFixed(3);
  const door = showroomRoom.doorways[0].x[1].toFixed(3);
  walls.onBeforeCompile = shader => {
    worldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `float wallHash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
      float wallNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float a = wallHash(i.x + i.y * 57.0), b = wallHash(i.x + 1.0 + i.y * 57.0);
        float c = wallHash(i.x + (i.y + 1.0) * 57.0), d = wallHash(i.x + 1.0 + (i.y + 1.0) * 57.0);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      // Which wall: side walls run along z, the front and rear along x.
      vec3 wallNormal=(vec4(normalize(vNormal),0.0)*viewMatrix).xyz;
      bool sideWall=abs(wallNormal.x)>.5;
      float along=sideWall?showroomPosition.z:showroomPosition.x;
      // The room-facing panels, and the recesses behind them: the 7 cm
      // reveal at each panel seam and the shadow gap along the floor (and
      // the doorway jambs, which face across the wall, not into the room).
      float wallDepth=max(abs(showroomPosition.x),abs(showroomPosition.z))-${inner};
      float roomFace=step(wallDepth,.01);
      float facingRoom=(sideWall==(abs(showroomPosition.x)>abs(showroomPosition.z)))?1.0:0.0;
      float recess=step(.02,wallDepth)*step(wallDepth,${back})*facingRoom;
      float wallId=sideWall?sign(showroomPosition.x):2.0+sign(showroomPosition.z);
      // Oak slats 7 cm wide, each a shade apart, with a faint vertical grain.
      float slat=floor(along/.07);
      float grain=wallNoise(vec2(slat*3.7+wallId*31.0,showroomPosition.y*1.6))*.6+wallNoise(vec2(slat*5.1,showroomPosition.y*9.0))*.4;
      diffuseColor.rgb*=(.84+.3*wallHash(slat+wallId*157.0))*(.9+.2*grain);
      // Where this is on the 2.66 m panel grid: which seam, and how far from it.
      float seamOffset=along-floor(along/${SEAM.toFixed(2)}+.5)*${SEAM.toFixed(2)};
      float seamIndex=floor(along/${SEAM.toFixed(2)}+.5);
      float aa=max(fwidth(along),1e-4);
      // Light slots in the reveals 2 and 4 seams out (5.32 m and 10.64 m
      // from the centre line), but not behind the logo on the rear wall.
      float slotSeam=(abs(abs(seamIndex)-2.0)<.5||abs(abs(seamIndex)-4.0)<.5)?1.0:0.0;
      if(!sideWall&&showroomPosition.z<0.0&&seamIndex>1.5&&seamIndex<2.5)slotSeam=0.0;
      slotSeam*=step(.17,showroomPosition.y)*step(showroomPosition.y,${(showroomRoom.ceiling - .02).toFixed(3)});
      float slotCore=recess*slotSeam*(1.0-smoothstep(.034,.034+aa*1.5,abs(seamOffset)));
      float doorway=(!sideWall&&abs(showroomPosition.x)<${door}+.02)?1.0:0.0;
      float skirting=recess*step(showroomPosition.y,.165)*(1.0-doorway);
      // The recesses are in shadow, where nothing lights them.
      diffuseColor.rgb*=1.0-.7*recess;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Vertical flutes, 7 cm apart, fading out where a pixel spans a flute.
      float fluteWidth=fwidth(along)/.07;
      float flute=sin(along/.07*6.2831853)*(1.0-smoothstep(.22,.55,fluteWidth));
      vec3 acrossWall=normalize((viewMatrix*vec4(sideWall?vec3(0.0,0.0,1.0):vec3(1.0,0.0,0.0),0.0)).xyz);
      normal=normalize(normal+acrossWall*flute*.42);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec3 warm=vec3(1.0,.9,.78);
      float on=showroomOn(showroomPosition.z)*showroomLevel;
      // Light from the ceiling grazes the walls: bright under the panels,
      // falling away towards the floor. It follows the switch-on sweep.
      float graze=exp(-(${showroomRoom.ceiling.toFixed(3)}-showroomPosition.y)/.75);
      totalEmissiveRadiance+=warm*(.02+.16*graze)*on*roomFace;
      // Each light slot: a bright line, and light raking across the flutes
      // either side of it, catching the faces turned towards it.
      float spill=exp(-abs(seamOffset)/.32)*slotSeam*roomFace*(.62+.38*clamp(-sign(seamOffset)*flute*2.0,-1.0,1.0));
      totalEmissiveRadiance+=vec3(1.0,.88,.72)*(slotCore*3.2+spill*.14)*on;
      // The LED skirting: a strip under the lip of the shadow gap, lighting
      // the gap and (showroom-floor.js) the floor in front of it.
      float strip=smoothstep(.09,.155,showroomPosition.y);
      totalEmissiveRadiance+=vec3(1.0,.84,.66)*skirting*(.25+2.2*strip*strip)*on;
    `);
  };
  walls.customProgramCacheKey = () => 'showroom-walls-v5';
  const replace = { showroom_panels: panels, showroom_grid: grid, showroom_walls: walls };
  root.traverse(object => {
    if (object.isMesh && replace[object.material.name]) object.material = replace[object.material.name];
  });
  root.add(brandSign(logo, showroomRoom.wall.inner, showroomRoom.logo));
  // The portals in polished bronze, picked out against the dark beyond.
  const bronze = new THREE.MeshStandardMaterial({ name: 'showroom_portal', color: '#9a7652', metalness: 1, roughness: .26, dithering: true });
  root.add(portals(bronze));

  // Capture the actual room once, without cars: the ceiling, the light slots,
  // the skirting, the turntable's ring and the logo are what the clearcoat,
  // glass and chrome reflect. A subdued HDR adds indirect bounce.
  const capture = new THREE.Scene();
  capture.background = new THREE.Color('#0d0f10');
  capture.environment = environment; capture.environmentIntensity = .35;
  const captureFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floor);
  captureFloor.rotation.x = -Math.PI / 2;
  capture.add(root, captureFloor);
  // Reflected panels are kept below their on-screen glow so metallic paint
  // keeps its colour instead of turning to a pale sheen. The grid between
  // them reflects as a soft line rather than a black bar: on a car's curved
  // panels, crisp black lines turn every ripple in the bodywork into a
  // wobble. A slight blur does the same for the capture's sharpest level.
  // Larger screens get a sharper capture; phones keep the lighter one.
  const level = floor.userData.level, playing = level.value;
  panels.emissiveIntensity = 1.5; level.value = 1;
  grid.emissive.set('#e8dccb'); grid.emissiveIntensity = .42;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const size = matchMedia('(max-width: 760px)').matches ? 256 : 512;
  const target = pmrem.fromScene(capture, .012, .1, 60, { size, position: new THREE.Vector3(0, 1.1, 0) });
  pmrem.dispose(); captureFloor.geometry.dispose();
  panels.emissiveIntensity = 1.6; level.value = playing; grid.emissiveIntensity = 0;
  scene.add(root);
  return {
    root, target,
    setLight(level) {
      uniforms.showroomReveal.value = level;
      uniforms.showroomLevel.value = level;
    },
  };
}
