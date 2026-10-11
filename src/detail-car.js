// A car kept whole, and still quick to open: the About page's inspection
// looks at the Volvo S90 Recharge from a hand's breadth, so nothing of it is
// simplified (3.3 million triangles; 45 textures, most of them 4K). What is
// managed is its arrival (tools/prep-s90.mjs lays the files out for this):
//
//   - the body first, with a 1K copy of each of its textures: some ten
//     megabytes, and the car can be shown
//   - then the cabin, the same way, behind it
//   - then detail where the camera is: `focus()` names the materials about to
//     be seen closely, and their 2K or 4K textures replace the 1K ones, one
//     upload a frame; those the camera has left go back to 1K. All 45 at 4K
//     together would take over 3 GB of video memory; a few at a time is all
//     a close-up can show anyway.
//
// Phones stay at 1K; a desktop goes to 2K where it looks, and one with the
// memory for it to 4K.
import * as THREE from 'three';
import { gltfLoader } from './car.js';
import { carPaint } from './paint.js';
import { glassFinish } from './glass.js';
import { fetchModel, prefetchModels } from './model-cache.js';

const SLOTS = { map: ['map'], normalMap: ['normalMap'], mrMap: ['roughnessMap', 'metalnessMap'], emissiveMap: ['emissiveMap'], aoMap: ['aoMap'] };
const ORDER = ['1k', '2k', '4k'];
// The car's glass, by material: how much of what is behind each its tint
// takes away. (The file asks for transmission, which draws the whole car a
// second time for every frame; on a car this heavy, plain glass.)
const GLASS = { Glass: .52, Glass_headlights: .05, Glass_Taillight: .2, Glass_wavey: .12, crystal: .3 };

// Start the body's download ahead of need; nothing waits on it here.
export const preloadDetailCar = base => prefetchModels([`${base}exterior.glb`]);

export async function loadDetailCar(base, { renderer, paint, phone = false, invalidate = () => {}, onProgress } = {}) {
  const manifest = await (await fetch(`${base}manifest.json`)).json();
  const strong = !phone && (navigator.hardwareConcurrency || 4) >= 8 && (navigator.deviceMemory ?? 8) >= 8;
  // What "closely" and "nearby" mean on this device.
  const tiers = phone ? { high: '1k', mid: '1k' } : strong ? { high: '4k', mid: '2k' } : { high: '2k', mid: '1k' };
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bitmaps = typeof createImageBitmap === 'function' ? new THREE.ImageBitmapLoader() : null, images = new THREE.TextureLoader();
  const root = new THREE.Group();
  // The file stands a little off the floor and off centre.
  root.position.set(0, -manifest.bounds.min[1], -(manifest.bounds.min[2] + manifest.bounds.max[2]) / 2);
  const materials = new Map(); // name -> every material the loader made of it
  const cache = new Map(); // `${index}-${tier}` -> the texture, loading or loaded
  const worn = new Map(); // name -> the tier it wears
  let disposed = false, request = 0;

  const best = (index, tier) => { const { sizes } = manifest.textures[index]; for (let i = ORDER.indexOf(tier); i >= 0; i--) if (sizes.includes(ORDER[i])) return ORDER[i]; return sizes[0]; };
  function texture(index, tier) {
    const key = `${index}-${best(index, tier)}`;
    if (!cache.has(key)) {
      const info = manifest.textures[index], url = `${base}${key}.${info.ext}`;
      const dress = map => { map.flipY = false; map.colorSpace = info.colour ? THREE.SRGBColorSpace : THREE.NoColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = anisotropy; map.needsUpdate = true; return map; };
      // Decoded off the main thread where the browser can.
      cache.set(key, bitmaps ? bitmaps.loadAsync(url).then(bitmap => dress(new THREE.Texture(bitmap))) : images.loadAsync(url).then(dress));
    }
    return cache.get(key);
  }
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  // Dress one material in a tier: every slot loaded, and uploaded, before
  // any is shown, so a surface never wears two sizes at once.
  async function wear(name, tier, token) {
    const slots = manifest.materials[name], list = materials.get(name);
    if (!slots || !list || worn.get(name) === tier) return;
    const entries = Object.entries(slots).filter(([slot]) => SLOTS[slot]);
    const loaded = await Promise.all(entries.map(([, index]) => texture(index, tier)));
    if (disposed || token !== request && tier !== '1k') return;
    if (tier !== '1k') for (const map of loaded) { renderer.initTexture(map); await nextFrame(); if (disposed || token !== request) return; }
    const before = worn.get(name);
    entries.forEach(([slot], i) => { for (const material of list) for (const property of SLOTS[slot]) { if (!material[property]) material.needsUpdate = true; material[property] = loaded[i]; } });
    worn.set(name, tier);
    // The size it wore goes, unless it is the 1K set, kept to fall back on.
    if (before && before !== '1k') for (const [, index] of entries) {
      const key = `${index}-${best(index, before)}`;
      if (key !== `${index}-${best(index, tier)}` && !key.endsWith('-1k')) { cache.get(key)?.then(map => map.dispose()); cache.delete(key); }
    }
    invalidate();
  }

  async function part(name, share) {
    const bytes = await fetchModel(`${base}${name}.glb`, { onProgress: value => onProgress?.(share[0] + (share[1] - share[0]) * value) });
    const gltf = await gltfLoader.parseAsync(bytes, base);
    if (disposed) return;
    const found = new Set();
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      for (const material of [node.material].flat()) {
        if (!materials.has(material.name)) materials.set(material.name, []);
        const list = materials.get(material.name);
        if (list.includes(material)) continue;
        list.push(material); found.add(material.name);
        material.transmission = 0;
        // The screens are lit: their own picture, glowing.
        if (manifest.materials[material.name]?.emissiveMap !== undefined) { material.emissive.set('#ffffff'); material.emissiveIntensity = 1; }
        if (material.name === 'Car_Paint' && paint) {
          // The body, in the colour it is shown in: base coat, flake and
          // lacquer as on the site's other cars (paint.js).
          material.color.set(paint.color); material.metalness = .6; material.roughness = .3; material.clearcoat = 1; material.clearcoatRoughness = .015;
          carPaint(material, { metallic: true });
        } else if (GLASS[material.name] !== undefined) {
          material.opacity = GLASS[material.name]; material.roughness = Math.min(material.roughness, .06);
          glassFinish(material); node.renderOrder = 2;
        }
      }
    });
    // Shown in its 1K textures, all of them in before it is.
    await Promise.all([...found].filter(material => manifest.materials[material]).map(material => wear(material, '1k', request)));
    if (disposed) return;
    root.add(gltf.scene);
    invalidate();
  }

  const exterior = part('exterior', [0, 1]);
  // The cabin follows the body; a failure there leaves the body standing.
  const interior = exterior.then(() => part('interior', [1, 1])).catch(error => { console.error('The cabin is unavailable.', error); });

  return {
    root, exterior, interior, tiers,
    // Detail where the camera is: `high` for what it is close to, `mid` for
    // what is in the frame with it, 1K for the rest. Those leaving go first,
    // so the memory is free before it is asked for again.
    async focus({ high = [], mid = [] } = {}) {
      const token = ++request, want = new Map();
      for (const name of mid) want.set(name, tiers.mid);
      for (const name of high) want.set(name, tiers.high);
      const names = [...materials.keys()].filter(name => manifest.materials[name]);
      const order = name => ORDER.indexOf(want.get(name) ?? '1k') - ORDER.indexOf(worn.get(name) ?? '1k');
      for (const name of names.filter(name => order(name) < 0)) { await wear(name, want.get(name) ?? '1k', token); if (token !== request) return; }
      for (const name of names.filter(name => order(name) > 0)) { await wear(name, want.get(name), token); if (token !== request) return; }
    },
    state: () => ({ parts: root.children.length, worn: Object.fromEntries(worn) }),
    dispose() {
      disposed = true;
      cache.forEach(pending => pending.then(map => { map.source.data?.close?.(); map.dispose(); }).catch(() => {}));
      root.traverse(node => { node.geometry?.dispose(); [node.material].flat().forEach(material => material?.dispose()); });
    },
  };
}
