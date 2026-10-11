// A car's own page (/car/?id=…): its photographs, price and facts, how to
// arrange a viewing, its specification and inspection, and similar cars.
import gsap from 'gsap';
import { setupPage } from './chrome.js';
import { saveEnquiry } from './forms.js';
import { dealer } from './config.js';
import { loadSite, live, FOR_SALE, badge, carName, carTitle, carURL, formatDriven, drivenText, formatOwners, formatPriceFull, priceBand, plateLabel, insuranceState, insuranceText, conciergeGroups, cover } from './data.js';
import { carCard, shortlistButton, priceLabel, framePhoto, attachImageFallback } from './cards.js';
import { escapeHTML, safeImage, thumbImage, safeURL, numeric, present } from './util.js';

const { renderContact, openEnquiry } = setupPage('collection');
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

init().catch(error => { console.error(error); missing(); });

function missing() {
  $('#car').hidden = true;
  $('[data-missing]').hidden = false;
  document.title = 'Car not found — Baba Luxury Cars';
}

async function init() {
  const { cars, settings, collections } = await loadSite();
  renderContact();
  const id = new URLSearchParams(location.search).get('id') || '';
  const car = cars.find(entry => entry.slug === id || entry.id === id);
  if (!car) { missing(); return; }
  const title = carTitle(car);
  const page = $('#car');
  document.title = `${title} — ${dealer.name === 'BABA' ? 'Baba' : dealer.name} ${dealer.descriptor}`;
  const listing = settings.listing;
  const sold = car.status === 'sold';
  const description = car.preview ? `The ${title}, a showcase model at Baba Luxury Cars. Enquire about current availability.` : sold ? `The ${title}, now with its new owner. Baba Luxury Cars can find you one like it.` : [title, car.year, drivenText(car.kilometres, listing), car.fuel, priceLabel(car)].filter(present).join(' · ');
  document.querySelector('meta[name=description]').content = description;

  // Breadcrumb: the collection, then the car's body or first collection.
  const group = collections.find(entry => car.collections.includes(entry.slug));
  const crumb = $('[data-crumb-group]');
  if (car.body) { crumb.href = `/collection/?body=${encodeURIComponent(car.body)}#browse`; crumb.textContent = /s$/.test(car.body) ? car.body : `${car.body}s`; crumb.hidden = false; }
  else if (group) { crumb.href = `/collection/?collection=${group.slug}#browse`; crumb.textContent = group.title; crumb.hidden = false; }
  $('[data-crumb-name]').textContent = carName(car);

  // ---------------------------------------------------------- gallery
  const photos = car.photos.length ? car.photos : ['/vehicle-placeholder.svg'];
  const stage = $('[data-stage]');
  const kind = car.preview ? 'cutout' : 'full';
  stage.innerHTML = photos.map((src, i) => `<figure class="v-slide vehicle-visual" data-photo="${kind}" aria-roledescription="slide" aria-label="${i + 1} of ${photos.length}"><img src="${escapeHTML(safeImage(src) || '/vehicle-placeholder.svg')}" alt="${i ? '' : escapeHTML(title)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" /></figure>`).join('');
  attachImageFallback(stage);
  stage.querySelectorAll('img').forEach(framePhoto);
  const tag = badge(car, settings);
  if (tag) { const element = $('[data-badge]'); element.dataset.tone = tag.tone; element.textContent = tag.label; element.hidden = false; }
  const counter = $('[data-counter]'), progress = $('[data-progress]');
  const thumbs = $('[data-thumbs]');
  let current = 0;
  const show = (index, smooth = true) => {
    current = (index + photos.length) % photos.length;
    stage.scrollTo({ left: stage.children[current].offsetLeft, behavior: smooth && !reduced ? 'smooth' : 'instant' });
    sync();
  };
  const sync = () => {
    counter.lastChild.textContent = `${current + 1} / ${photos.length}`;
    progress.style.setProperty('--at', ((current + 1) / photos.length).toFixed(4));
    thumbs.querySelectorAll('button').forEach((button, i) => { button.setAttribute('aria-current', String(i === current)); if (i === current) button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth' }); });
  };
  if (photos.length > 1) {
    thumbs.innerHTML = photos.map((src, i) => `<button type="button" data-photo="${kind}" aria-label="Photograph ${i + 1}"><img src="${escapeHTML(thumbImage(src) || '/vehicle-placeholder.svg')}" data-full="${escapeHTML(safeImage(src) || '')}" alt="" loading="lazy" /></button>`).join('');
    attachImageFallback(thumbs);
    thumbs.querySelectorAll('img').forEach(framePhoto);
    thumbs.addEventListener('click', event => { const button = event.target.closest('button'); if (button) show([...thumbs.children].indexOf(button)); });
    thumbs.hidden = counter.hidden = false;
    $('[data-prev]').hidden = $('[data-next]').hidden = false;
    $('[data-prev]').addEventListener('click', () => show(current - 1));
    $('[data-next]').addEventListener('click', () => show(current + 1));
    stage.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') show(current - 1); if (event.key === 'ArrowRight') show(current + 1); });
    let settle;
    stage.addEventListener('scroll', () => { clearTimeout(settle); settle = setTimeout(() => { const index = Math.round(stage.scrollLeft / stage.clientWidth); if (index !== current) { current = index; sync(); } }, 90); }, { passive: true });
    sync();
  }
  // The lightbox: each photograph at full size.
  const lightbox = $('#photo-dialog');
  const lightImage = $('[data-lightbox-image]');
  const openLight = index => {
    current = (index + photos.length) % photos.length;
    lightImage.src = safeImage(photos[current]) || '/vehicle-placeholder.svg';
    lightImage.alt = `${title}, photograph ${current + 1} of ${photos.length}`;
    $('[data-lightbox-caption]').textContent = `${title} · ${current + 1} / ${photos.length}`;
    if (!lightbox.open) lightbox.showModal();
  };
  lightbox.classList.toggle('is-single', photos.length < 2);
  $('[data-lightbox-prev]').addEventListener('click', () => openLight(current - 1));
  $('[data-lightbox-next]').addEventListener('click', () => openLight(current + 1));
  lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') openLight(current - 1); if (event.key === 'ArrowRight') openLight(current + 1); });
  lightbox.addEventListener('close', () => show(current, false));
  if (!car.preview) stage.addEventListener('click', event => { if (event.target.closest('.v-slide')) openLight(current); });
  else stage.classList.add('is-static');
  counter.addEventListener('click', () => openLight(current));

  // ------------------------------------------------------------ panel
  $('[data-make]').textContent = car.make;
  $('[data-name]').textContent = car.model;
  if (car.variant) { $('[data-variant]').textContent = car.variant; $('[data-variant-line]').hidden = false; }
  // Where the car stands, beside the make: a live dot while it is for sale.
  const standing = car.preview ? ['preview', 'Showcase model'] : { available: ['available', 'Available now'], reserved: ['reserved', 'Reserved'], coming_soon: ['coming_soon', 'Coming soon'], sold: ['sold', 'Sold'] }[car.status];
  if (standing) { const pill = $('[data-status]'); pill.dataset.tone = standing[0]; pill.lastChild.textContent = standing[1]; pill.hidden = false; }
  // The dealership's highlights, as chips under the name.
  if (car.highlights.length && !sold) { $('[data-chips]').innerHTML = car.highlights.slice(0, 6).map(item => `<li>${escapeHTML(item)}</li>`).join(''); $('[data-chips]').hidden = false; }
  const plate = sold ? '' : plateLabel(car, listing);
  if (plate) { const chip = $('[data-plate]'); chip.dataset.tone = car.plateTag; chip.lastChild.textContent = plate; chip.hidden = false; }
  const price = $('[data-price]');
  if (car.status === 'sold') price.textContent = 'Sold';
  else if (car.preview) price.textContent = 'Price on enquiry';
  else if (numeric(car.price)) {
    // "₹48 lakh": the figure large, the rupee sign in gold; the full amount beneath.
    const [, figure = '', unit = ''] = /^₹\s?([\d.,]+)\s*(.*)$/.exec(priceLabel(car)) || [];
    price.innerHTML = figure ? `<span class="v-price-main"><i>₹</i><b data-figure="${escapeHTML(figure)}">${escapeHTML(figure)}</b>${unit ? `<small>${escapeHTML(unit)}</small>` : ''}</span><span class="v-price-full">${escapeHTML(formatPriceFull(car.price))}</span>` : escapeHTML(priceLabel(car));
  }
  else price.textContent = 'Price on request';
  price.classList.toggle('is-quiet', !numeric(car.price) || car.status === 'sold');
  if (car.note) { $('[data-note]').textContent = car.note; $('[data-note]').hidden = false; }
  // The dealership's rules: "Driven 75,000" (never km), the registration by
  // its first characters, insurance as Valid or Expired. A sold car keeps
  // only the basics.
  const insurance = listing.showInsurance === false ? '' : insuranceText(insuranceState(car));
  const all = {
    year: ['Year', car.year], driven: [listing.drivenLabel || 'Driven', formatDriven(car.kilometres)], owners: ['Ownership', formatOwners(car.owners)], fuel: ['Fuel', car.fuel],
    transmission: ['Gearbox', car.transmission], body: ['Body', car.body], colour: ['Colour', car.colour], registration: ['Registration', car.registration], insurance: ['Insurance', insurance], location: ['Location', car.location],
  };
  // The four a buyer compares first, large; the rest in the details below.
  const keys = sold ? listing.soldFacts || ['year', 'fuel', 'body'] : ['year', 'driven', 'fuel', 'owners'];
  const pairs = list => list.map(key => all[key]).filter(pair => pair && present(pair[1]));
  const key = pairs(keys), rest = sold ? [] : pairs(Object.keys(all).filter(name => !keys.includes(name)));
  $('[data-key]').innerHTML = key.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
  $('[data-facts]').innerHTML = rest.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
  $('[data-more]').hidden = !rest.length;
  $('[data-preview-note]').hidden = !car.preview;

  // How to take the next step depends on where the car stands.
  const next = car.preview ? ['Enquire about availability', `${carName(car)} — availability enquiry`]
    : car.status === 'sold' ? ['Find me one like this', `Find me a car like the ${title}`]
    : car.status === 'coming_soon' ? ['Register your interest', `${title} — register interest (${car.slug})`]
    : car.status === 'reserved' ? ['Join the waiting list', `${title} — reserved; please contact me if it becomes available (${car.slug})`]
    : ['Arrange a viewing', `${title} — viewing (${car.slug})`];
  const enquire = $('[data-enquire-car]');
  enquire.firstChild.textContent = next[0];
  enquire.addEventListener('click', () => openEnquiry(next[1]));
  const digits = dealer.whatsapp.replace(/\D/g, '');
  if (digits) { const link = $('[data-whatsapp]'); link.href = `https://wa.me/${digits}?text=${encodeURIComponent(`Hello Baba Luxury Cars, I’m interested in the ${title}: ${location.href}`)}`; link.hidden = false; }
  if (dealer.phone) { const link = $('[data-call]'); link.href = `tel:${dealer.phone.replace(/[^+\d]/g, '')}`; $('[data-call-number]').textContent = dealer.phone; link.hidden = false; }
  $('[data-save]').replaceWith(shortlistButton(car, 'shortlist-button v-tool v-save'));
  const share = $('[data-share]');
  share.addEventListener('click', async () => {
    const data = { title, text: `The ${title} at Baba Luxury Cars`, url: location.href };
    const say = text => { share.setAttribute('aria-label', text); share.dataset.said = text; setTimeout(() => { share.setAttribute('aria-label', 'Share this car'); delete share.dataset.said; }, 2600); };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(location.href);
      say('Link copied');
    } catch (error) { if (error?.name !== 'AbortError') say('Copy the address above to share'); }
  });

  // ---------------------------------------------------------- details
  if (sold) $('[data-sold-note]').hidden = false;
  // More highlights than the panel shows are listed in the details.
  if (car.highlights.length > 6 && !sold) {
    $('[data-highlights] ul').innerHTML = car.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join('');
    $('[data-highlights]').hidden = false;
  }
  if (car.description && !sold) {
    $('[data-overview] .v-description').replaceChildren(...car.description.split(/\n{2,}/).map(text => Object.assign(document.createElement('p'), { textContent: text.trim() })));
    $('[data-overview]').hidden = false;
  }
  if (car.specs.length && !sold) {
    $('[data-specs] dl').innerHTML = car.specs.map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
    $('[data-specs-source]').hidden = !car.preview;
    $('[data-specs]').hidden = false;
  }
  const checks = car.inspection || {};
  const summary = [];
  if (checks.verifiedKm && numeric(car.kilometres)) summary.push('Mileage records verified');
  if (checks.accidentFree === true) summary.push('Non-accidental condition verified');
  if (checks.mechanical === true) summary.push('Mechanical inspection recorded');
  if (checks.body === true) summary.push('Body condition inspection recorded');
  if (checks.interior === true) summary.push('Interior inspection recorded');
  if (checks.serviceHistory === true) summary.push('Service history reviewed');
  if (checks.ownership === true) summary.push('Ownership verified');
  if (numeric(checks.tyrePercent) && checks.tyrePercent <= 100) summary.push(`Tyre condition: ${checks.tyrePercent}%`);
  if (checks.checkedAt) summary.push(`Recorded ${checks.checkedAt}`);
  const report = safeURL(checks.reportUrl);
  if (summary.length && !sold) {
    $('[data-inspection] ul').innerHTML = summary.map(item => `<li>${escapeHTML(item)}</li>`).join('') + (report ? `<li class="v-report"><a class="text-link" href="${escapeHTML(report)}" target="_blank" rel="noopener">View the inspection report ↗</a></li>` : '');
    $('[data-inspection]').hidden = false;
  }

  // ----------------------------------------------------------- concierge
  if (!sold) concierge(car, title, settings.concierge);

  // ----------------------------------------------------------- similar
  const band = priceBand(car.price)?.id;
  const score = other => (other.body && other.body === car.body ? 3 : 0) + (other.make === car.make ? 2 : 0) + (band && priceBand(other.price)?.id === band ? 2 : 0) + car.collections.filter(slug => other.collections.includes(slug)).length;
  const similar = cars.filter(other => other !== car && (other.preview || FOR_SALE.includes(other.status))).map(other => [score(other), other]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, other]) => other);
  if (similar.length) {
    $('[data-similar-grid]').replaceChildren(...similar.map((other, index) => carCard(other, settings, { index, saving: true })));
    $('[data-similar]').hidden = false;
  }

  // ------------------------------------------------- phone enquiry dock
  const dock = $('[data-dock]');
  $('[data-dock-name]').textContent = carName(car);
  $('[data-dock-price]').textContent = numeric(car.price) && !sold && !car.preview ? priceLabel(car) : price.textContent;
  $('[data-dock-enquire]').textContent = car.status === 'available' && !car.preview ? 'Enquire' : next[0].split(' ').slice(0, 2).join(' ');
  $('[data-dock-enquire]').addEventListener('click', () => openEnquiry(next[1]));
  dock.hidden = false;
  new IntersectionObserver(([entry]) => dock.classList.toggle('is-shown', !entry.isIntersecting && entry.boundingClientRect.top < 0)).observe($('[data-actions]'));

  // ------------------------------------------- structured data for search
  if (!car.preview) {
    const availability = { available: 'InStock', reserved: 'LimitedAvailability', coming_soon: 'PreOrder', sold: 'SoldOut' }[car.status];
    const data = {
      '@context': 'https://schema.org', '@type': 'Car', name: title, url: location.href,
      brand: { '@type': 'Brand', name: car.make }, model: car.model, bodyType: car.body || undefined,
      vehicleModelDate: car.year ? String(car.year) : undefined, color: car.colour || undefined,
      fuelType: car.fuel || undefined, vehicleTransmission: car.transmission || undefined,
      mileageFromOdometer: numeric(car.kilometres) && !sold ? { '@type': 'QuantitativeValue', value: car.kilometres, unitCode: 'KMT' } : undefined,
      image: car.photos.map(src => safeURL(src)).filter(Boolean),
      offers: { '@type': 'Offer', priceCurrency: 'INR', price: numeric(car.price) && !sold ? car.price : undefined, availability: availability ? `https://schema.org/${availability}` : undefined, itemCondition: 'https://schema.org/UsedCondition', seller: { '@type': 'AutoDealer', name: 'Baba Luxury Cars' } },
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.append(script);
  }
  page.removeAttribute('aria-busy');
  page.classList.add('is-ready');
  page.classList.toggle('is-sold', car.status === 'sold');
  arrive(page);
}

// The page arrives as one moment: the photograph opens upward and settles,
// the thumbnails follow; beside it the name rises out of its lines, the
// highlights come in, the price counts up to its figure, the four facts and
// the next step follow, and a light runs once across the button. Reduced
// motion shows the page set.
function arrive(page) {
  if (reduced) return;
  const q = selector => page.querySelectorAll(selector);
  const figure = page.querySelector('.v-price-main b');
  const target = figure ? parseFloat(figure.dataset.figure.replace(/,/g, '')) : NaN;
  const places = figure ? (figure.dataset.figure.split('.')[1] || '').length : 0;
  const count = { value: 0 };
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo('.v-stage-wrap', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
    .fromTo('.v-slide:first-child img', { scale: 1.14 }, { scale: 1, duration: 2, clearProps: 'transform' }, .15)
    .from(q('.v-thumbs button, .v-progress'), { autoAlpha: 0, y: 14, duration: .9, stagger: .035, clearProps: 'all' }, .7)
    .from(q('.v-panel-top > *'), { autoAlpha: 0, y: 10, duration: .9, stagger: .08, clearProps: 'all' }, .25)
    .from(q('#car-title .v-line > *'), { yPercent: 110, duration: 1.3, stagger: .1, clearProps: 'transform' }, .3)
    .from(q('.v-panel > .plate-chip, .v-chips li'), { autoAlpha: 0, y: 12, scale: .94, duration: .8, stagger: .045, clearProps: 'all' }, .6)
    .from(q('.v-price-row'), { autoAlpha: 0, y: 16, duration: 1, clearProps: 'all' }, .7)
    .from(q('.v-key > div'), { autoAlpha: 0, y: 18, duration: 1, stagger: .07, clearProps: 'all' }, .85)
    .from(q('.v-actions > *, .v-trust li'), { autoAlpha: 0, y: 18, duration: 1, stagger: .07, clearProps: 'all' }, 1)
    .fromTo('.v-cta', { '--sheen': '-60%' }, { '--sheen': '160%', duration: 1.4, ease: 'power2.inOut' }, 1.9);
  if (Number.isFinite(target)) {
    tl.fromTo(count, { value: 0 }, { value: target, duration: 1.8, ease: 'power3.out', onUpdate: () => {
      figure.textContent = count.value.toLocaleString('en-IN', { minimumFractionDigits: places, maximumFractionDigits: places });
    }, onComplete: () => { figure.textContent = figure.dataset.figure; } }, .75);
  }
}

// Baba Concierge: whatever a buyer would like done to the car (a wrap, new
// wheels, a lift kit, the paperwork), chosen from the dealership's list or
// written in, gathered on a build sheet and sent on WhatsApp or as a call-back
// request (the admin's inbox). Each choice flies from the menu to the sheet.
function concierge(car, title, settings) {
  const groups = conciergeGroups(settings.services, car.body);
  const section = $('[data-concierge]');
  const digits = String(settings.whatsapp || '').replace(/\D/g, '');
  if (!groups.length && !digits) return;
  const chosen = [];
  const list = $('[data-sheet-list]'), note = $('[data-sheet-note]'), result = $('[data-sheet-result]');
  $('[data-concierge-intro]').textContent = settings.intro || '';
  $('[data-sheet-car]').textContent = title;
  const photo = $('[data-sheet-photo]');
  photo.src = safeImage(cover(car)) || '/vehicle-placeholder.svg';
  photo.closest('.v-sheet-photo').dataset.photo = car.preview ? 'cutout' : 'full';
  $('[data-concierge-menu]').innerHTML = groups.map((group, g) => `<fieldset class="v-menu-group"><legend><span>${String(g + 1).padStart(2, '0')}</span>${escapeHTML(group.title)}</legend><div class="v-menu-items">${group.items.map(item => `<button type="button" class="v-chip" aria-pressed="false" data-item="${escapeHTML(item)}"><span>${escapeHTML(item)}</span><i aria-hidden="true"><svg class="v-chip-add" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg><svg class="v-chip-on" viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></i></button>`).join('')}</div></fieldset>`).join('');

  const message = () => [
    `Hello Baba Luxury Cars concierge, I’m looking at the ${title}${car.preview ? '' : ` (${location.href})`}.`,
    chosen.length ? `I’d like:\n${chosen.map(item => `• ${item}`).join('\n')}` : 'I’d like to talk about changes to it.',
    note.value.trim() ? `Also: ${note.value.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  let shown = 0;
  const sync = () => {
    const count = $('[data-sheet-count]');
    count.textContent = chosen.length;
    count.classList.toggle('is-on', chosen.length > 0);
    // The count gives a small jump each time it changes.
    if (chosen.length !== shown && !reduced) gsap.fromTo(count, { scale: 1.45 }, { scale: 1, duration: .7, ease: 'elastic.out(1, .4)' });
    shown = chosen.length;
    $('[data-sheet-whatsapp-label]').textContent = chosen.length ? `Send my build sheet (${chosen.length}) on WhatsApp` : 'WhatsApp the concierge';
    $('[data-sheet-empty]').hidden = chosen.length > 0;
    const link = $('[data-sheet-whatsapp]');
    link.hidden = !digits;
    if (digits) link.href = `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(message())}`;
  };
  // A choice is lifted from the menu and set down on the sheet.
  const fly = (from, to) => {
    if (reduced || !from || !to) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!b.width) return;
    const ghost = Object.assign(document.createElement('span'), { className: 'v-chip-ghost', textContent: from.dataset.item });
    Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.append(ghost);
    gsap.set(to, { autoAlpha: 0 });
    gsap.timeline({ onComplete: () => ghost.remove() })
      .to(ghost, { x: b.left - a.left, y: b.top - a.top, width: b.width, height: b.height, duration: .75, ease: 'expo.inOut' })
      .to(ghost, { autoAlpha: 0, duration: .25 }, '-=.15')
      .to(to, { autoAlpha: 1, duration: .3 }, '<');
  };
  const add = (item, chip) => {
    chosen.push(item);
    const row = document.createElement('li');
    row.dataset.item = item;
    row.innerHTML = `<span>${escapeHTML(item)}</span><button type="button" aria-label="Remove ${escapeHTML(item)}">×</button>`;
    list.append(row);
    sync();
    if (!reduced) gsap.from(row, { height: 0, paddingTop: 0, paddingBottom: 0, duration: .5, ease: 'expo.out', clearProps: 'all' });
    fly(chip, row.querySelector('span'));
  };
  const remove = item => {
    chosen.splice(chosen.indexOf(item), 1);
    const row = [...list.children].find(entry => entry.dataset.item === item);
    const chip = [...section.querySelectorAll('.v-chip')].find(entry => entry.dataset.item === item);
    chip?.setAttribute('aria-pressed', 'false');
    sync();
    if (!row) return;
    if (reduced) row.remove();
    else gsap.to(row, { height: 0, autoAlpha: 0, x: 16, paddingTop: 0, paddingBottom: 0, duration: .45, ease: 'expo.inOut', onComplete: () => row.remove() });
  };
  section.addEventListener('click', event => {
    const chip = event.target.closest('.v-chip');
    if (chip) {
      const on = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(on));
      if (on) add(chip.dataset.item, chip); else remove(chip.dataset.item);
      return;
    }
    const drop = event.target.closest('.v-sheet-list button');
    if (drop) remove(drop.closest('li').dataset.item);
  });
  note.addEventListener('input', sync);

  // A call back, through the admin's inbox, where it is connected.
  if (live) {
    $('[data-sheet-contact]').hidden = false;
    const send = $('[data-sheet-send]');
    send.hidden = false;
    send.addEventListener('click', async () => {
      const name = $('[data-sheet-name]'), phone = $('[data-sheet-phone]');
      result.hidden = false;
      if (!name.value.trim()) { result.textContent = 'Add your name, and we’ll call you about this.'; name.focus(); return; }
      if (!/^[+0-9 ()-]{7,22}$/.test(phone.value.trim())) { result.textContent = 'Add a phone number we can call.'; phone.focus(); return; }
      send.disabled = true; result.textContent = 'Sending…';
      try {
        await saveEnquiry('concierge', { name: name.value.trim(), phone: phone.value.trim(), interest: `Concierge: ${title}`, message: note.value.trim(), requests: chosen.join(', ') || 'To discuss' });
        result.textContent = `Thank you, ${name.value.trim().split(' ')[0]}. The concierge has your list and will call you shortly.`;
      } catch { result.textContent = 'That didn’t go through. Please send it on WhatsApp instead.'; }
      finally { send.disabled = false; }
    });
  }
  sync();
  section.hidden = false;
  $('[data-concierge-link]').hidden = false;
  $('[data-concierge-link]').addEventListener('click', event => { event.preventDefault(); section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); });

  // The section arrives as it comes into view: the title rises out of its
  // lines, the three steps follow along their line, then the options settle
  // in group by group and the build sheet slides up beside them.
  if (!reduced && 'IntersectionObserver' in window) {
    const q = selector => section.querySelectorAll(selector);
    gsap.set(q('.v-cline > span'), { yPercent: 110 });
    gsap.set(q('.v-concierge-title > p, .v-concierge-steps li, .v-menu-group legend, .v-chip, .v-concierge-more'), { autoAlpha: 0, y: 14 });
    gsap.set('.v-sheet', { autoAlpha: 0, y: 40 });
    gsap.set('.v-concierge-steps', { '--line': 0 });
    const watch = (target, play) => new IntersectionObserver(([entry], observer) => { if (!entry.isIntersecting) return; observer.disconnect(); play(); }, { rootMargin: '0px 0px -12% 0px' }).observe(target);
    watch(section.querySelector('.v-concierge-head'), () => gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(q('.v-cline > span'), { yPercent: 0, duration: 1.3, stagger: .1 }, 0)
      .to(q('.v-concierge-title > p'), { autoAlpha: 1, y: 0, duration: 1, stagger: .08, clearProps: 'all' }, .2)
      .to('.v-concierge-steps', { '--line': 1, duration: 1.4, ease: 'expo.inOut' }, .35)
      .to(q('.v-concierge-steps li'), { autoAlpha: 1, y: 0, duration: 1, stagger: .14, clearProps: 'all' }, .45));
    watch(section.querySelector('.v-concierge-body'), () => gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(q('.v-menu-group legend, .v-chip'), { autoAlpha: 1, y: 0, duration: .9, stagger: .02, clearProps: 'all' }, 0)
      .to('.v-sheet', { autoAlpha: 1, y: 0, duration: 1.2, clearProps: 'all' }, .15)
      .to(q('.v-concierge-more'), { autoAlpha: 1, y: 0, duration: 1, clearProps: 'all' }, .6));
  }
}
