// The home page's featured collection: by default the most expensive cars on
// sale (three), so it keeps itself current as cars sell; or, if the admin
// chooses (Home page → Featured cars), the cars it picks, in their order.
// With no picks, the first cars of the collection; with no stock, the
// showcase previews. The cars are set twice from the same records: as cards
// (phones, tall screens, reduced motion) and, on wide screens, as a printed
// catalogue whose pages turn with the scroll; featured-stage.js chooses
// between them and turns the pages.
import { loadSite, recommended, FOR_SALE, defaultSettings, badge, carURL, cover, formatDriven, formatOwners, plateLabel } from './data.js';
import { camera, keySpecs, priceLabel, framePhoto, attachImageFallback } from './cards.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
import { createFeaturedMotion } from './featured-stage.js';

const lines = (element, text) => element.replaceChildren(...String(text).split('\n').flatMap((line, i) => i ? [document.createElement('br'), line] : [line]));

export async function setupFeatured() {
  const section = document.querySelector('#inventory');
  const $ = selector => section.querySelector(selector);
  const { cars, settings, previews } = await loadSite();
  const forSale = cars.filter(car => car.preview || FOR_SALE.includes(car.status));
  const picks = featuredCars(forSale, settings.home, previews).slice(0, Math.max(1, Number(settings.home.limit) || 3));
  $('[data-featured-title]').textContent = settings.home.title;
  const intro = !previews && settings.home.intro === defaultSettings.home.intro ? 'A considered selection.\nExplore the details and arrange a closer look.' : settings.home.intro;
  lines($('[data-featured-intro]'), intro);
  if (!previews) $('[data-featured-browse]').textContent = `Browse all ${forSale.length} ${forSale.length === 1 ? 'car' : 'cars'}`;

  const grid = $('[data-featured-grid]');
  grid.innerHTML = picks.map((car, k) => cardHTML(car, settings, k)).join('');
  grid.removeAttribute('aria-busy');
  $('[data-featured-book]').innerHTML = bookHTML(picks, settings, { title: settings.home.title, intro });
  $('.ft-rows').innerHTML = picks.map((car, k) => rowHTML(car, k)).join('');
  attachImageFallback(section);
  section.querySelectorAll('[data-photo] > img:first-child').forEach(framePhoto);
  createFeaturedMotion(section);
  document.dispatchEvent(new Event('layout:change'));
}

// The cars the section shows, in order, before the limit.
export function featuredCars(forSale, home, previews = false) {
  if (home.choose !== 'picks' && !previews) {
    const priced = forSale.filter(car => car.status !== 'coming_soon');
    return [...priced].sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || recommended(a, b));
  }
  const picks = forSale.filter(car => car.featured).sort((a, b) => a.featuredRank - b.featuredRank);
  return picks.length ? picks : [...forSale].sort(recommended);
}

// ------------------------------------------------------------------ parts
// The name as it is said: the model, then the variant, quieter, on the same
// line, so every car's details start on the same row.
const nameHTML = car => `${escapeHTML(car.model)}${car.variant ? ` <i>${escapeHTML(car.variant)}</i>` : ''}`;
const fullName = car => [car.make, car.model, car.variant].filter(Boolean).join(' ');
// What a buyer compares first, each under its own label; a preview carries
// two manufacturer figures instead.
function figures(car, listing) {
  if (car.preview) return keySpecs(car);
  return [
    ['Year', car.year ? String(car.year) : ''],
    [listing?.drivenLabel || 'Driven', formatDriven(car.kilometres)],
    ['Fuel', car.fuel],
    ['Ownership', formatOwners(car.owners)],
  ].filter(([, value]) => value);
}
const factsHTML = (car, listing) => {
  const list = figures(car, listing);
  if (!list.length) return car.preview ? '<p class="ft-facts ft-avail">Enquire for current availability</p>' : '<dl class="ft-facts"></dl>';
  return `<dl class="ft-facts">${list.map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
};
const priceHTML = car => {
  const price = priceLabel(car, { card: true });
  return price ? `<span class="ft-price${car.price === null ? ' is-quiet' : ''}">${escapeHTML(price)}</span>` : '';
};
// The labels a photograph wears: its badge, a fancy or VIP number, and how
// many photographs there are.
function chips(car, settings) {
  const tag = badge(car, settings), plate = plateLabel(car, settings.listing);
  return `${tag ? `<span class="car-badge" data-tone="${tag.tone}">${escapeHTML(tag.label)}</span>` : ''}${plate ? `<span class="plate-chip" data-tone="${car.plateTag}"><i aria-hidden="true"></i>${escapeHTML(plate)}</span>` : ''}${car.photos.length > 1 ? `<span class="photo-count">${camera}${car.photos.length}<span class="sr-only"> photographs</span></span>` : ''}`;
}
// Under the pointer the photograph turns to the cabin (the car's hover photo).
const insideOf = car => !car.preview && car.hoverPhoto && car.hoverPhoto !== car.photos[0] ? car.hoverPhoto : '';

function cardHTML(car, settings, k) {
  const inside = insideOf(car);
  return `<article class="ft-card" data-k="${k}">
    <span class="ft-card-photo" data-photo="${car.preview ? 'cutout' : 'full'}"${inside ? ' data-inside' : ''}><img src="${escapeHTML(thumbImage(cover(car)) || '/vehicle-placeholder.svg')}" data-full="${escapeHTML(safeImage(cover(car)) || '')}" alt="" loading="lazy" decoding="async" width="900" height="900" />${inside ? `<img class="inside-photo" src="${escapeHTML(thumbImage(inside))}" data-full="${escapeHTML(safeImage(inside))}" alt="" loading="lazy" decoding="async" width="900" height="900" /><span class="inside-label" aria-hidden="true">Inside</span>` : ''}<span class="glare" aria-hidden="true"></span>${chips(car, settings)}</span>
    <p class="ft-card-top"><span class="ft-make">${escapeHTML(car.make)}</span>${priceHTML(car)}</p>
    <h3 class="ft-name"><a href="${carURL(car)}">${nameHTML(car)}</a></h3>
    ${factsHTML(car, settings.listing)}
    <p class="ft-note">${car.note ? escapeHTML(car.note) : ''}</p>
  </article>`;
}

// ------------------------------------------------------------ the catalogue
// A cover, then a spread for each car: its photograph on the left page and
// its own printed page on the right. Each leaf is one sheet of paper: a right
// page on its front and, on its back, the photograph that faces the next
// car's page once it is turned. So the cover's back is the first car's
// photograph, the first car's page is backed by the second's photograph, and
// the last car's page lies beneath them all.
function bookHTML(picks, settings, { title, intro }) {
  const n = picks.length;
  const issue = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
  const face = (side, html, extra = '') => `<div class="ft-face ft-${side}"${extra}>${html}<span class="ft-gloss"></span><span class="ft-shade"></span></div>`;
  const leaves = picks.map((car, i) => `<div class="ft-leaf" data-leaf="${i}">${face('front', i ? pageHTML(picks[i - 1], settings, i, n, issue) : coverHTML(title, intro, issue, n))}${face('back', photoHTML(car, settings))}</div>`);
  return `<div class="ft-spread">
    <div class="ft-base">${face('front', pageHTML(picks[n - 1], settings, n, n, issue))}</div>
    ${leaves.reverse().join('')}
    <span class="ft-cast ft-cast--left"></span><span class="ft-cast ft-cast--right"></span>
    <button type="button" class="ft-turn ft-turn--back" data-turn="-1"><span>Previous car</span></button>
    <button type="button" class="ft-turn ft-turn--next" data-turn="1"><span>Next car</span></button>
  </div>`;
}

// The front cover: the dealership's mark, the title, the month and the count.
function coverHTML(title, intro, issue, n) {
  return `<div class="ft-page ft-cover">
    <img class="ft-cover-mark" src="/brand/baba-luxury-car-800.webp" alt="" width="800" height="250" />
    <div class="ft-cover-title"><p class="ft-cover-name">${escapeHTML(title)}</p><p class="ft-cover-intro">${escapeHTML(intro).replace(/\n/g, '<br>')}</p></div>
    <p class="ft-cover-issue"><span>${escapeHTML(issue)}</span><span class="ft-cover-hint">Scroll to open</span><span>${n} ${n === 1 ? 'car' : 'cars'}</span></p>
  </div>`;
}

// A car's printed page: a running head; the make, the price (and any word
// on it) and the name; its colour and gearbox; a photograph of the cabin
// beside the dealership's highlights; the figures; and the folio.
function pageHTML(car, settings, k, n, issue) {
  const inside = insideOf(car);
  const about = [car.colour, car.transmission?.toLowerCase()].filter(Boolean).join(', ');
  const points = car.highlights.slice(0, 4);
  return `<article class="ft-page ft-sheet" aria-label="${escapeHTML(fullName(car))}">
    <p class="ft-run"><span>Featured collection</span><span>${escapeHTML(issue)}</span></p>
    <div class="ft-sheet-body">
      <div class="ft-card-top"><span class="ft-make">${escapeHTML(car.make)}</span><span class="ft-price-block">${priceHTML(car)}${car.note ? `<span class="ft-note">${escapeHTML(car.note)}</span>` : ''}</span></div>
      <h3 class="ft-name">${nameHTML(car)}</h3>
      ${about ? `<p class="ft-about">${escapeHTML(about)}</p>` : ''}
      ${inside || points.length ? `<div class="ft-feature">${inside ? `<figure class="ft-inset"><img data-src="${escapeHTML(thumbImage(inside))}" alt="" decoding="async" width="900" height="900" /><figcaption>Inside</figcaption></figure>` : ''}${points.length ? `<ul class="ft-points">${points.map(point => `<li>${escapeHTML(point)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      ${factsHTML(car, settings.listing)}
      <a class="ft-view" href="${carURL(car)}">View this car<span class="sr-only">: ${escapeHTML(fullName(car))}</span></a>
    </div>
    <p class="ft-folio">${k} of ${n}</p>
  </article>`;
}

// A car's photograph, full bleed on its left page; the full-size file is
// fetched as its spread comes near (featured-stage.js).
function photoHTML(car, settings) {
  const inside = insideOf(car);
  return `<a class="ft-page ft-photo" href="${carURL(car)}" tabindex="-1" aria-hidden="true" data-photo="${car.preview ? 'cutout' : 'full'}"${inside ? ' data-inside' : ''}><img data-src="${escapeHTML(safeImage(cover(car)) || '/vehicle-placeholder.svg')}" alt="" decoding="async" width="1280" height="1280" />${inside ? `<img class="inside-photo" data-src="${escapeHTML(safeImage(inside))}" alt="" decoding="async" width="1280" height="1280" /><span class="inside-label">Inside</span>` : ''}${chips(car, settings)}</a>`;
}

// The contents beneath the catalogue: every car, its price, a turn away.
function rowHTML(car, k) {
  const price = priceLabel(car, { card: true });
  return `<li><button type="button" class="ft-row" data-k="${k}"><span class="ft-row-name"><span class="sr-only">${escapeHTML(car.make)} </span>${nameHTML(car)}</span>${price ? `<span class="ft-row-price">${escapeHTML(price)}</span>` : ''}</button></li>`;
}
