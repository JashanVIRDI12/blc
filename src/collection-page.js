// The collection page (/collection/): the collection drive as it opens (five
// cars arrive out of the white and park before the title), every car for
// sale, the curated collections, filters that answer at once, and the cars
// recently delivered. The filters live in the address, so a filtered view
// can be shared.
import './styles.css';
import './light.css';
import './fleet.css';
import './collection.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { setupPage } from './chrome.js';
import { loadSite, FOR_SALE, BODIES, FUELS, PRICE_BANDS, KM_BANDS, STATUS, priceBand, isNew, recommended, plateLabel } from './data.js';
import { carCard, shortlist } from './cards.js';
import { escapeHTML, numeric } from './util.js';
import { marqueArt, sizeMarques } from './marque-art.js';
import { fleetVehicles } from './config.js';
import { models } from './models.js';
import { prefetchModels } from './model-cache.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
// "Recently delivered" (delivered.js), the ring of cars handed over: set to
// true to show it again.
const SHOW_DELIVERED = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The drive's five cars start downloading now, while three.js and the drive
// itself are still on their way, rather than after them (model-cache.js). At
// a low priority, so the scripts that draw the page come first.
if (!reduced && 'WebGL2RenderingContext' in window) prefetchModels(fleetVehicles.map(({ id }) => models[id].url));
const { renderContact } = setupPage('collection');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const bodyPlural = body => /s$/i.test(body) ? body : `${body}s`;
const goBrowse = () => $('#browse').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });

introCopy();
startDrive();
init().catch(error => { console.error(error); $('[data-grid]').removeAttribute('aria-busy'); });

// The drive loads in the background; without WebGL, or with reduced motion
// (no models are downloaded), the stills stand in.
async function startDrive() {
  const hero = $('#collection-hero');
  const stills = () => { hero.classList.add('is-static'); hero.querySelectorAll('.fleet-fallback img[data-src]').forEach(img => { img.src = img.dataset.src; }); };
  if (reduced) { stills(); return; }
  try {
    const { createFleetDrive } = await import('./fleet-drive.js');
    const drive = createFleetDrive(hero, { onProgress: share => hero.style.setProperty('--loaded', share.toFixed(3)) });
    await drive.loaded;
    if (hero.classList.contains('is-static')) stills();
  } catch (error) {
    console.error('Collection drive unavailable; keeping the stills.', error);
    stills();
  }
}

async function init() {
  // The marques' module is fetched alongside the stock, not after it.
  const marques = import('./marques.js');
  const { cars, collections, settings, previews, deliveries } = await loadSite();
  renderContact();
  if (settings.collection.intro) $('[data-collection-intro]').textContent = settings.collection.intro;
  const sold = cars.filter(car => car.status === 'sold' && !car.preview).sort((a, b) => Date.parse(b.soldAt || b.updatedAt || 0) - Date.parse(a.soldAt || a.updatedAt || 0));
  // The grid shows the cars sold alongside the cars for sale (after them,
  // stamped Sold), unless Settings turns sold cars off.
  const pool = cars.filter(car => car.preview || FOR_SALE.includes(car.status) || (settings.listing.showSold && car.status === 'sold'));
  const newDays = settings.listing.newDays;

  // Collections: the curated ones, with "Just arrived" and "Arriving soon"
  // made from the stock itself. An empty one is never shown.
  const groups = [
    { slug: 'just-arrived', title: 'Just arrived', subtitle: 'New to the collection.', test: car => isNew(car, newDays) },
    ...collections.map(group => ({ ...group, test: car => car.collections.includes(group.slug) })),
    { slug: 'coming-soon', title: 'Arriving soon', subtitle: 'Register your interest before they land.', test: car => car.status === 'coming_soon' },
  ].map(group => ({ ...group, cars: pool.filter(group.test) })).filter(group => group.cars.length);
  const groupOf = Object.fromEntries(groups.map(group => [group.slug, group]));

  // ------------------------------------------------------------ state
  const state = { q: '', body: '', make: new Set(), price: '', fuel: new Set(), trans: new Set(), km: '', plate: '', year: 0, status: new Set(), collection: '', saved: false, sort: 'recommended', view: 'grid' };
  const SETS = ['make', 'fuel', 'trans', 'status'];
  const params = new URLSearchParams(location.search);
  state.q = params.get('q') || '';
  state.body = params.get('body') || '';
  for (const key of SETS) state[key] = new Set((params.get(key) || '').split(',').filter(Boolean));
  state.price = PRICE_BANDS.some(band => band.id === params.get('price')) ? params.get('price') : '';
  state.km = KM_BANDS.some(band => band.id === params.get('km')) ? params.get('km') : '';
  state.plate = ['fancy', 'vip'].includes(params.get('plate')) ? params.get('plate') : '';
  state.year = Number(params.get('year')) || 0;
  state.collection = groupOf[params.get('collection')] ? params.get('collection') : '';
  state.saved = params.get('saved') === '1';
  state.sort = params.get('sort') || 'recommended';
  state.view = params.get('view') === 'list' ? 'list' : 'grid';
  const writeURL = () => {
    const next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.body) next.set('body', state.body);
    for (const key of SETS) if (state[key].size) next.set(key, [...state[key]].join(','));
    for (const key of ['price', 'km', 'plate', 'collection']) if (state[key]) next.set(key, state[key]);
    if (state.year) next.set('year', state.year);
    if (state.saved) next.set('saved', '1');
    if (state.sort !== 'recommended') next.set('sort', state.sort);
    if (state.view !== 'grid') next.set('view', state.view);
    const query = next.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  };

  let saved = shortlist.all();
  const words = car => [car.make, car.model, car.variant, car.year, car.body, car.fuel, car.colour, car.location, car.registration, plateLabel(car, settings.listing)].join(' ').toLocaleLowerCase();
  const tests = {
    q: car => !state.q || state.q.toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word => words(car).includes(word)),
    body: car => !state.body || car.body === state.body,
    make: car => !state.make.size || state.make.has(car.make),
    price: car => !state.price || priceBand(car.price)?.id === state.price,
    fuel: car => !state.fuel.size || state.fuel.has(car.fuel),
    trans: car => !state.trans.size || state.trans.has(car.transmission),
    plate: car => !state.plate || car.plateTag === state.plate,
    km: car => { const band = KM_BANDS.find(entry => entry.id === state.km); return !band || (numeric(car.kilometres) && car.kilometres < band.max); },
    year: car => !state.year || (car.year ?? 0) >= state.year,
    status: car => !state.status.size || state.status.has(car.status),
    collection: car => !state.collection || groupOf[state.collection].test(car),
    saved: car => !state.saved || saved.has(car.slug),
  };
  const matches = (car, except) => Object.keys(tests).every(key => key === except || tests[key](car));
  const known = (a, b, dir) => { const x = numeric(a), y = numeric(b); return x && y ? (a - b) * dir : x ? -1 : y ? 1 : 0; };
  // Cars to wait for come after the ones to buy, unless asked otherwise.
  // For sale first, then arriving soon, then the cars sold, newest first.
  const standing = car => car.status === 'sold' ? 2 : car.status === 'coming_soon' ? 1 : 0;
  const SORTS = {
    recommended: (a, b) => standing(a) - standing(b) || (a.status === 'sold' && b.status === 'sold' ? Date.parse(b.soldAt || 0) - Date.parse(a.soldAt || 0) : recommended(a, b)),
    newest: (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0),
    'price-asc': (a, b) => known(a.price, b.price, 1),
    'price-desc': (a, b) => known(a.price, b.price, -1),
    year: (a, b) => known(a.year, b.year, -1),
    km: (a, b) => known(a.kilometres, b.kilometres, 1),
  };
  if (!SORTS[state.sort] || previews) state.sort = 'recommended';

  // ------------------------------------------- stock, beside the heading
  const forSaleCount = status => pool.filter(car => car.status === status).length;
  if (!previews) {
    const stats = [['Available now', forSaleCount('available') + forSaleCount('reserved')], ['Arriving soon', forSaleCount('coming_soon')], ...(settings.listing.showSold ? [['Delivered', sold.length]] : [])].filter(([, n], i) => i === 0 || n > 0);
    const list = $('[data-stats]');
    list.innerHTML = stats.map(([label, n]) => `<div><dt>${label}</dt><dd>${counter(n)}</dd></div>`).join('');
    list.hidden = false;
    rollCounters(list);
  }
  const makes = [...new Set(pool.map(car => car.make).filter(Boolean))].sort();

  // ---------------------------------------------- the marques we source
  // Their marks on paper (src/marques.js). One that is in stock filters the
  // collection to it; one that isn't asks us to find one.
  const { MARQUES } = await marques;
  const strip = $('[data-marques]');
  const marqueStock = marque => pool.filter(car => !car.preview && FOR_SALE.includes(car.status) && marque.makes.includes(car.make));
  const markup = (marque, copy) => {
    const n = marqueStock(marque).length;
    const art = marqueArt(marque);
    return `<li${copy ? ' class="is-copy" aria-hidden="true"' : ''}><button type="button" class="marque" data-marque="${escapeHTML(marque.name)}"${marque.scale ? ` data-scale="${marque.scale}"` : ''}${copy ? ' tabindex="-1"' : ''} aria-label="${escapeHTML(marque.name)}: ${n ? plural(n, 'car') : 'sourced on request'}">${art}</button></li>`;
  };
  strip.innerHTML = `<i class="marques-rule" aria-hidden="true"></i><i class="marques-rule marques-rule--bottom" aria-hidden="true"></i>
    <div class="marques-window"><ul class="marques-track">${MARQUES.map(marque => markup(marque, false)).join('')}${MARQUES.map(marque => markup(marque, true)).join('')}</ul><i class="marques-cursor" aria-hidden="true"></i></div>`;
  sizeMarques(strip, matchMedia('(max-width: 760px)').matches ? 30 : 42);
  strip.addEventListener('click', event => {
    const button = event.target.closest('[data-marque]');
    if (!button) return;
    const marque = MARQUES.find(entry => entry.name === button.dataset.marque);
    const cars = marqueStock(marque);
    // None in stock: the concierge sources one.
    if (!cars.length) { location.href = `/concierge/?marque=${encodeURIComponent(marque.name)}#brief`; return; }
    state.make = new Set(cars.map(car => car.make));
    apply();
    goBrowse();
  });
  strip.hidden = false;
  runMarques(strip);

  // ------------------------------------------------------ body tabs
  const order = body => { const i = BODIES.indexOf(body); return i < 0 ? 99 : i; };
  const bodies = [...new Set(pool.map(car => car.body).filter(Boolean))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  if (!bodies.includes(state.body)) state.body = '';
  const tabs = $('[data-body-tabs]');
  const indicator = tabs.querySelector('.tab-indicator');
  if (bodies.length > 1) {
    for (const body of ['', ...bodies]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.body = body;
      button.innerHTML = `<span>${escapeHTML(body ? bodyPlural(body) : 'All')}</span><span class="tab-count"></span>`;
      button.addEventListener('click', () => { state.body = body; apply(); button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth' }); });
      tabs.append(button);
    }
  } else tabs.hidden = true;
  const placeIndicator = () => {
    const active = tabs.querySelector('[aria-pressed=true]');
    if (!active) return;
    indicator.style.setProperty('--x', `${active.offsetLeft}px`);
    indicator.style.setProperty('--w', `${active.offsetWidth}px`);
  };
  addEventListener('resize', placeIndicator);
  document.fonts?.ready.then(placeIndicator);

  // --------------------------------------------------- filter panel
  const present = (values, key) => values.filter(value => pool.some(car => car[key] === value));
  const others = (key, known) => [...new Set(pool.map(car => car[key]).filter(value => value && !known.includes(value)))].sort();
  const fuels = [...present(FUELS, 'fuel'), ...others('fuel', FUELS)];
  const transmissions = [...new Set(pool.map(car => car.transmission).filter(Boolean))].sort();
  const years = [...new Set(pool.map(car => car.year).filter(numeric))].sort((a, b) => b - a);
  const statuses = [...FOR_SALE, 'sold'].filter(status => pool.some(car => car.status === status));
  const filterGroups = [
    { key: 'collection', label: 'Collection', single: true, cards: true, options: groups.map(group => [group.slug, group.title, group.subtitle]) },
    { key: 'make', label: 'Make', options: makes.map(make => [make, make]), count: (car, make) => car.make === make },
    { key: 'price', label: 'Budget', single: true, options: PRICE_BANDS.filter(band => pool.some(car => priceBand(car.price)?.id === band.id)).map(band => [band.id, band.label]), count: (car, id) => priceBand(car.price)?.id === id },
    { key: 'plate', label: 'Number plate', single: true, options: [['fancy', 'Fancy numbers'], ['vip', 'VIP numbers']].filter(([tag]) => pool.some(car => car.plateTag === tag)), count: (car, tag) => car.plateTag === tag },
    { key: 'km', label: settings.listing.drivenLabel || 'Driven', single: true, options: pool.filter(car => numeric(car.kilometres)).length > 1 ? KM_BANDS.map(band => [band.id, band.label]) : [], count: (car, id) => numeric(car.kilometres) && car.kilometres < KM_BANDS.find(band => band.id === id).max },
    { key: 'fuel', label: 'Fuel', options: fuels.map(fuel => [fuel, fuel]), count: (car, fuel) => car.fuel === fuel },
    { key: 'trans', label: 'Gearbox', options: transmissions.map(value => [value, value]), count: (car, value) => car.transmission === value },
    { key: 'status', label: 'Availability', options: statuses.map(status => [status, STATUS[status]]), count: (car, status) => car.status === status },
  ].filter(group => group.options.length > (group.cards || group.key === 'plate' ? 0 : 1));
  const panel = $('[data-filter-groups]');
  const chip = (group, value, label, note) => group.cards
    ? `<button type="button" class="chip chip--card" data-key="${group.key}" data-value="${escapeHTML(value)}"><b>${escapeHTML(label)}</b><small>${escapeHTML(note || '')}</small><small class="chip-count"></small></button>`
    : `<button type="button" class="chip" data-key="${group.key}" data-value="${escapeHTML(value)}">${escapeHTML(label)}<span class="chip-count"></span></button>`;
  panel.innerHTML = filterGroups.map(group => `<fieldset class="filter-group${group.cards ? ' filter-group--collections' : ''}"><legend>${group.label}${group.single ? '' : ' <span>Choose any</span>'}</legend><div class="chips">${group.single ? chip(group, '', group.cards ? 'Every car' : 'Any', group.cards ? 'The whole collection' : '') : ''}${group.options.map(([value, label, note]) => chip(group, value, label, note)).join('')}</div></fieldset>`).join('')
    + (years.length > 1 ? `<fieldset class="filter-group"><legend>Year</legend><label class="year-select"><span class="sr-only">Registered in or after</span><select data-year><option value="0">Any year</option>${years.map(year => `<option value="${year}">${year} or newer</option>`).join('')}</select></label></fieldset>` : '');
  panel.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip || chip.disabled) return;
    const { key, value } = chip.dataset;
    if (state[key] instanceof Set) { if (state[key].has(value)) state[key].delete(value); else state[key].add(value); }
    else state[key] = state[key] === value ? '' : value;
    apply();
  });
  panel.querySelector('[data-year]')?.addEventListener('change', event => { state.year = Number(event.target.value); apply(); });
  const dialog = $('#filters-dialog');
  const filterButton = $('[data-open-filters]');
  if (!filterGroups.length && years.length < 2) filterButton.hidden = true;
  filterButton.addEventListener('click', () => dialog.showModal());
  $('[data-apply-filters]').addEventListener('click', () => { dialog.close(); goBrowse(); });

  const clearAll = () => { Object.assign(state, { q: '', body: '', price: '', km: '', plate: '', year: 0, collection: '', saved: false }); SETS.forEach(key => state[key].clear()); search.value = ''; apply(); };
  $$('[data-clear-filters]').forEach(button => button.addEventListener('click', clearAll));

  // ------------------------------------------------ search, sort, view
  const search = $('[data-search]');
  search.value = state.q;
  let typing;
  search.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { state.q = search.value.trim(); apply(); }, 140); });
  search.addEventListener('keydown', event => { if (event.key === 'Enter') { search.blur(); goBrowse(); } });
  const sort = $('[data-sort]');
  if (previews) for (const option of sort.options) option.disabled = option.value !== 'recommended';
  sort.value = state.sort;
  sort.addEventListener('change', () => { state.sort = sort.value; apply(); });
  $$('[data-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.view; apply(); }));
  const savedToggle = $('[data-shortlist-toggle]');
  savedToggle.addEventListener('click', () => { state.saved = !state.saved; apply(); });
  document.addEventListener('shortlist:change', () => apply());

  // ----------------------------------------------------------- render
  const grid = $('[data-grid]');
  let shown = '';
  function apply() {
    saved = shortlist.all();
    const results = pool.filter(car => matches(car)).sort((a, b) => SORTS[state.sort](a, b) || SORTS.recommended(a, b));
    // Grid: rebuilt only when what it shows has changed.
    const key = `${state.view}|${results.map(car => car.slug).join(',')}`;
    if (key !== shown) {
      shown = key;
      const cards = results.map((car, index) => carCard(car, settings, { index, saving: true }));
      grid.replaceChildren(...cards);
      grid.classList.toggle('is-list', state.view === 'list');
      animateCards(cards);
      // The grid's height moves everything after it, the pinned ring too.
      requestAnimationFrame(() => ScrollTrigger.refresh());
    }
    grid.removeAttribute('aria-busy');
    const noun = previews ? (results.length === 1 ? 'showcase model' : 'showcase models') : (results.length === 1 ? 'car' : 'cars');
    const soldHere = results.filter(car => car.status === 'sold').length, onSale = results.length - soldHere;
    $('[data-result-count]').innerHTML = previews ? `<b>${results.length}</b> ${noun}<span> · previews, not current stock</span>`
      : soldHere ? `<b>${onSale}</b> for sale<span> · ${soldHere} sold</span>` : `<b>${results.length}</b> ${noun}`;
    const empty = $('[data-empty]');
    empty.hidden = results.length > 0;
    $('[data-empty-title]').textContent = state.saved && !saved.size ? 'Your shortlist is empty.' : 'A little more specific?';
    $('[data-empty-text]').textContent = state.saved && !saved.size ? 'Tap the heart on any car to keep it here, in this browser.' : 'No car matches all of those filters. Try fewer, or tell us what you have in mind and we’ll look for it.';

    // Tabs, with how many cars each would show.
    const base = pool.filter(car => matches(car, 'body'));
    tabs.querySelectorAll('[data-body]').forEach(button => {
      const n = button.dataset.body ? base.filter(car => car.body === button.dataset.body).length : base.length;
      button.querySelector('.tab-count').textContent = n;
      button.setAttribute('aria-pressed', String(button.dataset.body === state.body));
      button.disabled = n === 0 && button.dataset.body !== state.body;
    });
    placeIndicator();

    // Filter chips, with how many cars each would add.
    panel.querySelectorAll('.chip').forEach(chip => {
      const { key, value } = chip.dataset;
      const group = filterGroups.find(entry => entry.key === key);
      const on = state[key] instanceof Set ? state[key].has(value) : state[key] === value;
      chip.setAttribute('aria-pressed', String(on));
      if (!value || !group.count && key !== 'collection') return;
      const n = pool.filter(car => matches(car, key) && (key === 'collection' ? groupOf[value].test(car) : group.count(car, value))).length;
      chip.querySelector('.chip-count').textContent = chip.classList.contains('chip--card') ? plural(n, 'car') : n;
      chip.disabled = n === 0 && !on;
    });
    const year = panel.querySelector('[data-year]');
    if (year) year.value = String(state.year);
    const active = SETS.reduce((n, key) => n + state[key].size, 0) + ['price', 'km', 'plate', 'collection'].filter(key => state[key]).length + (state.year ? 1 : 0);
    const badge = $('[data-filter-count]');
    badge.hidden = !active;
    badge.textContent = active;
    $('[data-live-count]').textContent = plural(results.length, previews ? 'model' : 'car');

    // The filters in play, each one removable.
    const tokens = [];
    const token = (label, clear) => tokens.push({ label, clear });
    if (state.q) token(`“${state.q}”`, () => { state.q = ''; search.value = ''; });
    if (state.collection) token(groupOf[state.collection].title, () => { state.collection = ''; });
    if (state.body) token(bodyPlural(state.body), () => { state.body = ''; });
    state.make.forEach(make => token(make, () => state.make.delete(make)));
    if (state.price) token(PRICE_BANDS.find(band => band.id === state.price).label, () => { state.price = ''; });
    if (state.km) token(KM_BANDS.find(band => band.id === state.km).label, () => { state.km = ''; });
    if (state.plate) token(state.plate === 'vip' ? 'VIP numbers' : 'Fancy numbers', () => { state.plate = ''; });
    if (state.year) token(`${state.year} or newer`, () => { state.year = 0; });
    state.fuel.forEach(fuel => token(fuel, () => state.fuel.delete(fuel)));
    state.trans.forEach(value => token(value, () => state.trans.delete(value)));
    state.status.forEach(status => token(STATUS[status], () => state.status.delete(status)));
    const holder = $('[data-tokens]');
    holder.replaceChildren(...tokens.map(({ label, clear }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'token';
      button.innerHTML = `${escapeHTML(label)}<span aria-hidden="true">×</span>`;
      button.setAttribute('aria-label', `Remove filter: ${label}`);
      button.addEventListener('click', () => { clear(); apply(); });
      return button;
    }));
    if (tokens.length > 1) {
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'token token--clear';
      all.textContent = 'Clear all';
      all.addEventListener('click', clearAll);
      holder.append(all);
    }

    // Heading, shortlist and layout controls.
    $('[data-browse-title]').textContent = state.saved ? 'Your shortlist.' : state.collection ? `${groupOf[state.collection].title}.` : state.body ? `${bodyPlural(state.body)}.` : previews ? 'Showcase models.' : 'All cars.';
    const savedHere = pool.filter(car => saved.has(car.slug)).length;
    savedToggle.querySelector('[data-shortlist-count]').textContent = savedHere;
    savedToggle.setAttribute('aria-pressed', String(state.saved));
    savedToggle.hidden = !savedHere && !state.saved;
    $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    sort.value = state.sort;
    writeURL();
  }
  apply();

  // ----------------------------------------------- recently delivered
  // The cars handed over, and their handover photographs, on a ring. Off
  // for now (SHOW_DELIVERED): the section stays hidden until it is turned
  // back on.
  const shownSold = settings.listing.showSold ? sold : [];
  if (SHOW_DELIVERED && (shownSold.length || deliveries.length)) {
    $('[data-sold]').hidden = false;
    const { createDelivered } = await import('./delivered.js');
    createDelivered($('[data-sold]'), { sold: shownSold.slice(0, 18), deliveries, reduced });
  }

  // The bar sticks under the header; it is marked once it does.
  const bar = $('[data-browse-bar]');
  const sentinel = document.createElement('div');
  sentinel.className = 'browse-sentinel';
  bar.before(sentinel);
  new IntersectionObserver(([entry]) => bar.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < innerHeight / 2), { rootMargin: `-${document.querySelector('.site-header').offsetHeight + 1}px 0px 0px 0px` }).observe(sentinel);
  if (location.hash === '#browse' && [...params].length) requestAnimationFrame(goBrowse);
}

// Counter (React Bits): each digit rolls to its place as it comes into view.
function counter(n) {
  return `<span class="counter" aria-label="${n}">${String(n).split('').map(d => `<span class="digit" style="--d:${d}" aria-hidden="true"><span class="digit-strip">${'0123456789'.split('').map(x => `<span>${x}</span>`).join('')}</span></span>`).join('')}</span>`;
}
function rollCounters(root) {
  if (reduced) { root.classList.add('is-rolled'); return; }
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    requestAnimationFrame(() => root.classList.add('is-rolled'));
  }).observe(root);
}

// ----------------------------------------------------------------- motion
// The stage's words arrive on CSS keyframes (fleet.css), off the main thread,
// so the cars loading beside them can never make them stutter. The later
// section heads rise as they come into view.
function introCopy() {
  document.querySelectorAll('[data-magnetic]').forEach(magnetic);
  promises();
  if (reduced) return;
  gsap.utils.toArray('.c-section-head, .c-source > *').forEach(element => {
    gsap.fromTo(element, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
  });
}
// The promises, as the band comes into view: its hairline draws across and
// the dividers down; in each column the index rolls to its number, the
// promise rises out of its line word by word, and the note follows. Under a
// fine pointer a soft light follows the pointer within its column.
function promises() {
  const band = document.querySelector('.c-promises');
  if (!band) return;
  const items = [...band.querySelectorAll('.c-promise')];
  if (finePointer) items.forEach(item => item.addEventListener('pointermove', event => {
    const box = item.getBoundingClientRect();
    item.style.setProperty('--x', `${(event.clientX - box.left).toFixed(0)}px`);
    item.style.setProperty('--y', `${(event.clientY - box.top).toFixed(0)}px`);
  }));
  if (reduced) return;
  const media = gsap.matchMedia();
  media.add({ wide: '(min-width: 900px)', narrow: '(max-width: 899px)' }, ({ conditions }) => {
    const words = items.map(item => SplitText.create(item.querySelector('.c-promise-title'), { type: 'words', mask: 'words' }).words);
    const timeline = gsap.timeline({ defaults: { ease: 'expo.out' }, scrollTrigger: { trigger: band, start: 'top 86%', once: true } })
      .fromTo(band, { '--rule': 0 }, { '--rule': 1, duration: 1.6, ease: 'expo.inOut' }, 0);
    if (conditions.wide) timeline.fromTo(band.querySelectorAll('.c-promise-rule'), { scaleY: 0 }, { scaleY: 1, duration: 1.3, ease: 'expo.inOut', stagger: .1 }, .35);
    items.forEach((item, i) => {
      const at = .3 + i * .12, drum = item.querySelector('.c-promise-drum');
      // From the first row to its number on the second turn of the drum (y
      // zeroed: GSAP would otherwise read the CSS resting place as a y offset).
      timeline.fromTo(drum, { y: 0, yPercent: 0 }, { y: 0, yPercent: -5 * parseFloat(drum.style.getPropertyValue('--to')), duration: 1.6, ease: 'expo.inOut' }, at)
        .fromTo(words[i], { yPercent: 105 }, { yPercent: 0, duration: 1.3, stagger: .045 }, at + .2)
        .fromTo(item.querySelector('.c-promise-note'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 1.1, clearProps: 'transform' }, at + .45);
    });
    return () => timeline.scrollTrigger?.kill();
  });
}
// The strip drifts slowly, a touch faster while the page is scrolled and the
// way it moves (after React Bits' ScrollVelocity, much calmer). Under the
// pointer it comes to rest: the other marks fall back and a gold hairline
// slides beneath the one pointed at. It draws itself in the first time it is
// seen.
function runMarques(strip) {
  const track = strip.querySelector('.marques-track');
  const window_ = strip.querySelector('.marques-window');
  const cursor = strip.querySelector('.marques-cursor');
  if (reduced) return;
  gsap.set(strip.querySelectorAll('.marques-rule'), { scaleX: 0 });
  gsap.set(track.querySelectorAll('.marque'), { autoAlpha: 0, y: 14 });
  ScrollTrigger.create({
    trigger: strip, start: 'top 88%', once: true,
    onEnter: () => gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(strip.querySelectorAll('.marques-rule'), { scaleX: 1, duration: 1.6, ease: 'expo.inOut' }, 0)
      .to(track.querySelectorAll('.marque'), { autoAlpha: .6, y: 0, duration: 1.4, stagger: { each: .045, from: 'center' }, clearProps: 'all' }, .35),
  });

  const loop = gsap.to(track, { xPercent: -50, duration: track.children.length * 2.1, ease: 'none', repeat: -1 });
  let direction = 1, settle, resting = false;
  ScrollTrigger.create({
    trigger: strip, start: 'top bottom', end: 'bottom top',
    onToggle: self => self.isActive ? loop.resume() : loop.pause(),
    onUpdate(self) {
      if (resting) return;
      direction = self.direction;
      const speed = 1 + Math.min(2.2, Math.abs(self.getVelocity()) / 900);
      gsap.to(loop, { timeScale: direction * speed, duration: .4, overwrite: true });
      settle?.kill();
      settle = gsap.delayedCall(.3, () => gsap.to(loop, { timeScale: direction, duration: 1.8, ease: 'power3.out', overwrite: true }));
    },
  });

  const point = button => {
    strip.classList.add('is-pointing');
    track.querySelectorAll('.marque.is-on').forEach(other => other.classList.remove('is-on'));
    button.classList.add('is-on');
    const box = button.getBoundingClientRect(), frame = window_.getBoundingClientRect();
    gsap.to(cursor, { x: box.left - frame.left, width: box.width, autoAlpha: 1, duration: .55, ease: 'expo.out' });
  };
  const rest = () => {
    resting = false;
    strip.classList.remove('is-pointing');
    track.querySelectorAll('.marque.is-on').forEach(other => other.classList.remove('is-on'));
    gsap.to(cursor, { autoAlpha: 0, duration: .4 });
    gsap.to(loop, { timeScale: direction, duration: 1.2, ease: 'power2.inOut', overwrite: true });
  };
  if (finePointer) {
    window_.addEventListener('pointerenter', () => { resting = true; settle?.kill(); gsap.to(loop, { timeScale: 0, duration: .8, ease: 'power3.out', overwrite: true }); });
    window_.addEventListener('pointerleave', rest);
    track.addEventListener('pointerover', event => { const button = event.target.closest('.marque'); if (button) point(button); });
  }
  track.addEventListener('focusin', event => { const button = event.target.closest('.marque'); if (!button) return; resting = true; gsap.to(loop, { timeScale: 0, duration: .3, overwrite: true }); point(button); });
  track.addEventListener('focusout', event => { if (!track.contains(event.relatedTarget)) rest(); });
}
// Cards are unveiled a row at a time as they come into view: the tile wipes
// open from the top while the car settles into it. The wipe starts at speed
// and settles (expo.out): an ease-in-out wipe left the tile empty for its
// first half second, so the cars seemed to arrive late.
let batches = [];
function animateCards(cards) {
  batches.forEach(trigger => trigger.kill());
  batches = [];
  if (reduced || !cards.length) return;
  gsap.set(cards, { autoAlpha: 0, y: 28 });
  batches = ScrollTrigger.batch(cards, {
    start: 'top 96%', once: true, interval: .05,
    onEnter: batch => {
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .06, overwrite: 'auto', clearProps: 'transform,opacity,visibility' });
      batch.forEach((card, i) => {
        const visual = card.querySelector('.vehicle-visual'), image = visual.querySelector('img');
        gsap.fromTo(visual, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.out', delay: i * .06, clearProps: 'clipPath' });
        gsap.fromTo(image, { scale: 1.1 }, { scale: 1, duration: 1.5, ease: 'expo.out', delay: i * .06, clearProps: 'transform' });
      });
    },
  });
}
// Buttons lean towards a fine pointer.
function magnetic(element) {
  if (!finePointer || reduced) return;
  const x = gsap.quickTo(element, 'x', { duration: .6, ease: 'power3.out' }), y = gsap.quickTo(element, 'y', { duration: .6, ease: 'power3.out' });
  element.addEventListener('pointermove', event => { const r = element.getBoundingClientRect(); x((event.clientX - r.left - r.width / 2) * .22); y((event.clientY - r.top - r.height / 2) * .32); });
  element.addEventListener('pointerleave', () => { x(0); y(0); });
}
