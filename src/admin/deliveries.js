// Deliveries: photographs of cars handed over to their new owners, shown in
// the home page's "Across India" gallery and on the collection page. Drop in
// as many as you like; give each the place it went to and a line ("Mr Sharma
// and his Defender"), hide or reorder them.
import { $, esc, toast, fail, confirmDialog, icon, compressImage } from './ui.js';
import { siteURL } from './cars.js';
import { safeImage, thumbImage } from '../util.js';
import { deliveryPhotos } from '../config.js';

let adopting = null; // the move of the site's own photos, while it runs
const uuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function renderDeliveries(view, app) {
  view.innerHTML = `<header class="a-head"><div><h1>Deliveries</h1><p class="a-sub">Handover photos for the home page’s Across India gallery, in the order they show. Drag a photo to move it; click its place or caption to change it.</p></div>
    <div class="a-head-actions"><a class="a-button" href="${esc(siteURL(app, '/'))}#india" target="_blank" rel="noopener">View the gallery ${icon.out}</a><label class="a-button a-button--primary">${icon.plus}Add photos<input type="file" accept="image/*" multiple hidden data-file></label></div></header>
    <section class="a-card a-gallery-card" data-drop>
      <div class="a-gallery-bar"><p class="a-gallery-count" data-count></p><p class="a-hint" data-progress hidden></p></div>
      <ol class="a-deliveries" data-grid></ol>
      <p class="a-drop-veil" aria-hidden="true">${icon.gallery}<b>Drop to add these photos</b></p>
    </section>`;
  const grid = $('[data-grid]', view);
  const rows = () => [...(app.deliveries || [])].sort((a, b) => a.sort_order - b.sort_order || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  const draw = () => {
    const list = rows(), shown = list.filter(row => row.visible).length;
    $('[data-count]', view).textContent = !list.length ? 'No photos yet' : `${list.length} ${list.length === 1 ? 'photo' : 'photos'}${shown === list.length ? ', all on the site' : `, ${shown} on the site`}`;
    grid.innerHTML = `<li class="a-delivery-add"><label>${icon.plus}<b>Add photos</b><small>or drop them anywhere here</small><input type="file" accept="image/*" multiple hidden data-file></label></li>` + list.map((row, i) => `<li class="a-delivery${row.visible ? '' : ' is-muted'}" data-id="${esc(row.id)}" draggable="true">
      <figure><img src="${esc(thumbImage(row.photo))}" data-full="${esc(safeImage(row.photo))}" alt="" loading="lazy" draggable="false" />
        <span class="a-delivery-n" aria-hidden="true">${i + 1}</span>${row.visible ? '' : '<span class="a-delivery-off">Hidden</span>'}
        <span class="a-delivery-tools"><button type="button" class="a-delivery-tool a-delivery-tool--back" data-move="-1" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>${icon.up}</button><button type="button" class="a-delivery-tool a-delivery-tool--on" data-move="1" aria-label="Move later" ${i === list.length - 1 ? 'disabled' : ''}>${icon.down}</button><button type="button" class="a-delivery-tool a-delivery-tool--delete" data-delete aria-label="Delete this photo">${icon.trash}</button></span></figure>
      <div class="a-delivery-text"><input class="a-delivery-city" data-city maxlength="60" placeholder="Where it went" aria-label="Where it went: city or state" value="${esc(row.city || '')}" /><input class="a-delivery-caption" data-caption maxlength="120" placeholder="Add a caption" aria-label="Caption" value="${esc(row.caption || '')}" /></div>
      <label class="a-switch a-switch--small a-delivery-show"><input type="checkbox" data-visible${row.visible ? ' checked' : ''} /><span>${row.visible ? 'On the site' : 'Hidden'}</span></label>
    </li>`).join('');
    grid.querySelectorAll('img[data-full]').forEach(img => img.addEventListener('error', () => { if (img.getAttribute('src') !== img.dataset.full) img.src = img.dataset.full; }, { once: true }));
  };
  draw();


  const save = async row => { const saved = await app.store.saveDelivery(row); app.deliveries = [...(app.deliveries || []).filter(other => other.id !== saved.id), saved]; return saved; };
  async function add(files) {
    const progress = $('[data-progress]', view);
    progress.hidden = false;
    let done = 0;
    const first = Math.min(0, ...rows().map(row => row.sort_order)) - files.length;
    for (const [i, file] of files.entries()) {
      progress.innerHTML = `<i class="a-spinner"></i>Uploading ${i + 1} of ${files.length}…`;
      try {
        const preview = app.store.mode === 'preview';
        const [blob, thumb] = await Promise.all([compressImage(file, preview ? { max: 1000, quality: .76 } : { max: 1800, quality: .84 }), preview ? null : compressImage(file, { max: 720, quality: .74 })]);
        const id = uuid();
        const photo = await app.store.uploadPhoto(blob, id, thumb, 'deliveries');
        await save({ id, photo, caption: null, visible: true, sort_order: first + i });
        done++;
        draw();
      } catch (error) { fail(error); }
    }
    progress.hidden = true;
    if (done) toast(`${done} ${done === 1 ? 'photo' : 'photos'} added`);
  }
  // The photos built into the site come here the first time this tab opens,
  // after the ones already here, so they can be edited, reordered, hidden or
  // removed like the rest; then the site stops showing its own copies. Each
  // keeps a fixed id, so an interrupted move picks up where it stopped.
  async function adopt() {
    if (app.settings.gallery?.builtIn === false || !deliveryPhotos.length) return;
    const progress = $('[data-progress]', view);
    progress.hidden = false;
    const missing = deliveryPhotos.filter(({ id }) => !rows().some(row => row.id === id));
    let next = Math.max(-1, ...rows().map(row => row.sort_order)) + 1;
    try {
      for (const [i, { id, city, card }] of missing.entries()) {
        progress.innerHTML = `<i class="a-spinner"></i>Moving the site’s own delivery photos here, so you can edit them: ${i + 1} of ${missing.length}…`;
        const source = await fetch(card);
        if (!source.ok) throw new Error(`The photo for ${city} couldn’t be read.`);
        const file = await source.blob();
        const preview = app.store.mode === 'preview';
        const [blob, thumb] = await Promise.all([compressImage(file, preview ? { max: 1000, quality: .76 } : { max: 1800, quality: .84 }), preview ? null : compressImage(file, { max: 720, quality: .74 })]);
        const photo = await app.store.uploadPhoto(blob, id, thumb, 'deliveries');
        await save({ id, photo, city, caption: null, visible: true, sort_order: next++ });
        draw();
      }
      await app.store.saveSettings('gallery', { builtIn: false });
      app.settings.gallery = { builtIn: false };
      if (missing.length) toast(`${missing.length} delivery ${missing.length === 1 ? 'photo' : 'photos'} moved here. You can edit them now.`);
    } catch (error) { fail(error); }
    progress.hidden = true;
  }
  adopting ??= adopt().finally(() => { adopting = null; });
  // Photos come from either Add button, or dropped anywhere on the grid.
  const drop = $('[data-drop]', view);
  view.addEventListener('change', event => { if (!event.target.matches('[data-file]')) return; add([...event.target.files]); event.target.value = ''; });
  const files = event => [...(event.dataTransfer?.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { if (!files(event)) return; event.preventDefault(); drop.classList.add('is-over'); }));
  drop.addEventListener('dragleave', event => { if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-over'); });
  drop.addEventListener('drop', event => { drop.classList.remove('is-over'); if (!event.dataTransfer.files.length) return; event.preventDefault(); add([...event.dataTransfer.files].filter(file => file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name))); });

  // A photo dragged onto another takes its place; the rest shift along.
  const reorder = async (from, to) => {
    const order = rows(), [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    try { await Promise.all(order.map((row, k) => row.sort_order === k ? null : save({ ...row, sort_order: k })).filter(Boolean)); draw(); toast('Order saved'); } catch (error) { fail(error); }
  };
  let dragged = null;
  grid.addEventListener('dragstart', event => { const item = event.target.closest('.a-delivery'); if (!item || event.target.matches('input')) return; dragged = item; item.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.dataset.id); });
  grid.addEventListener('dragover', event => { if (!dragged) return; const over = event.target.closest('.a-delivery'); if (!over || over === dragged) return; event.preventDefault(); grid.querySelectorAll('.is-target').forEach(el => el !== over && el.classList.remove('is-target')); over.classList.add('is-target'); });
  grid.addEventListener('drop', event => {
    if (!dragged) return;
    event.preventDefault(); event.stopPropagation();
    const over = event.target.closest('.a-delivery'), list = rows();
    const from = list.findIndex(row => row.id === dragged.dataset.id), to = over ? list.findIndex(row => row.id === over.dataset.id) : -1;
    if (from > -1 && to > -1 && from !== to) reorder(from, to);
  });
  grid.addEventListener('dragend', () => { dragged?.classList.remove('is-dragging'); dragged = null; grid.querySelectorAll('.is-target').forEach(el => el.classList.remove('is-target')); });

  grid.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches('[data-city], [data-caption]')) event.target.blur(); });
  grid.addEventListener('change', async event => {
    const item = event.target.closest('[data-id]');
    if (!item) return;
    const row = rows().find(entry => entry.id === item.dataset.id);
    try {
      if (event.target.matches('[data-caption]')) { await save({ ...row, caption: event.target.value.trim() || null }); toast('Caption saved'); }
      if (event.target.matches('[data-city]')) { await save({ ...row, city: event.target.value.trim() || null }); draw(); toast(event.target.value.trim() ? `Saved: ${event.target.value.trim()}` : 'Place removed'); }
      if (event.target.matches('[data-visible]')) { await save({ ...row, visible: event.target.checked }); draw(); toast(event.target.checked ? 'Shown on the site' : 'Hidden from the site'); }
    } catch (error) { fail(error); }
  });
  grid.addEventListener('click', async event => {
    const item = event.target.closest('[data-id]');
    if (!item) return;
    const list = rows(), i = list.findIndex(entry => entry.id === item.dataset.id);
    const move = event.target.closest('[data-move]');
    if (move) reorder(i, i + Number(move.dataset.move));
    if (event.target.closest('[data-delete]')) {
      if (!(await confirmDialog({ title: 'Delete this photo?', body: 'It leaves the site and the gallery for good.', confirm: 'Delete', danger: true }))) return;
      try { await app.store.deleteDelivery(list[i]); app.deliveries = (app.deliveries || []).filter(row => row.id !== list[i].id); draw(); toast('Deleted'); } catch (error) { fail(error); }
    }
  });
}
