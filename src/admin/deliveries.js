// Deliveries: photographs of cars handed over to their new owners, shown in
// the home page's "Across India" gallery and on the collection page. Drop in
// as many as you like; give each the place it went to and a line ("Mr Sharma
// and his Defender"), hide or reorder them.
import { $, esc, toast, fail, confirmDialog, icon, compressImage } from './ui.js';
import { siteURL } from './cars.js';
import { safeImage, thumbImage } from '../util.js';

const uuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function renderDeliveries(view, app) {
  view.innerHTML = `<header class="a-head"><div><h1>Deliveries</h1><p class="a-sub">Handover photos, captioned with the place each car went to. The home page’s Across India gallery shows Baba’s own set (deliveryPhotos in src/config.js); while that set is empty, it shows these.</p></div><a class="a-button" href="${esc(siteURL(app, '/'))}#india" target="_blank" rel="noopener">View the gallery ${icon.out}</a></header>
    <section class="a-card"><label class="a-drop" data-drop><input type="file" accept="image/*" multiple hidden data-file>${icon.gallery}<span><b>Add delivery photos</b> — drag them here or <u>choose from your device</u></span><small>Portrait photos work best. They show in this order; the newest come first.</small></label>
      <p class="a-hint" data-progress hidden></p>
      <ol class="a-deliveries" data-grid></ol></section>`;
  const grid = $('[data-grid]', view);
  const rows = () => [...(app.deliveries || [])].sort((a, b) => a.sort_order - b.sort_order || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  const draw = () => {
    const list = rows();
    grid.innerHTML = list.length ? list.map((row, i) => `<li class="a-delivery${row.visible ? '' : ' is-muted'}" data-id="${esc(row.id)}"><figure><img src="${esc(thumbImage(row.photo))}" data-full="${esc(safeImage(row.photo))}" alt="" loading="lazy" />${row.visible ? '' : '<span class="a-cover">Hidden</span>'}</figure>
      <label class="a-field"><span class="sr-only">Where it went</span><input data-city maxlength="60" placeholder="Where it went: city or state" value="${esc(row.city || '')}" /></label>
      <label class="a-field"><span class="sr-only">Caption</span><input data-caption maxlength="120" placeholder="Add a caption" value="${esc(row.caption || '')}" /></label>
      <div class="a-delivery-tools"><label class="a-switch a-switch--small" title="Show on the site"><input type="checkbox" data-visible${row.visible ? ' checked' : ''} /><span class="sr-only">Show on the site</span></label><button type="button" class="a-icon-button" data-move="-1" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>${icon.up}</button><button type="button" class="a-icon-button" data-move="1" aria-label="Move later" ${i === list.length - 1 ? 'disabled' : ''}>${icon.down}</button><button type="button" class="a-icon-button" data-delete aria-label="Delete this photo">${icon.trash}</button></div></li>`).join('')
      : '<li class="a-empty a-empty--small"><p>No delivery photos yet. The section stays off the site until there is one.</p></li>';
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
  const drop = $('[data-drop]', view), input = $('[data-file]', view);
  input.addEventListener('change', () => { add([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); add([...event.dataTransfer.files].filter(file => file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name))); });

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
    if (move) {
      const order = [...list], j = i + Number(move.dataset.move);
      [order[i], order[j]] = [order[j], order[i]];
      try { await Promise.all(order.map((row, k) => row.sort_order === k ? null : save({ ...row, sort_order: k })).filter(Boolean)); draw(); } catch (error) { fail(error); }
    }
    if (event.target.closest('[data-delete]')) {
      if (!(await confirmDialog({ title: 'Delete this photo?', body: 'It leaves the site and the gallery for good.', confirm: 'Delete', danger: true }))) return;
      try { await app.store.deleteDelivery(list[i]); app.deliveries = (app.deliveries || []).filter(row => row.id !== list[i].id); draw(); toast('Deleted'); } catch (error) { fail(error); }
    }
  });
}
