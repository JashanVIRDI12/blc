import { inventory, showcase, currency, dealer } from './config.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const safeURL = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
const present = value => value !== null && value !== undefined && value !== '';
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const number = value => new Intl.NumberFormat('en-IN').format(value);
// The two manufacturer figures that best say what kind of car it is.
const KEY_SPECS = ['Power', '0–100 km/h', 'Wading depth', 'Approach angle', 'Seats'];
const keySpecs = item => KEY_SPECS.map(key => item.specs?.find(([name]) => name === key)).filter(Boolean).slice(0, 2);

export function setupInventory(openEnquiry) {
  const records = inventory.filter(item => item.available !== false);
  const previews = records.length === 0;
  const items = previews ? showcase : records;
  const grid = document.querySelector('#vehicle-grid');
  const search = document.querySelector('#vehicle-search');
  const make = document.querySelector('#make-filter');
  const sort = document.querySelector('#sort-filter');
  const dialog = document.querySelector('#vehicle-dialog');
  const details = document.querySelector('#vehicle-details');
  if (!previews) document.querySelector('#collection-intro').textContent = 'A considered selection. Explore the details, review the history and arrange a closer look.';
  [...new Set(items.map(item => item.make))].sort().forEach(value => make.add(new Option(value, value)));
  if (previews) {
    for (const option of sort.options) if (option.value !== 'featured') option.disabled = true;
  }
  function openDetails(item) {
    const fields = [
      ['Year', item.year], ['Kilometres', numeric(item.kilometres) ? `${number(item.kilometres)} km` : null],
      ['Ownership', numeric(item.owners) ? `${item.owners} ${item.owners === 1 ? 'owner' : 'owners'}` : null],
      ['Fuel', item.fuel], ['Transmission', item.transmission], ['Location', item.location],
    ];
    const checks = item.inspection;
    const summary = [];
    if (checks?.verifiedKm && numeric(item.kilometres)) summary.push('Mileage records verified');
    if (checks?.accidentFree === true) summary.push('Non-accidental condition verified');
    if (checks?.mechanical === true) summary.push('Mechanical inspection recorded');
    if (checks?.body === true) summary.push('Body condition inspection recorded');
    if (checks?.interior === true) summary.push('Interior inspection recorded');
    if (checks?.serviceHistory === true) summary.push('Service history reviewed');
    if (numeric(checks?.tyrePercent) && checks.tyrePercent <= 100) summary.push(`Tyre condition: ${checks.tyrePercent}%`);
    if (checks?.ownership === true) summary.push('Ownership verified');
    if (checks?.checkedAt) summary.push(`Recorded ${checks.checkedAt}`);
    const photo = safeURL(item.image) || '/vehicle-placeholder.svg';
    const report = checks?.reportUrl ? safeURL(checks.reportUrl) : '';
    details.innerHTML = `<div class="vehicle-detail-layout"><div class="detail-image" data-photo="${previews ? 'cutout' : 'full'}"><span class="vehicle-label">${previews ? 'Showcase vehicle' : `The ${escapeHTML(dealer.name)} collection`}</span><img src="${escapeHTML(photo)}" alt="${escapeHTML(`${item.make} ${item.model}`)}" /></div><div class="vehicle-detail-copy"><p class="eyebrow">${escapeHTML(item.make)}</p><h2 id="vehicle-detail-title">${escapeHTML(item.model)}</h2>${numeric(item.price) ? `<p class="detail-price">${currency.format(item.price)}</p>` : ''}<dl class="spec-list">${fields.map(([key,value])=>`<div><dt>${key}</dt><dd>${present(value) ? escapeHTML(value) : 'Not supplied'}</dd></div>`).join('')}</dl>${previews ? '<p class="detail-preview-note">This is a showcase vehicle, not a live stock listing. Enquire about current availability and request the vehicle’s price, history and inspection records.</p>' : ''}${summary.length ? `<p class="detail-inspection">${summary.map(escapeHTML).join('<br>')}${report ? `<br><a class="text-link" href="${escapeHTML(report)}" target="_blank" rel="noopener">View inspection report ↗</a>` : ''}</p>` : ''}<button class="solid-button" id="vehicle-enquire">${previews ? 'Enquire about this type of car' : 'Arrange a viewing'}</button></div></div>`;
    attachImageFallback(details);
    details.querySelectorAll('img').forEach(framePhoto);
    document.querySelector('#vehicle-enquire').addEventListener('click', () => { dialog.close(); openEnquiry(`${item.make} ${item.model}${previews ? ' — availability enquiry' : ` — ${item.id}`}`); });
    dialog.showModal();
  }
  function render() {
    const query = search.value.toLocaleLowerCase().trim();
    const results = items.filter(item => (!make.value || item.make === make.value) && `${item.make} ${item.model} ${item.year ?? ''} ${item.body ?? ''} ${item.fuel ?? ''} ${item.location ?? ''}`.toLocaleLowerCase().includes(query));
    const value = (item, key) => numeric(item[key]) ? item[key] : Infinity;
    if (sort.value === 'price-low') results.sort((a,b) => value(a,'price') - value(b,'price'));
    if (sort.value === 'mileage') results.sort((a,b) => value(a,'kilometres') - value(b,'kilometres'));
    if (sort.value === 'newest') results.sort((a,b) => (numeric(b.year) ? b.year : 0) - (numeric(a.year) ? a.year : 0));
    grid.replaceChildren();
    results.forEach(item => {
      const article = document.createElement('article'); article.className = 'vehicle-card';
      const meta = [item.year, numeric(item.kilometres) ? `${number(item.kilometres)} km` : null, numeric(item.owners) ? `${item.owners} ${item.owners===1?'owner':'owners'}` : null, item.fuel, item.transmission, item.location].filter(present);
      article.innerHTML = `<button class="vehicle-visual" data-photo="${previews ? 'cutout' : 'full'}" aria-label="View ${escapeHTML(`${item.make} ${item.model}`)} details"><img src="${escapeHTML(safeURL(item.image) || '/vehicle-placeholder.svg')}" alt="${escapeHTML(`${item.make} ${item.model}`)}" loading="lazy" width="900" height="600" /><span class="vehicle-label">${previews ? 'Collection preview' : escapeHTML(item.body || 'Selected vehicle')}</span><span class="view-vehicle">View details</span></button><div class="vehicle-card-heading"><div><p class="make">${escapeHTML(item.make)}</p><h3>${escapeHTML(item.model)}</h3></div>${numeric(item.price) ? `<span class="vehicle-price">${currency.format(item.price)}</span>` : ''}</div>${keySpecs(item).length ? `<dl class="vehicle-keyspecs">${keySpecs(item).map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>` : ''}${meta.length ? `<div class="vehicle-meta">${meta.map(v=>`<span>${escapeHTML(v)}</span>`).join('')}</div>` : '<p class="availability">Enquire for current availability</p>'}${item.inspection?.mechanical === true ? '<span class="inspection-indicator">Inspection record available</span>' : ''}`;
      article.querySelector('button').addEventListener('click', () => openDetails(item));
      attachImageFallback(article);
      article.querySelectorAll('img').forEach(framePhoto);
      grid.append(article);
    });
    document.querySelector('#collection-count').textContent = `${results.length} ${previews ? `collection ${results.length===1?'preview':'previews'}` : `vehicle${results.length===1?'':'s'}`}`;
    document.querySelector('#no-results').hidden = results.length > 0;
    document.dispatchEvent(new Event('layout:change'));
  }
  search.addEventListener('input', render); make.addEventListener('change', render); sort.addEventListener('change', render);
  document.querySelector('#collection-filters').addEventListener('submit', e => e.preventDefault());
  document.querySelector('#reset-filters').addEventListener('click', () => { search.value=''; make.value=''; sort.value='featured'; render(); search.focus(); });
  render();
}

// Cut-out renders stand on the lit plinth; photographs fill the frame. A
// transparent top-left pixel marks a cut-out.
function framePhoto(img) {
  const frame = img.closest('[data-photo]');
  const read = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
      frame.dataset.photo = context.getImageData(0, 0, 1, 1).data[3] < 16 ? 'cutout' : 'full';
    } catch { frame.dataset.photo = 'full'; }
  };
  if (img.complete && img.naturalWidth) read(); else img.addEventListener('load', read);
}

function attachImageFallback(container) {
  container.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
    img.alt = "Vehicle photographs available on request";
    img.src = "/vehicle-placeholder.svg";
  }, { once: true }));
}
