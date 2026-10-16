// Cover controls for curated collections and automatic groups. Reuses the
// stock photos and the portal's existing upload storage.
import { $, esc, icon, compressImage, fail } from './ui.js';
import { safeImage } from '../util.js';
import { AUTO_COVER, GENERATED_COVERS, collectionCover, stockPhotos, coverImage, bindCoverFallbacks } from '../collection-covers.js';

export function coverPicker(container, { value = '', slug = '', cars = [], store, onChange = () => {}, label = 'Cover photo' }) {
  let selected = value || '', uploading = false, disposed = false;
  const available = stockPhotos(cars);
  const carList = [...new Map(available.map(({ car }) => [car.id, car])).values()];
  const title = car => [car.year, car.make, car.model, car.variant].filter(Boolean).join(' ');
  container.innerHTML = `<fieldset class="a-fieldset a-cover-picker"><legend>${esc(label)}</legend>
    <div class="a-cover-preview" data-cover-preview></div><p class="a-hint" data-cover-status role="status" aria-live="polite"></p>
    <div class="a-inline-actions"><button type="button" class="a-button a-button--small" data-cover-upload>${icon.photo}Upload a photo</button><input type="file" accept="image/*" hidden data-cover-file /><button type="button" class="a-button a-button--small a-button--ghost" data-cover-auto>Use car photos automatically</button>${GENERATED_COVERS[slug] ? '<button type="button" class="a-button a-button--small a-button--ghost" data-cover-default>Use generated cover</button>' : ''}</div>
    <details class="a-cover-library"><summary>Choose from collection photos${available.length ? ` (${available.length})` : ''}</summary>${carList.length ? `<label class="a-field">Car<select data-cover-car>${carList.map(car => `<option value="${esc(car.id)}">${esc(title(car))}${car.status === 'sold' ? ' · Sold' : ''}</option>`).join('')}</select></label><div class="a-cover-options" data-cover-options role="group" aria-label="Car photos"></div>` : '<p class="a-hint">Add photos to a car to choose them here.</p>'}</details>
    <details class="a-cover-library"><summary>Generated covers</summary><div class="a-cover-options a-cover-options--generated" data-generated-options>${Object.entries(GENERATED_COVERS).map(([name, url]) => `<button type="button" data-generated="${name}" aria-pressed="false"><img src="${url}" alt="${name[0].toUpperCase() + name.slice(1)} cover" loading="lazy" /><span>${name[0].toUpperCase() + name.slice(1)}</span></button>`).join('')}</div></details>
    <details class="a-cover-library"><summary>Use an image URL</summary><label class="a-field">Image address<input type="url" data-cover-url placeholder="https://…" /></label><button type="button" class="a-button a-button--small" data-cover-use-url>Use image</button></details>
  </fieldset>`;

  function draw() {
    const url = collectionCover(slug, selected);
    const seen = new Set();
    const automatic = available.filter(({ car }) => { if (seen.has(car.id)) return false; seen.add(car.id); return true; }).slice(0, slug === 'all' ? 4 : 1).map(photo => photo.url);
    const preview = $('[data-cover-preview]', container);
    preview.classList.toggle('is-mosaic', !url && automatic.length > 1);
    preview.innerHTML = url ? coverImage(url, available[0]?.url) : automatic.map(url => coverImage(url)).join('') || `<span>${icon.photo}A car photo will appear here.</span>`;
    bindCoverFallbacks(preview);
    $('[data-cover-status]', container).textContent = uploading ? 'Uploading your cover…' : url ? (selected && selected !== GENERATED_COVERS[slug] ? 'Selected cover. Save to apply it.' : 'Generated collection cover. Save to apply it.') : 'The cover follows the photos of cars in this collection.';
    container.querySelectorAll('[data-photo-url]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.photoUrl === selected)));
    container.querySelectorAll('[data-generated]').forEach(button => button.setAttribute('aria-pressed', String(safeImage(GENERATED_COVERS[button.dataset.generated]) === url)));
    $('[data-cover-auto]', container).setAttribute('aria-pressed', String(!url));
  }
  const choose = next => { selected = next; $('[data-cover-url]', container).setCustomValidity(''); $('[data-cover-url]', container).value = ''; draw(); onChange(selected); };
  function drawPhotos() {
    const holder = $('[data-cover-options]', container);
    if (!holder) return;
    const id = $('[data-cover-car]', container).value;
    holder.innerHTML = available.filter(photo => photo.car.id === id).map(({ url }, i) => `<button type="button" data-photo-url="${esc(url)}" aria-label="Use photo ${i + 1} as the cover" aria-pressed="${selected === url}">${coverImage(url)}<span>Photo ${i + 1}</span></button>`).join('');
    bindCoverFallbacks(holder);
  }
  const chosenCar = available.find(photo => photo.url === selected)?.car;
  if (chosenCar) $('[data-cover-car]', container).value = chosenCar.id;
  drawPhotos(); draw();
  $('[data-cover-car]', container)?.addEventListener('change', drawPhotos);
  container.addEventListener('click', event => {
    const photo = event.target.closest('[data-photo-url]');
    if (photo) choose(photo.dataset.photoUrl);
    const generated = event.target.closest('[data-generated]');
    if (generated) choose(GENERATED_COVERS[generated.dataset.generated]);
  });
  $('[data-cover-auto]', container).addEventListener('click', () => choose(AUTO_COVER));
  $('[data-cover-default]', container)?.addEventListener('click', () => choose(''));
  $('[data-cover-use-url]', container).addEventListener('click', () => {
    const input = $('[data-cover-url]', container), next = input.value.trim();
    input.setCustomValidity(next && safeImage(next) && /^https?:\/\//i.test(next) ? '' : 'Enter an image address starting with https:// or http://.');
    if (!input.reportValidity()) return;
    choose(next);
  });
  $('[data-cover-url]', container).addEventListener('input', event => event.target.setCustomValidity(''));
  const input = $('[data-cover-file]', container);
  $('[data-cover-upload]', container).addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0]; input.value = '';
    if (!file || uploading) return;
    uploading = true; onChange(selected); draw();
    container.querySelectorAll('button, input, select, label.a-button').forEach(control => { if ('disabled' in control) control.disabled = true; });
    try {
      const preview = store.mode === 'preview';
      const [blob, thumbnail] = await Promise.all([compressImage(file, preview ? { max: 1200, quality: .78 } : {}), preview ? null : compressImage(file, { max: 720, quality: .74 })]);
      const url = await store.uploadPhoto(blob, slug || 'collection', thumbnail, 'collections');
      if (!disposed) choose(url);
    } catch (error) { if (!disposed) fail(error); }
    finally {
      uploading = false;
      if (!disposed) { container.querySelectorAll('button, input, select').forEach(control => { control.disabled = false; }); draw(); onChange(selected); }
    }
  });
  return { value: () => selected || null, busy: () => uploading, destroy: () => { disposed = true; } };
}
