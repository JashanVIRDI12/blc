// The editor's photographs: drop or choose several at once; each is
// compressed (with a small copy for cards), uploaded and shown as it lands.
// The first is the cover; one may be chosen to show under the pointer on the
// collection page (the cabin, usually). Drag to reorder, or use the arrows
// (which also work by touch and keyboard).
import { $, esc, icon, compressImage, fail, toast } from './ui.js';
import { safeImage, thumbImage } from '../util.js';

export function photoManager(container, { photos, hover = '', carId, store, onChange }) {
  const list = [...photos];
  let inside = list.includes(hover) ? hover : '';
  const uploaded = [];
  const pending = new Map();
  container.innerHTML = `<label class="a-drop" data-drop><input type="file" accept="image/*" multiple hidden data-file>${icon.photo}<span><b>Add photos</b> — drag them here or <u>choose from your device</u></span><small>JPG, PNG, WebP or HEIC, as many as you like. Each is sized for the web, with a small copy for the cards.</small></label>
    <div class="a-photo-bar" data-bar hidden><span data-count></span><span class="a-photo-legend"><span class="a-cover">Cover</span> shows on cards · <span class="a-cover a-cover--inside">Hover</span> shows when the pointer is over the card</span><button type="button" class="a-button a-button--small a-button--ghost" data-auto-inside>Pick a cabin photo for me</button></div>
    <ol class="a-photos" data-grid></ol>`;
  const grid = $('[data-grid]', container);
  const drop = $('[data-drop]', container);
  const input = $('[data-file]', container);
  const changed = () => { if (!list.includes(inside)) inside = ''; render(); onChange([...list], inside); };

  function render() {
    $('[data-bar]', container).hidden = !list.length;
    $('[data-count]', container).textContent = `${list.length} ${list.length === 1 ? 'photo' : 'photos'}`;
    grid.innerHTML = list.map((url, i) => `<li class="a-photo${url === inside ? ' is-inside' : ''}" draggable="true" data-index="${i}"><img src="${esc(thumbImage(url))}" data-full="${esc(safeImage(url))}" alt="Photo ${i + 1}" loading="lazy" />${i === 0 ? '<span class="a-cover">Cover</span>' : ''}${url === inside ? '<span class="a-cover a-cover--inside">Hover</span>' : ''}<span class="a-photo-n">${i + 1}</span><div class="a-photo-tools"><button type="button" data-move="-1" aria-label="Move photo ${i + 1} earlier" ${i === 0 ? 'disabled' : ''}>${icon.up}</button><button type="button" data-move="1" aria-label="Move photo ${i + 1} later" ${i === list.length - 1 ? 'disabled' : ''}>${icon.down}</button>${i ? `<button type="button" data-cover aria-label="Make photo ${i + 1} the cover" title="Make it the cover">${icon.star}</button>` : ''}<button type="button" data-inside aria-pressed="${url === inside}" aria-label="${url === inside ? 'Stop showing' : 'Show'} photo ${i + 1} on hover" title="Show on hover">${icon.eye}</button><button type="button" data-remove aria-label="Remove photo ${i + 1}" title="Remove">${icon.x}</button></div></li>`).join('')
      + [...pending.entries()].map(([key, item]) => `<li class="a-photo is-uploading${item.error ? ' is-failed' : ''}" data-pending="${key}"><img src="${item.preview}" alt="" /><span class="a-photo-state">${item.error ? `${esc(item.error)} <button type="button" data-drop-failed>Dismiss</button>` : '<i class="a-spinner"></i>Uploading…'}</span></li>`).join('');
    grid.querySelectorAll('img[data-full]').forEach(img => img.addEventListener('error', () => { if (img.getAttribute('src') !== img.dataset.full) img.src = img.dataset.full; }, { once: true }));
  }

  grid.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-drop-failed]')) { const key = button.closest('[data-pending]').dataset.pending; URL.revokeObjectURL(pending.get(key).preview); pending.delete(key); render(); return; }
    const i = Number(button.closest('[data-index]').dataset.index);
    if (button.matches('[data-move]')) { const j = i + Number(button.dataset.move); [list[i], list[j]] = [list[j], list[i]]; changed(); grid.querySelector(`[data-index="${j}"] [data-move="${button.dataset.move}"]`)?.focus(); }
    if (button.matches('[data-cover]')) { list.unshift(...list.splice(i, 1)); changed(); }
    if (button.matches('[data-inside]')) { inside = inside === list[i] ? '' : list[i]; changed(); }
    if (button.matches('[data-remove]')) { list.splice(i, 1); changed(); }
  });
  // With nothing chosen, the first photo after the outside shots: photos are
  // usually taken outside first, then in the cabin.
  $('[data-auto-inside]', container).addEventListener('click', () => {
    if (list.length < 2) return;
    inside = list[Math.min(list.length - 1, Math.max(1, Math.round(list.length * .72)))];
    changed();
    toast('Chosen. Click the eye on another photo to change it.');
  });

  // Drag to reorder.
  let from = null;
  grid.addEventListener('dragstart', event => { const item = event.target.closest('[data-index]'); if (!item) return; from = Number(item.dataset.index); item.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; });
  grid.addEventListener('dragend', () => { from = null; grid.querySelectorAll('.is-dragging,.is-over').forEach(item => item.classList.remove('is-dragging', 'is-over')); });
  grid.addEventListener('dragover', event => { if (from === null) return; const item = event.target.closest('[data-index]'); if (!item) return; event.preventDefault(); grid.querySelectorAll('.is-over').forEach(other => other.classList.remove('is-over')); item.classList.add('is-over'); });
  grid.addEventListener('drop', event => { if (from === null) return; const item = event.target.closest('[data-index]'); if (!item) return; event.preventDefault(); const to = Number(item.dataset.index); list.splice(to, 0, ...list.splice(from, 1)); from = null; changed(); });

  // Add photos: choose, or drop files from the computer.
  input.addEventListener('change', () => { add([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); add([...event.dataTransfer.files].filter(file => file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name))); });

  async function add(files) {
    // Files keep the order they were chosen in (by name, as a camera numbers them).
    const queue = files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(file => { const key = Math.random().toString(36).slice(2); pending.set(key, { preview: URL.createObjectURL(file), file, slot: null }); return key; });
    render();
    const slots = new Map(queue.map((key, i) => [key, list.length + i]));
    const landed = [];
    const work = async key => {
      const item = pending.get(key);
      try {
        const preview = store.mode === 'preview';
        const [blob, thumb] = await Promise.all([compressImage(item.file, preview ? { max: 1200, quality: .78 } : {}), preview ? null : compressImage(item.file, { max: 720, quality: .74 })]);
        const url = await store.uploadPhoto(blob, carId, thumb);
        uploaded.push(url);
        landed.push([slots.get(key), url]);
        URL.revokeObjectURL(item.preview);
        pending.delete(key);
        // Keep the chosen order however the uploads finish.
        landed.sort((a, b) => a[0] - b[0]);
        const base = list.filter(entry => !landed.some(([, done]) => done === entry));
        list.splice(0, list.length, ...base, ...landed.map(([, done]) => done));
        changed();
      } catch (error) { item.error = error.message?.slice(0, 120) || 'Upload failed'; render(); fail(error); }
    };
    // Three at a time.
    const lanes = Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) await work(queue.shift()); });
    await Promise.all(lanes);
  }

  render();
  return { photos: () => [...list], hover: () => inside, uploaded: () => [...uploaded], busy: () => [...pending.values()].some(item => !item.error) };
}
