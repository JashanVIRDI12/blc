// Cars: the list (search, filters, sorting, a grid or rows, bulk changes,
// and status and the home-page star changed in place, with undo) and the
// editor for one car (a WhatsApp ad can fill it; the full registration,
// stock and notes stay private; a live preview shows the card as visitors
// will see it).
import { $, $$, esc, toast, fail, confirmDialog, busy, parsePrice, icon, copyText, downloadCSV, rupees, timeAgo } from './ui.js';
import { photoManager } from './photos.js';
import { adText } from './ad-text.js';
import { STATUS, BODIES, FUELS, TRANSMISSIONS, FOR_SALE, formatPrice, formatOwners, carTitle } from '../data.js';
import { drivenText, formatDriven, shownRegistration, normalizeRegistration, suggestPlate, plateDigits, plateLabel, normalizePlate, insuranceState, insuranceDays, LISTING_DEFAULTS } from '../listing-rules.js';
import { parseAd } from '../parse-ad.js';
import { safeImage, thumbImage, slugify, numeric, stored } from '../util.js';
import { showcase } from '../config.js';

const STATUS_HELP = {
  available: 'On sale and shown on the site.',
  reserved: 'Shown, marked Reserved; enquiries join a waiting list.',
  coming_soon: 'Shown as Coming soon; visitors can register interest.',
  sold: 'Moves to Recently delivered: no price, only the basics.',
  hidden: 'A draft. Never shown on the site.',
};
const MAKES = ['Aston Martin', 'Audi', 'Bentley', 'BMW', 'BYD', 'Ferrari', 'Force', 'Ford', 'Honda', 'Hyundai', 'Isuzu', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Mahindra', 'Maruti Suzuki', 'Maserati', 'McLaren', 'Mercedes-AMG', 'Mercedes-Benz', 'Mercedes-Maybach', 'MG', 'MINI', 'Nissan', 'Porsche', 'Rolls-Royce', 'Skoda', 'Tata', 'Toyota', 'Volkswagen', 'Volvo'];
const HIGHLIGHTS = ['Panoramic sunroof', 'Sunroof', 'Double sunroof', 'Ventilated seats', 'Massage seats', 'Rear entertainment screens', '360° camera', 'Head-up display', 'Air suspension', '4x4', 'Brand new tyres', 'Recently serviced', 'Under warranty', 'Fully loaded', 'Premium sound system', 'Ambient lighting', 'Pan-India finance'];
const COMMON_SPECS = ['Engine', 'Power', 'Torque', '0–100 km/h', 'Top speed', 'Drive', 'Seats'];
const INSPECTION = [['verifiedKm', 'Distance driven verified'], ['accidentFree', 'Non-accidental, verified'], ['mechanical', 'Mechanical inspection done'], ['body', 'Body inspection done'], ['interior', 'Interior inspection done'], ['serviceHistory', 'Service history reviewed'], ['ownership', 'Ownership verified']];
const STOCKS = ['BLC stock', 'A.M. stock', 'Park & Sale', 'Dealer', 'Outside'];
const FUEL_OPTIONS = [...FUELS, 'CNG', 'Petrol + CNG'];
const BODY_OPTIONS = [...BODIES, 'Motorhome'];
const statusOptions = current => Object.entries(STATUS).map(([value, label]) => `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`).join('');
const uuid = () => crypto.randomUUID?.() ?? '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
export const siteURL = (app, path) => `${path}${app.store.mode === 'preview' ? `${path.includes('?') ? '&' : '?'}preview` : ''}`;
const cover = car => car.photos[0] ? `<img src="${esc(thumbImage(car.photos[0]))}" data-full="${esc(safeImage(car.photos[0]))}" alt="" loading="lazy" />` : icon.car;
const rules = app => ({ ...LISTING_DEFAULTS, ...app.settings.listing });
const fullRegistration = (app, car) => app.private?.[car.id]?.registration || '';

// What a car on sale still lacks.
export function issues(car) {
  if (!FOR_SALE.includes(car.status)) return [];
  const list = [];
  if (!car.photos.length) list.push('No photos'); else if (car.photos.length < 4) list.push(`Only ${car.photos.length} photo${car.photos.length === 1 ? '' : 's'}`);
  if (!numeric(car.price)) list.push('No price');
  if (!car.year) list.push('No year');
  if (!numeric(car.kilometres)) list.push('Driven not set');
  return list;
}
// Small labels on a row or tile.
function chips(app, car) {
  const out = [];
  const plate = plateLabel(car, rules(app));
  if (plate) out.push(`<span class="a-chip a-chip--gold">${icon.plate}${esc(plate)}</span>`);
  const reg = fullRegistration(app, car);
  if (reg) out.push(`<span class="a-chip" title="Full registration, never shown on the site">${icon.lock}${esc(reg)}</span>`);
  const insurance = insuranceState(car);
  if (insurance && car.status !== 'sold') {
    const days = insuranceDays(car);
    out.push(`<span class="a-chip a-chip--${insurance}">Insurance ${insurance}${insurance === 'valid' && days !== null && days <= 30 ? ` · ${days} d left` : ''}</span>`);
  }
  for (const issue of issues(car)) out.push(`<span class="a-chip a-chip--warn">${icon.alert}${esc(issue)}</span>`);
  return out.join('');
}

// ------------------------------------------------------------------- list
const prefs = stored.get('baba:admin-cars', {});
let filter = 'all', query = '', make = '', sort = prefs.sort || 'recommended', layout = prefs.layout || 'rows';
const selected = new Set();
const SORTS = {
  recommended: ['Site order', (a, b) => (b.featured - a.featured) || (a.featured && b.featured ? a.featuredRank - b.featuredRank : 0) || (a.sortOrder - b.sortOrder)],
  updated: ['Recently edited', (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)],
  newest: ['Newest added', (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)],
  'price-desc': ['Price: high to low', (a, b) => (b.price ?? -1) - (a.price ?? -1)],
  'price-asc': ['Price: low to high', (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)],
  year: ['Year: newest first', (a, b) => (b.year ?? 0) - (a.year ?? 0)],
  km: ['Least driven first', (a, b) => (a.kilometres ?? Infinity) - (b.kilometres ?? Infinity)],
  make: ['Make A–Z', (a, b) => carTitle(a).localeCompare(carTitle(b))],
};

export function renderCars(view, app) {
  try { const preset = sessionStorage.getItem('baba:admin-filter'); if (preset) { filter = preset; sessionStorage.removeItem('baba:admin-filter'); } } catch {}
  const attention = app.cars.filter(car => issues(car).length).length;
  const counts = Object.fromEntries(['all', ...Object.keys(STATUS)].map(key => [key, key === 'all' ? app.cars.length : app.cars.filter(car => car.status === key).length]));
  const makes = [...new Set(app.cars.map(car => car.make).filter(Boolean))].sort();
  if (make && !makes.includes(make)) make = '';
  view.innerHTML = `<header class="a-head"><div><h1>Cars</h1><p class="a-sub">Every car you have. Change a status or the home-page star right here: it saves at once. Press <kbd>/</kbd> to search, <kbd>N</kbd> for a new car.</p></div><div class="a-head-actions"><button type="button" class="a-button" data-export>${icon.download}Export</button><a class="a-button" href="#car/new/paste">${icon.wand}Paste a WhatsApp ad</a><a class="a-button a-button--primary" href="#car/new">${icon.plus}Add a car</a></div></header>
    <div class="a-toolbar"><div class="a-tabs" role="group" aria-label="Show">${[['all', 'All'], ...Object.entries(STATUS)].map(([key, label]) => `<button type="button" data-filter="${key}" aria-pressed="${key === filter}">${label}<b>${counts[key]}</b></button>`).join('')}${attention ? `<button type="button" class="a-tab-warn" data-filter="attention" aria-pressed="${filter === 'attention'}">${icon.alert}Needs attention<b>${attention}</b></button>` : ''}</div></div>
    <div class="a-toolbar a-toolbar--tools"><label class="a-search">${icon.search}<span class="sr-only">Search cars</span><input type="search" placeholder="Make, model, year, colour or registration" value="${esc(query)}" data-query /></label>
      <label class="a-select-field"><span class="sr-only">Make</span><select data-make><option value="">Every make</option>${makes.map(name => `<option${name === make ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <label class="a-select-field"><span class="sr-only">Sort</span><select data-sort>${Object.entries(SORTS).map(([key, [label]]) => `<option value="${key}"${key === sort ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      <div class="a-segment" role="group" aria-label="Layout"><button type="button" data-layout="rows" aria-pressed="${layout === 'rows'}" aria-label="Rows">${icon.rows}</button><button type="button" data-layout="grid" aria-pressed="${layout === 'grid'}" aria-label="Grid">${icon.grid}</button></div></div>
    <div class="a-list-head" data-list-head></div>
    <div class="a-list" data-list></div>
    <div class="a-bulk" data-bulk hidden></div>`;
  const list = $('[data-list]', view);
  const visible = () => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return app.cars.filter(car => (filter === 'all' || (filter === 'attention' ? issues(car).length : car.status === filter)) && (!make || car.make === make)
      && words.every(word => `${carTitle(car)} ${car.year ?? ''} ${car.colour} ${car.registration} ${fullRegistration(app, car)} ${app.private?.[car.id]?.stock || ''} ${plateLabel(car, rules(app))}`.toLowerCase().includes(word)))
      .sort(SORTS[sort][1]);
  };
  const draw = () => {
    const cars = visible();
    for (const id of selected) if (!app.cars.some(car => car.id === id)) selected.delete(id);
    const value = cars.filter(car => FOR_SALE.includes(car.status)).reduce((sum, car) => sum + (car.price || 0), 0);
    $('[data-list-head]', view).innerHTML = cars.length ? `<label class="a-check-all"><input type="checkbox" data-select-all ${cars.every(car => selected.has(car.id)) ? 'checked' : ''} /><span>${cars.length} ${cars.length === 1 ? 'car' : 'cars'}${value ? ` · ${rupees(value)} on sale` : ''}</span></label>` : '';
    list.classList.toggle('is-grid', layout === 'grid');
    if (!app.cars.length) { list.innerHTML = `<div class="a-empty"><h2>No cars yet.</h2><p>Add the first one: paste its WhatsApp ad and the form fills itself, then drop in the photos.</p><div class="a-inline-actions"><a class="a-button" href="#car/new/paste">${icon.wand}Paste a WhatsApp ad</a><a class="a-button a-button--primary" href="#car/new">${icon.plus}Add a car</a></div></div>`; return; }
    if (!cars.length) { list.innerHTML = `<div class="a-empty"><p>No cars match.</p></div>`; return; }
    list.innerHTML = cars.map(car => layout === 'grid' ? tile(app, car) : row(app, car)).join('');
    list.querySelectorAll('img[data-full]').forEach(img => img.addEventListener('error', () => { if (img.getAttribute('src') !== img.dataset.full) img.src = img.dataset.full; }, { once: true }));
    drawBulk();
  };
  const drawBulk = () => {
    const bulk = $('[data-bulk]', view);
    bulk.hidden = !selected.size;
    if (!selected.size) return;
    bulk.innerHTML = `<b>${selected.size} selected</b><span class="a-bulk-group"><span>Mark as</span>${Object.entries(STATUS).map(([key, label]) => `<button type="button" class="a-button a-button--small" data-bulk-status="${key}" data-tone="${key}"><i class="a-dot"></i>${label}</button>`).join('')}</span>
      <span class="a-bulk-group">${app.collections.length ? `<label class="a-select-field a-select-field--small"><span class="sr-only">Add to a collection</span><select data-bulk-collection><option value="">Add to a collection…</option>${app.collections.map(group => `<option value="${esc(group.slug)}">${esc(group.title)}</option>`).join('')}</select></label>` : ''}<button type="button" class="a-button a-button--small" data-bulk-feature>${icon.star}Home page</button><button type="button" class="a-button a-button--small" data-bulk-copy>${icon.copy}Copy ads</button><button type="button" class="a-button a-button--small a-button--danger" data-bulk-delete>${icon.trash}Delete</button></span><button type="button" class="a-link" data-bulk-clear>Clear</button>`;
  };
  draw();

  const savePrefs = () => stored.set('baba:admin-cars', { sort, layout });
  $$('[data-filter]', view).forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; $$('[data-filter]', view).forEach(other => other.setAttribute('aria-pressed', String(other === button))); draw(); }));
  $('[data-query]', view).addEventListener('input', event => { query = event.target.value; draw(); });
  $('[data-make]', view).addEventListener('change', event => { make = event.target.value; draw(); });
  $('[data-sort]', view).addEventListener('change', event => { sort = event.target.value; savePrefs(); draw(); });
  $$('[data-layout]', view).forEach(button => button.addEventListener('click', () => { layout = button.dataset.layout; savePrefs(); $$('[data-layout]', view).forEach(other => other.setAttribute('aria-pressed', String(other === button))); draw(); }));
  $('[data-export]', view).addEventListener('click', () => exportCars(app));
  view.addEventListener('change', event => {
    if (event.target.matches('[data-select-all]')) { visible().forEach(car => event.target.checked ? selected.add(car.id) : selected.delete(car.id)); draw(); }
    if (event.target.matches('[data-select]')) { const id = event.target.closest('[data-id]').dataset.id; event.target.checked ? selected.add(id) : selected.delete(id); event.target.closest('[data-id]').classList.toggle('is-selected', event.target.checked); drawBulk(); const all = $('[data-select-all]', view); if (all) all.checked = visible().every(car => selected.has(car.id)); }
  });

  list.addEventListener('change', async event => {
    const select = event.target.closest('[data-status]');
    if (!select) return;
    const car = app.cars.find(entry => entry.id === select.closest('[data-id]').dataset.id);
    await setStatus(app, car, select.value, car.status, draw);
  });
  list.addEventListener('click', async event => {
    const row = event.target.closest('[data-id]');
    if (!row) return;
    const car = app.cars.find(entry => entry.id === row.dataset.id);
    const menu = row.querySelector('details');
    if (event.target.closest('[data-star]')) await toggleFeatured(app, car, draw);
    if (event.target.closest('[data-copy-ad]')) { menu.open = false; await copyText(adText(car, rules(app))); toast('The WhatsApp ad is copied. Paste it into a chat or a group.'); }
    if (event.target.closest('[data-duplicate]')) { menu.open = false; await duplicate(app, car); }
    if (event.target.closest('[data-delete]')) { menu.open = false; await remove(app, car, draw); }
  });

  // Bulk changes.
  const chosen = () => app.cars.filter(car => selected.has(car.id));
  view.addEventListener('click', async event => {
    const bulk = event.target.closest('[data-bulk] button');
    if (!bulk) return;
    const cars = chosen();
    if (bulk.matches('[data-bulk-clear]')) { selected.clear(); draw(); return; }
    if (bulk.matches('[data-bulk-copy]')) { await copyText(cars.map(car => adText(car, rules(app))).join('\n\n')); toast(`${cars.length} ads copied`); return; }
    if (bulk.matches('[data-bulk-status]')) {
      const status = bulk.dataset.bulkStatus, before = cars.map(car => [car.id, car.status]);
      await busy(bulk, async () => {
        try {
          const saved = await Promise.all(cars.map(car => app.store.patchCar(car.id, { status })));
          saved.forEach(car => replace(app, car));
          draw();
          toast(`${cars.length} ${cars.length === 1 ? 'car' : 'cars'}: ${STATUS[status]}`, { action: 'Undo', onAction: async () => { try { (await Promise.all(before.map(([id, old]) => app.store.patchCar(id, { status: old })))).forEach(car => replace(app, car)); draw(); } catch (error) { fail(error); } } });
        } catch (error) { fail(error); }
      });
    }
    if (bulk.matches('[data-bulk-feature]')) {
      let rank = Math.max(0, ...app.cars.filter(car => car.featured).map(car => car.featuredRank));
      await busy(bulk, async () => {
        try { (await Promise.all(cars.filter(car => !car.featured).map(car => app.store.patchCar(car.id, { featured: true, featuredRank: ++rank })))).forEach(car => replace(app, car)); draw(); toast('On the home page. Set their order under Home page.'); }
        catch (error) { fail(error); }
      });
    }
    if (bulk.matches('[data-bulk-delete]')) {
      if (!(await confirmDialog({ title: `Delete ${cars.length} ${cars.length === 1 ? 'car' : 'cars'}?`, body: 'They and their photos go for good. To keep them on record, mark them Sold or Hidden instead.', confirm: 'Delete for good', danger: true }))) return;
      try {
        for (const car of cars) { await app.store.deleteCar(car, app.cars.filter(entry => entry.id !== car.id)); app.cars = app.cars.filter(entry => entry.id !== car.id); }
        selected.clear(); app.refresh(); draw(); toast(`${cars.length} deleted`);
      } catch (error) { fail(error); }
    }
  });
  view.addEventListener('change', async event => {
    const select = event.target.closest('[data-bulk-collection]');
    if (!select?.value) return;
    const slug = select.value, cars = chosen().filter(car => !car.collections.includes(slug));
    try { (await Promise.all(cars.map(car => app.store.patchCar(car.id, { collections: [...car.collections, slug] })))).forEach(car => replace(app, car)); toast(`Added to ${app.collections.find(group => group.slug === slug)?.title}`); }
    catch (error) { fail(error); }
    select.value = '';
  });
}

function row(app, car) {
  const meta = [car.year, drivenText(car.kilometres, rules(app)), car.fuel, formatOwners(car.owners)].filter(Boolean).join(' · ');
  return `<article class="a-row${selected.has(car.id) ? ' is-selected' : ''}" data-id="${esc(car.id)}">
    <label class="a-pick"><input type="checkbox" data-select${selected.has(car.id) ? ' checked' : ''} /><span class="sr-only">Select ${esc(carTitle(car))}</span></label>
    <a class="a-row-main" href="#car/${esc(car.id)}"><span class="a-thumb">${cover(car)}${car.photos.length ? `<i class="a-thumb-n">${car.photos.length}</i>` : ''}</span><span class="a-row-text"><b>${esc(`${car.make} ${car.model}`)}${car.variant ? ` <span>${esc(car.variant)}</span>` : ''}</b><small>${esc(meta || 'Details to add')}</small><span class="a-chips">${chips(app, car)}</span></span></a>
    <span class="a-row-price">${esc(car.status === 'sold' ? 'Sold' : formatPrice(car.price) || 'On request')}</span>
    ${controls(app, car)}
  </article>`;
}
function tile(app, car) {
  return `<article class="a-tile${selected.has(car.id) ? ' is-selected' : ''}" data-id="${esc(car.id)}">
    <label class="a-pick"><input type="checkbox" data-select${selected.has(car.id) ? ' checked' : ''} /><span class="sr-only">Select ${esc(carTitle(car))}</span></label>
    <a class="a-tile-photo" href="#car/${esc(car.id)}">${cover(car)}${car.photos.length ? `<i class="a-thumb-n">${car.photos.length}</i>` : ''}</a>
    <a class="a-tile-text" href="#car/${esc(car.id)}"><small>${esc(car.make)}</small><b>${esc(car.model)}${car.variant ? ` <span>${esc(car.variant)}</span>` : ''}</b><span>${esc([car.year, car.status === 'sold' ? 'Sold' : formatPrice(car.price) || 'On request'].filter(Boolean).join(' · '))}</span></a>
    <span class="a-chips">${chips(app, car)}</span>
    <div class="a-tile-controls">${controls(app, car)}</div>
  </article>`;
}
const controls = (app, car) => `<label class="a-status" data-tone="${car.status}"><span class="sr-only">Status of ${esc(carTitle(car))}</span><select data-status>${statusOptions(car.status)}</select></label>
    <button type="button" class="a-star" data-star aria-pressed="${car.featured}" title="${car.featured ? 'On the home page' : 'Show on the home page'}">${icon.star}<span>Home</span></button>
    <details class="a-menu"><summary aria-label="More for ${esc(carTitle(car))}">•••</summary><div><a href="#car/${esc(car.id)}">Edit</a><a href="${esc(siteURL(app, `/car/?id=${encodeURIComponent(car.slug)}`))}" target="_blank" rel="noopener">View on site ↗</a><button type="button" data-copy-ad>Copy WhatsApp ad</button><button type="button" data-duplicate>Duplicate</button><button type="button" data-delete class="is-danger">Delete…</button></div></details>`;

function replace(app, car) { app.cars = app.cars.map(entry => entry.id === car.id ? car : entry); app.refresh(); }

async function setStatus(app, car, status, before, redraw) {
  try {
    replace(app, await app.store.patchCar(car.id, { status }));
    redraw();
    toast(`${car.make} ${car.model}: ${STATUS[status]}`, { action: 'Undo', onAction: async () => { try { replace(app, await app.store.patchCar(car.id, { status: before })); redraw(); } catch (error) { fail(error); } } });
  } catch (error) { fail(error); redraw(); }
}

export async function toggleFeatured(app, car, redraw) {
  const featured = !car.featured;
  const featuredRank = featured ? Math.max(0, ...app.cars.filter(entry => entry.featured).map(entry => entry.featuredRank)) + 1 : car.featuredRank;
  try {
    replace(app, await app.store.patchCar(car.id, { featured, featuredRank }));
    redraw();
    toast(featured ? `${car.make} ${car.model} is now on the home page` : `${car.make} ${car.model} is off the home page`, { action: 'Undo', onAction: async () => { try { replace(app, await app.store.patchCar(car.id, { featured: !featured, featuredRank: car.featuredRank })); redraw(); } catch (error) { fail(error); } } });
  } catch (error) { fail(error); }
}

async function duplicate(app, car) {
  const copy = { ...structuredClone(car), id: uuid(), status: 'hidden', featured: false, slug: uniqueSlug(app, `${car.make} ${car.model} ${car.year ?? ''} copy`, null) };
  try {
    const saved = await app.store.saveCar(copy);
    app.cars = [saved, ...app.cars];
    app.refresh();
    toast('Copied as a hidden draft. Change what differs, then set it Available.');
    location.hash = `#car/${saved.id}`;
  } catch (error) { fail(error); }
}

async function remove(app, car, after) {
  const answer = await confirmDialog({ title: `Delete the ${car.make} ${car.model}?`, body: 'This removes the car and its photos for good. To keep it on record, mark it Sold or Hidden instead.', confirm: 'Delete for good', danger: true, extra: car.status === 'hidden' ? null : 'Hide it instead' });
  if (!answer) return false;
  try {
    if (answer === 'extra') { replace(app, await app.store.patchCar(car.id, { status: 'hidden' })); toast(`${car.make} ${car.model} is hidden`); }
    else { await app.store.deleteCar(car, app.cars.filter(entry => entry.id !== car.id)); app.cars = app.cars.filter(entry => entry.id !== car.id); app.refresh(); toast(`${car.make} ${car.model} deleted`); }
    after();
    return answer;
  } catch (error) { fail(error); return false; }
}

function uniqueSlug(app, text, id) {
  const base = slugify(text) || 'car';
  let slug = base, n = 2;
  while (app.cars.some(car => car.slug === slug && car.id !== id)) slug = `${base}-${n++}`;
  return slug;
}

// Every car, with its private details, as a spreadsheet.
export function exportCars(app) {
  const head = ['Make', 'Model', 'Variant', 'Status', 'Price (₹)', 'Year', 'Driven', 'Fuel', 'Gearbox', 'Owners', 'Colour', 'Body', 'Registration (full)', 'Registration (shown)', 'Number plate', 'Insurance', 'Insurance until', 'Stock', 'Photos', 'Home page', 'Collections', 'Highlights', 'Notes', 'Web address', 'Added', 'Updated'];
  const rows = [...app.cars].sort(SORTS.make[1]).map(car => {
    const own = app.private?.[car.id] || {};
    return [car.make, car.model, car.variant, STATUS[car.status], car.price ?? '', car.year ?? '', car.kilometres ?? '', car.fuel, car.transmission, car.owners ?? '', car.colour, car.body, own.registration || '', car.registration, plateLabel(car, rules(app)), insuranceState(car), car.insuranceUntil || '', own.stock || '', car.photos.length, car.featured ? 'Yes' : '', car.collections.join('; '), car.highlights.join('; '), own.notes || '', `${location.origin}/car/?id=${car.slug}`, car.createdAt?.slice(0, 10) || '', car.updatedAt?.slice(0, 10) || ''];
  });
  downloadCSV(`baba-cars-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows]);
  toast(`${rows.length} cars exported`);
}

// ----------------------------------------------------------------- editor
export function renderEditor(view, app, id, { paste = false } = {}) {
  const creating = !id || id === 'new';
  const original = creating ? { id: uuid(), slug: '', make: '', model: '', variant: '', body: 'SUV', year: null, kilometres: null, owners: null, fuel: '', transmission: 'Automatic', colour: '', registration: '', plateTag: '', plateNumber: '', insurance: '', insuranceUntil: null, location: 'New Delhi', price: null, status: 'available', note: '', featured: false, featuredRank: 0, sortOrder: 0, collections: [], photos: [], hoverPhoto: '', highlights: [], description: '', specs: [], inspection: null, model3d: '' } : app.cars.find(car => car.id === id);
  if (!original) { view.innerHTML = `<div class="a-empty"><h2>That car isn’t here.</h2><p>It may have been deleted.</p><a class="a-button" href="#cars">Back to cars</a></div>`; return; }
  let car = structuredClone(original);
  Object.assign(car, normalizePlate(car));
  const own = { registration: '', stock: '', notes: '', ...(app.private?.[car.id] || {}) };
  const listing = rules(app);
  const inspection = car.inspection || {};
  const bodies = BODY_OPTIONS.includes(car.body) || !car.body ? BODY_OPTIONS : [car.body, ...BODY_OPTIONS];
  const fuels = FUEL_OPTIONS.includes(car.fuel) || !car.fuel ? FUEL_OPTIONS : [car.fuel, ...FUEL_OPTIONS];
  const options = (values, current, empty = 'Not stated') => `<option value="">${empty}</option>${values.map(value => `<option${value === current ? ' selected' : ''}>${esc(value)}</option>`).join('')}`;
  const owners = `<option value="">Not stated</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${car.owners === n ? ' selected' : ''}>${formatOwners(n)}</option>`).join('')}<option value="0"${car.owners === 0 ? ' selected' : ''}>Unregistered</option>`;
  const priceText = numeric(car.price) ? String(car.price) : '';

  view.innerHTML = `<header class="a-head a-head--editor"><div><a class="a-back" href="#cars">← All cars</a><h1 data-title>${creating ? 'Add a car' : esc(`${car.make} ${car.model}`)}</h1><p class="a-sub" data-state>${creating ? 'Paste its WhatsApp ad to fill the form, or type what you know; only the make and model are required.' : `Last saved ${esc(timeAgo(car.updatedAt))}. Changes are saved when you press Save (⌘S).`}</p></div><div class="a-head-actions">${creating ? '' : `<a class="a-button" href="${esc(siteURL(app, `/car/?id=${encodeURIComponent(car.slug)}`))}" target="_blank" rel="noopener">View on site ${icon.out}</a>`}<button type="button" class="a-button a-button--primary" data-save>Save</button></div></header>
  <form class="a-editor" novalidate autocomplete="off">
    <div class="a-editor-main">
      <details class="a-card a-paste"${paste || creating ? ' open' : ''}><summary><span>${icon.wand}<b>Fill from a WhatsApp ad</b></span><small>Paste the ad as the team writes it; every field it understands is filled in.</small></summary>
        <textarea data-paste rows="4" placeholder="BMW X7 XDRIVE 30D{PHYTONIC BLUE COLOUR} | 2021 MODEL | DIESEL | SECOND OWNER | AUTOMATIC TRANSMISSION | HR70H9908 | 80000KM DRIVEN | INSURANCE EXPIRED | PAN INDIA FINANCE AVAILABLE | @✅68LACS"></textarea>
        <div class="a-inline-actions"><button type="button" class="a-button a-button--primary a-button--small" data-fill>${icon.wand}Fill the form</button><span class="a-hint" data-fill-result></span></div></details>
      <section class="a-card"><h2>Photos</h2><p class="a-hint">The first photo is the cover. Choose a cabin photo with ${icon.eye} and the card turns to it when a visitor points at it on the collection page.</p><div data-photos></div></section>
      <section class="a-card"><h2>The car</h2><div class="a-grid">
        <label class="a-field"><span>Make <i aria-hidden="true">*</i></span><input name="make" list="a-makes" required maxlength="40" placeholder="Mercedes-Benz" value="${esc(car.make)}" /></label>
        <label class="a-field"><span>Model <i aria-hidden="true">*</i></span><input name="model" required maxlength="60" placeholder="GLS 400 d" value="${esc(car.model)}" /></label>
        <label class="a-field a-span-2">Variant<input name="variant" maxlength="80" placeholder="4MATIC AMG Line" value="${esc(car.variant)}" /></label>
        <label class="a-field">Body<select name="body">${options(bodies, car.body)}</select></label>
        <label class="a-field">Year (model)<input name="year" type="number" inputmode="numeric" min="1950" max="2100" placeholder="2022" value="${car.year ?? ''}" /></label>
        <label class="a-field">Driven<input name="kilometres" type="number" inputmode="numeric" min="0" step="1" placeholder="75000" value="${car.kilometres ?? ''}" /><small data-km-hint></small></label>
        <label class="a-field">Ownership<select name="owners">${owners}</select></label>
        <label class="a-field">Fuel<select name="fuel">${options(fuels, car.fuel)}</select></label>
        <label class="a-field">Gearbox<select name="transmission">${options(TRANSMISSIONS, car.transmission)}</select></label>
        <label class="a-field">Colour<input name="colour" maxlength="60" placeholder="Phytonic Blue" value="${esc(car.colour)}" /></label>
        <label class="a-field">Location<input name="location" maxlength="60" placeholder="New Delhi" value="${esc(car.location)}" /></label>
      </div></section>
      <section class="a-card"><h2>Registration and number plate</h2>
        <div class="a-grid">
          <label class="a-field"><span class="a-label-icon">Full registration ${icon.lock}</span><input name="fullRegistration" maxlength="20" placeholder="HR51CM9909" value="${esc(own.registration || '')}" autocapitalize="characters" spellcheck="false" /><small>Private: only you see the full number.</small></label>
          <div class="a-field"><span>Shown on the site</span><output class="a-shown" data-shown></output><small data-shown-hint></small></div>
        </div>
        <fieldset class="a-fieldset"><legend>Number plate tag</legend><div class="a-segment a-segment--wide" role="radiogroup">${[['', 'None'], ['fancy', 'Fancy number'], ['vip', 'VIP number']].map(([value, label]) => `<label><input type="radio" name="plateTag" value="${value}"${(car.plateTag || '') === value ? ' checked' : ''} /><span>${label}</span></label>`).join('')}</div></fieldset>
        <div class="a-grid" data-plate-fields><label class="a-field">Number shown<input name="plateNumber" inputmode="numeric" maxlength="4" placeholder="0001 or 7272" value="${esc(car.plateNumber)}" /><small>Filled from the registration, or enter the digits here. Leading zeros are kept.</small></label><div class="a-field"><span>On the site</span><output class="a-plate-preview" data-plate-preview aria-live="polite"></output></div></div>
        <p class="a-hint">VIP or Fancy is selected automatically as you type. Numbers 0001–0099 are VIP; ordinary numbers have no tag.</p>
      </section>
      <section class="a-card"><h2>Insurance</h2><div class="a-grid">
        <label class="a-field">Insurance<select name="insurance"><option value="">Not stated</option><option value="valid"${car.insurance === 'valid' ? ' selected' : ''}>Valid</option><option value="expired"${car.insurance === 'expired' ? ' selected' : ''}>Expired</option></select></label>
        <label class="a-field">Valid until (optional, never shown)<input name="insuranceUntil" type="date" value="${esc(car.insuranceUntil || '')}" /></label>
      </div><p class="a-hint" data-insurance-hint></p></section>
      <section class="a-card"><h2>Highlights and description</h2>
        <div class="a-field"><span id="highlights-label">Highlights</span><div class="a-tags" data-tags><input aria-labelledby="highlights-label" placeholder="Type one and press Enter" data-tag-input maxlength="60" /></div><small>Tap to add:</small><div class="a-suggest" data-suggest></div></div>
        <label class="a-field">About this car<textarea name="description" rows="5" maxlength="4000" placeholder="One or two short paragraphs: its condition, its history, what makes it special.">${esc(car.description)}</textarea></label>
      </section>
      <section class="a-card"><h2>Specification</h2><p class="a-hint">Shown as a table on the car’s page.</p><div class="a-specs" data-specs></div><div class="a-inline-actions"><button type="button" class="a-button a-button--small" data-add-spec>${icon.plus}Add a row</button><button type="button" class="a-button a-button--small a-button--ghost" data-common-specs>Add the usual rows</button></div></section>
      <section class="a-card"><h2>Inspection and history</h2><p class="a-hint">Tick only what you have checked; each ticked item is listed on the car’s page.</p><div class="a-checks">${INSPECTION.map(([key, label]) => `<label class="a-check"><input type="checkbox" name="inspect-${key}"${inspection[key] === true ? ' checked' : ''} /><span>${label}</span></label>`).join('')}</div>
        <div class="a-grid"><label class="a-field">Tyre condition (%)<input name="tyrePercent" type="number" min="0" max="100" inputmode="numeric" value="${inspection.tyrePercent ?? ''}" placeholder="85" /></label><label class="a-field">Inspected on<input name="checkedAt" type="date" value="${esc(toDateInput(inspection.checkedAt))}" /></label><label class="a-field a-span-2">Inspection report link<input name="reportUrl" type="url" placeholder="https://…" value="${esc(inspection.reportUrl || '')}" /></label></div>
      </section>
    </div>
    <aside class="a-editor-side">
      <section class="a-card a-preview-card"><h2>On the site</h2><div class="a-preview" data-preview></div><p class="a-hint">Point at the photo to see the hover photo.</p></section>
      <section class="a-card"><h2>Price</h2><label class="a-field">Asking price (₹)<input name="price" inputmode="decimal" placeholder="68 lakh, 1.25 cr or 6800000" value="${esc(priceText)}" /><small data-price-hint></small></label>
        <label class="a-field">Card note<input name="note" maxlength="80" placeholder="Near-final price" value="${esc(car.note)}" /><small>An optional short line shown under the car.</small></label></section>
      <section class="a-card"><h2>Status</h2><div class="a-status-options" role="radiogroup" aria-label="Status">${Object.entries(STATUS).map(([value, label]) => `<label class="a-radio" data-tone="${value}"><input type="radio" name="status" value="${value}"${car.status === value ? ' checked' : ''} /><span><b>${label}</b><small>${STATUS_HELP[value]}</small></span></label>`).join('')}</div></section>
      <section class="a-card a-card--private"><h2>${icon.lock}For the dealership</h2><p class="a-hint">Never shown on the site.</p>
        <label class="a-field">Stock<input name="stock" list="a-stocks" maxlength="40" placeholder="BLC stock" value="${esc(own.stock || '')}" /></label>
        <label class="a-field">Notes<textarea name="privateNotes" rows="4" maxlength="4000" placeholder="Seller, purchase price, keys, pending work…">${esc(own.notes || '')}</textarea></label></section>
      <section class="a-card"><h2>Share</h2><p class="a-hint">The WhatsApp ad, in your style and with your rules.</p><pre class="a-ad" data-ad></pre><div class="a-inline-actions"><button type="button" class="a-button a-button--small" data-copy-ad>${icon.copy}Copy the ad</button><a class="a-button a-button--small" data-share-ad target="_blank" rel="noopener">${icon.chat}Send on WhatsApp</a></div></section>
      <section class="a-card"><h2>Home page</h2><label class="a-switch"><input type="checkbox" name="featured"${car.featured ? ' checked' : ''} /><span>Show in the Featured collection</span></label><p class="a-hint">Set the order on the <a href="#home">Home page</a> tab.</p></section>
      <section class="a-card"><h2>Collections</h2>${app.collections.length ? `<div class="a-checks">${app.collections.map(group => `<label class="a-check"><input type="checkbox" name="collection" value="${esc(group.slug)}"${car.collections.includes(group.slug) ? ' checked' : ''} /><span>${esc(group.title)}</span></label>`).join('')}</div>` : '<p class="a-hint">No collections yet.</p>'}<p class="a-hint"><a href="#collections">Manage collections</a></p></section>
      <section class="a-card"><h2>3D model on the home page</h2><label class="a-field">This car is a…<select name="model3d"><option value="">None</option>${showcase.map(item => `<option value="${item.id}"${car.model3d === item.id ? ' selected' : ''}>${esc(`${item.make} ${item.model}`)}</option>`).join('')}</select><small>If it is one of the 3D cars in the home page’s drive, clicking that car opens this one.</small></label></section>
      ${creating ? '' : `<section class="a-card a-card--quiet"><h2>More</h2><div class="a-inline-actions"><button type="button" class="a-button a-button--small" data-duplicate>${icon.copy}Duplicate</button><button type="button" class="a-button a-button--small a-button--danger" data-delete>${icon.trash}Delete…</button></div><p class="a-hint">Web address: <code>/car/?id=${esc(car.slug)}</code></p></section>`}
    </aside>
    <div class="a-savebar"><span data-dirty>No changes</span><button type="button" class="a-button a-button--primary" data-save>Save</button></div>
  </form>
  <datalist id="a-makes">${MAKES.map(name => `<option value="${name}">`).join('')}</datalist><datalist id="a-stocks">${STOCKS.map(name => `<option value="${name}">`).join('')}</datalist>`;

  const form = $('form', view);
  const field = name => form.elements[name];

  // Photos.
  let photos = car.photos, hover = car.hoverPhoto;
  const manager = photoManager($('[data-photos]', view), { photos, hover, carId: car.id, store: app.store, onChange: (next, inside) => { photos = next; hover = inside; mark(); } });

  // Highlights.
  let highlights = [...car.highlights];
  const tags = $('[data-tags]', view);
  const tagInput = $('[data-tag-input]', view);
  const drawTags = () => {
    $$('.a-tag', tags).forEach(tag => tag.remove());
    tagInput.before(...highlights.map((text, i) => { const tag = document.createElement('span'); tag.className = 'a-tag'; tag.innerHTML = `${esc(text)}<button type="button" data-untag="${i}" aria-label="Remove ${esc(text)}">${icon.x}</button>`; return tag; }));
    $('[data-suggest]', view).innerHTML = HIGHLIGHTS.filter(text => !highlights.includes(text)).map(text => `<button type="button" data-suggestion>${esc(text)}</button>`).join('');
  };
  const addTag = text => { text = text.trim().replace(/,$/, ''); if (text && !highlights.includes(text)) { highlights.push(text); drawTags(); mark(); } };
  tagInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput.value); tagInput.value = ''; }
    if (event.key === 'Backspace' && !tagInput.value && highlights.length) { highlights.pop(); drawTags(); mark(); }
  });
  tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; } });
  tags.addEventListener('click', event => { const button = event.target.closest('[data-untag]'); if (button) { highlights.splice(Number(button.dataset.untag), 1); drawTags(); mark(); } else tagInput.focus(); });
  $('[data-suggest]', view).addEventListener('click', event => { const button = event.target.closest('[data-suggestion]'); if (button) addTag(button.textContent); });
  drawTags();

  // Specification rows.
  let specs = car.specs.map(([key, value]) => [key, value]);
  const specHolder = $('[data-specs]', view);
  const drawSpecs = () => {
    specHolder.innerHTML = specs.length ? specs.map(([key, value], i) => `<div class="a-spec" data-spec="${i}"><input aria-label="Name" placeholder="Power" value="${esc(key)}" data-spec-key maxlength="40" /><input aria-label="Value" placeholder="510 hp" value="${esc(value)}" data-spec-value maxlength="80" /><button type="button" class="a-icon-button" data-unspec aria-label="Remove row">${icon.x}</button></div>`).join('') : '<p class="a-hint">No rows yet.</p>';
  };
  specHolder.addEventListener('input', event => { const row = event.target.closest('[data-spec]'); if (!row) return; const i = Number(row.dataset.spec); specs[i] = [$('[data-spec-key]', row).value, $('[data-spec-value]', row).value]; mark(); });
  specHolder.addEventListener('click', event => { const button = event.target.closest('[data-unspec]'); if (button) { specs.splice(Number(button.closest('[data-spec]').dataset.spec), 1); drawSpecs(); mark(); } });
  $('[data-add-spec]', view).addEventListener('click', () => { specs.push(['', '']); drawSpecs(); mark(); $$('[data-spec-key]', specHolder).at(-1).focus(); });
  $('[data-common-specs]', view).addEventListener('click', () => { for (const key of COMMON_SPECS) if (!specs.some(([name]) => name === key)) specs.push([key, '']); drawSpecs(); mark(); $$('[data-spec-value]', specHolder).find(input => !input.value)?.focus(); });
  drawSpecs();

  // What the form holds now, as a car.
  const number = name => { const value = field(name).value.trim(); return value === '' ? null : Number(value); };
  function collect() {
    const next = { ...car };
    for (const name of ['make', 'model', 'variant', 'body', 'fuel', 'transmission', 'colour', 'location', 'note', 'description', 'model3d', 'insurance']) next[name] = field(name).value.trim();
    next.year = number('year');
    next.kilometres = number('kilometres');
    next.owners = field('owners').value === '' ? null : Number(field('owners').value);
    next.price = parsePrice(field('price').value);
    next.status = form.querySelector('[name=status]:checked')?.value || 'available';
    next.featured = field('featured').checked;
    next.collections = $$('[name=collection]:checked', form).map(input => input.value);
    next.photos = photos;
    next.hoverPhoto = photos.includes(hover) ? hover : '';
    next.highlights = highlights;
    next.specs = specs.map(([key, value]) => [key.trim(), value.trim()]).filter(([key, value]) => key && value);
    // The registration: the site keeps only what it may show.
    const full = normalizeRegistration(field('fullRegistration').value);
    next.registration = full ? shownRegistration(full, listing) : original.registration;
    next.plateTag = form.querySelector('[name=plateTag]:checked')?.value || '';
    next.plateNumber = field('plateNumber').value;
    Object.assign(next, normalizePlate(next));
    next.insuranceUntil = field('insuranceUntil').value || null;
    const checks = Object.fromEntries(INSPECTION.filter(([key]) => field(`inspect-${key}`).checked).map(([key]) => [key, true]));
    const tyre = number('tyrePercent');
    if (numeric(tyre) && tyre <= 100) checks.tyrePercent = tyre;
    if (field('checkedAt').value) checks.checkedAt = new Date(`${field('checkedAt').value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (field('reportUrl').value.trim()) checks.reportUrl = field('reportUrl').value.trim();
    next.inspection = Object.keys(checks).length ? checks : null;
    return next;
  }
  const collectPrivate = () => ({ car_id: car.id, registration: normalizeRegistration(field('fullRegistration').value) || null, stock: field('stock').value.trim() || null, notes: field('privateNotes').value.trim() || null });

  // Live hints, the preview and the ad.
  const priceHint = $('[data-price-hint]', view);
  const kmHint = $('[data-km-hint]', view);
  function hints() {
    const next = collect();
    const price = next.price;
    priceHint.textContent = price === null ? 'Empty shows “Price on request”.' : Number.isNaN(price) ? 'Type a number, such as 68 lakh or 1.25 cr.' : `Shown as ${formatPrice(price)} (₹${new Intl.NumberFormat('en-IN').format(price)})`;
    priceHint.classList.toggle('is-error', Number.isNaN(price));
    kmHint.textContent = numeric(next.kilometres) ? `Shown as “${drivenText(next.kilometres, listing)}”, never with km.` : 'Shown as “Driven 75,000”, never with km.';
    // Registration and plate.
    $('[data-shown]', view).textContent = next.registration || '—';
    $('[data-shown-hint]', view).textContent = listing.regShow === 'chars' ? `The first ${listing.regChars} characters (Settings).` : 'The state and RTO code (Settings).';
    $('[data-plate-preview]', view).innerHTML = next.plateTag && next.plateNumber ? `<span class="a-plate-chip" data-tone="${next.plateTag}">${icon.plate}${esc(plateLabel(next, listing))}</span>` : `<span class="a-hint">${field('plateNumber').value ? 'No number plate tag.' : 'Add the digits.'}</span>`;
    // Insurance.
    const state = insuranceState(next), days = insuranceDays(next);
    $('[data-insurance-hint]', view).innerHTML = !state ? 'Not shown on the site.' : `Shown as <b>Insurance: ${state === 'valid' ? 'Valid' : 'Expired'}</b>, with no date.${next.insuranceUntil ? (days >= 0 ? ` It turns to Expired by itself on ${new Date(`${next.insuranceUntil}T12:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} (in ${days} ${days === 1 ? 'day' : 'days'}).` : ' The date has passed, so it shows Expired.') : ''}`;
    preview(next);
    const ad = adText({ ...next, slug: next.slug || '' }, listing);
    $('[data-ad]', view).textContent = ad;
    $('[data-share-ad]', view).href = `https://wa.me/?text=${encodeURIComponent(ad)}`;
  }
  function preview(next) {
    const facts = next.status === 'sold' ? [next.year, next.fuel] : [next.year, drivenText(next.kilometres, listing), next.fuel, formatOwners(next.owners)];
    const plate = next.status === 'sold' ? '' : plateLabel(next, listing);
    $('[data-preview]', view).innerHTML = `<div class="a-preview-visual${next.hoverPhoto ? ' has-inside' : ''}${next.status === 'sold' ? ' is-sold' : ''}">${next.photos[0] ? `<img src="${esc(thumbImage(next.photos[0]))}" alt="" />` : icon.car}${next.hoverPhoto ? `<img class="a-preview-inside" src="${esc(thumbImage(next.hoverPhoto))}" alt="" /><span class="a-preview-label">Inside</span>` : ''}${plate ? `<span class="a-plate-chip a-plate-chip--on" data-tone="${next.plateTag}">${icon.plate}${esc(plate)}</span>` : ''}${next.status === 'sold' ? '<span class="a-preview-sold">Sold</span>' : ''}</div>
      <div class="a-preview-body"><small>${esc(next.make || 'Make')}</small><b>${esc(next.model || 'Model')}${next.variant ? ` <span>${esc(next.variant)}</span>` : ''}</b><strong>${esc(next.status === 'sold' ? '' : Number.isNaN(next.price) ? '' : formatPrice(next.price) || 'Price on request')}</strong><p>${facts.filter(Boolean).map(esc).join('<i></i>')}</p>${next.note && next.status !== 'sold' ? `<em>${esc(next.note)}</em>` : ''}</div>`;
  }

  // Fill from a WhatsApp ad.
  $('[data-fill]', view).addEventListener('click', () => {
    const text = $('[data-paste]', view).value;
    if (!text.trim()) { $('[data-paste]', view).focus(); return; }
    const { car: ad, found } = parseAd(text);
    const set = (name, value) => { if (value === null || value === undefined || value === '') return; const input = field(name); if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === String(value))) input.add(new Option(value, value)); input.value = String(value); };
    set('make', ad.make); set('model', ad.model); set('variant', ad.variant); set('body', ad.body); set('year', ad.year); set('kilometres', ad.kilometres);
    set('owners', ad.owners); set('fuel', ad.fuel); set('transmission', ad.transmission); set('colour', ad.colour); set('fullRegistration', ad.registration);
    set('insurance', ad.insurance); set('insuranceUntil', ad.insuranceUntil); set('note', ad.note);
    if (ad.price) field('price').value = ad.price >= 1e7 ? `${+(ad.price / 1e7).toFixed(2)} cr` : `${+(ad.price / 1e5).toFixed(2)} lakh`;
    for (const text of ad.highlights) addTag(text);
    if (ad.registration) autoPlate('fullRegistration');
    hints(); mark();
    const names = { name: 'make and model', year: 'year', fuel: 'fuel', owners: 'ownership', transmission: 'gearbox', registration: 'registration', kilometres: 'driven', insurance: 'insurance', price: 'price' };
    $('[data-fill-result]', view).innerHTML = `${icon.check} Filled ${found.map(key => names[key]).filter(Boolean).join(', ') || 'what it could'}${ad.highlights.length ? ` and ${ad.highlights.length} highlight${ad.highlights.length === 1 ? '' : 's'}` : ''}. Check them below, then add the photos.`;
    toast('Form filled from the ad');
  });
  function autoPlate(source) {
    if (source === 'fullRegistration') field('plateNumber').value = plateDigits(field(source).value);
    const plate = suggestPlate(field('plateNumber').value);
    form.querySelector(`[name=plateTag][value="${plate?.tag || ''}"]`).checked = true;
  }
  function onPlateInput(event) {
    const name = event.target.name;
    if (name === 'fullRegistration' || name === 'plateNumber') {
      if (name === 'plateNumber') {
        field(name).value = field(name).value.replace(/\D/g, '').slice(0, 4);
        // Pad only after editing, so typing "20" doesn't become "0002".
        if (event.type === 'change') field(name).value = plateDigits(field(name).value);
      }
      autoPlate(name);
    } else if (name === 'plateTag') {
      if (event.target.value && !field('plateNumber').value) field('plateNumber').value = plateDigits(field('fullRegistration').value);
      const plate = normalizePlate({ plateTag: event.target.value, plateNumber: field('plateNumber').value });
      if (plate.plateTag) form.querySelector(`[name=plateTag][value="${plate.plateTag}"]`).checked = true;
    }
    mark();
  }
  $('[data-copy-ad]', view).addEventListener('click', async () => { await copyText($('[data-ad]', view).textContent); toast('The WhatsApp ad is copied'); });

  let snapshot = JSON.stringify([collect(), collectPrivate()]);
  const dirty = () => JSON.stringify([collect(), collectPrivate()]) !== snapshot;
  const dirtyLabel = $('[data-dirty]', view);
  function mark() { const changed = dirty(); dirtyLabel.textContent = changed ? 'Unsaved changes' : 'No changes'; view.classList.toggle('is-dirty', changed); hints(); }
  form.addEventListener('input', onPlateInput);
  form.addEventListener('change', onPlateInput);
  form.addEventListener('submit', event => event.preventDefault());
  app.guard = () => dirty() || manager.busy();
  app.discard = () => { const keep = new Set(app.cars.flatMap(entry => entry.photos)); app.store.removePhotos(manager.uploaded().filter(url => !keep.has(url))).catch(() => {}); };
  hints();
  if (paste) requestAnimationFrame(() => $('[data-paste]', view).focus());

  async function save(button) {
    if (manager.busy()) { toast('Photos are still uploading. Save again in a moment.', { tone: 'error' }); return; }
    const next = collect();
    const problems = [];
    if (!next.make) problems.push(['make', 'Add the make, such as Mercedes-Benz.']);
    if (!next.model) problems.push(['model', 'Add the model, such as GLS 400 d.']);
    if (Number.isNaN(next.price)) problems.push(['price', 'The price should be a number, such as 68 lakh or 1.25 cr.']);
    if (next.year !== null && (next.year < 1950 || next.year > 2100)) problems.push(['year', 'Check the year.']);
    if (problems.length) { toast(problems[0][1], { tone: 'error' }); field(problems[0][0]).focus(); return; }
    if (!next.slug) next.slug = uniqueSlug(app, `${next.make} ${next.model} ${next.variant} ${next.year ?? ''}`, next.id);
    if (next.featured && !original.featured) next.featuredRank = Math.max(0, ...app.cars.filter(entry => entry.featured && entry.id !== next.id).map(entry => entry.featuredRank)) + 1;
    if (creating) next.sortOrder = Math.max(0, ...app.cars.map(entry => entry.sortOrder)) + 1;
    await busy(button, async () => {
      try {
        const saved = await app.store.saveCar(next);
        const ownNext = collectPrivate();
        if (ownNext.registration || ownNext.stock || ownNext.notes || app.private?.[saved.id]) app.private[saved.id] = await app.store.savePrivate(ownNext);
        // Photos taken off the car leave storage, unless another car uses them.
        const keep = new Set([...saved.photos, ...app.cars.filter(entry => entry.id !== saved.id).flatMap(entry => entry.photos)]);
        app.store.removePhotos([...original.photos, ...manager.uploaded()].filter(url => !keep.has(url))).catch(() => {});
        app.cars = creating ? [saved, ...app.cars] : app.cars.map(entry => entry.id === saved.id ? saved : entry);
        app.refresh();
        app.guard = null;
        toast(creating ? `${saved.make} ${saved.model} added${saved.status === 'hidden' ? ' as a hidden draft' : ' to the collection'}` : 'Saved', creating ? {} : { action: 'View on site', onAction: () => open(siteURL(app, `/car/?id=${encodeURIComponent(saved.slug)}`), '_blank') });
        if (creating) location.hash = `#car/${saved.id}`;
        else renderEditor(view, app, saved.id);
      } catch (error) { fail(error); }
    });
  }
  $$('[data-save]', view).forEach(button => button.addEventListener('click', () => save(button)));
  addEventListener('keydown', function shortcut(event) {
    if (!view.isConnected || !view.contains(form)) { removeEventListener('keydown', shortcut); return; }
    if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); save($('[data-save]', view)); }
  });
  $('[data-duplicate]', view)?.addEventListener('click', () => duplicate(app, original));
  $('[data-delete]', view)?.addEventListener('click', async () => { app.guard = null; if (!(await remove(app, original, () => {}))) { app.guard = () => dirty() || manager.busy(); return; } location.hash = '#cars'; });
}

// "12 October 2026" back into the date field's 2026-10-12.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function toDateInput(text) {
  const match = String(text || '').toLowerCase().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  const month = match ? MONTHS.findIndex(name => name.startsWith(match[2].slice(0, 3))) : -1;
  return month < 0 ? '' : `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}
