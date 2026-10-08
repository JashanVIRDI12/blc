// One vehicle card, everywhere a car is listed: the home page's picks, the
// collection and a car's similar cars. Each car stands in a lit vitrine; a
// band of light sweeps across it on hover, after React Bits' GlareHover.
import { escapeHTML, safeImage, thumbImage, stored } from './util.js';
import { badge, carTitle, carURL, cover, facts, formatPrice, plateLabel } from './data.js';

// The two manufacturer figures that best say what kind of car a preview is.
const KEY_SPECS = ['Power', '0–100 km/h', 'Wading depth', 'Approach angle', 'Seats'];
export const keySpecs = car => KEY_SPECS.map(key => car.specs.find(([name]) => name === key)).filter(Boolean).slice(0, 2);
export const camera = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>';

// A visitor's shortlist, kept in this browser only.
export const shortlist = {
  all: () => new Set(stored.get('baba:shortlist', [])),
  has(slug) { return this.all().has(slug); },
  toggle(slug) {
    const saved = this.all();
    if (saved.has(slug)) saved.delete(slug); else saved.add(slug);
    stored.set('baba:shortlist', [...saved]);
    document.dispatchEvent(new CustomEvent('shortlist:change'));
    return saved.has(slug);
  },
};
// Every shortlist button on the page follows the one list.
const syncButton = (button, saved) => {
  const on = saved.has(button.dataset.shortlist);
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${button.dataset.title} ${on ? 'from' : 'to'} your shortlist`);
};
let listening = false;
export function shortlistButton(car, className = 'shortlist-button') {
  if (!listening) {
    listening = true;
    document.addEventListener('shortlist:change', () => { const saved = shortlist.all(); document.querySelectorAll('[data-shortlist]').forEach(button => syncButton(button, saved)); });
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.shortlist = car.slug;
  button.dataset.title = carTitle(car);
  button.innerHTML = heart;
  button.addEventListener('click', () => { shortlist.toggle(car.slug); button.classList.remove('is-popped'); void button.offsetWidth; button.classList.add('is-popped'); });
  syncButton(button, shortlist.all());
  return button;
}

export function priceLabel(car, { card = false } = {}) {
  if (car.status === 'sold') return card ? '' : 'Sold';
  if (car.preview) return '';
  return formatPrice(car.price) || 'Price on request';
}

export function carCard(car, settings, { index = 0, saving = false } = {}) {
  const article = document.createElement('article');
  article.className = 'vehicle-card';
  article.dataset.status = car.preview ? 'preview' : car.status;
  article.style.setProperty('--i', index % 12);
  // A sold car is stamped across its photo instead.
  const tag = car.status === 'sold' ? null : badge(car, settings);
  const price = priceLabel(car, { card: true });
  const specs = car.preview ? keySpecs(car) : [];
  const listing = settings?.listing;
  const meta = car.preview ? [] : facts(car, listing);
  // A fancy or VIP number is named on the photo; a sold car is stamped.
  const plate = car.status === 'sold' ? '' : plateLabel(car, listing);
  // Under the pointer the card turns to the cabin (the car's hover photo).
  const inside = !car.preview && car.status !== 'sold' && car.hoverPhoto && car.hoverPhoto !== car.photos[0] ? car.hoverPhoto : '';
  article.innerHTML = `<a class="vehicle-link" href="${carURL(car)}">
    <span class="vehicle-visual" data-photo="${car.preview ? 'cutout' : 'full'}"${inside ? ' data-inside' : ''}><img src="${escapeHTML(thumbImage(cover(car)) || '/vehicle-placeholder.svg')}" data-full="${escapeHTML(safeImage(cover(car)) || '')}" alt="" loading="lazy" decoding="async" width="900" height="600" />${inside ? `<img class="inside-photo" src="${escapeHTML(thumbImage(inside))}" data-full="${escapeHTML(safeImage(inside))}" alt="" loading="lazy" decoding="async" width="900" height="600" /><span class="inside-label" aria-hidden="true">Inside</span>` : ''}<span class="glare" aria-hidden="true"></span>${tag ? `<span class="car-badge" data-tone="${tag.tone}">${escapeHTML(tag.label)}</span>` : ''}${car.photos.length > 1 ? `<span class="photo-count">${camera}${car.photos.length}<span class="sr-only"> photographs</span></span>` : ''}${plate ? `<span class="plate-chip" data-tone="${car.plateTag}"><i aria-hidden="true"></i>${escapeHTML(plate)}</span>` : ''}${car.status === 'sold' ? '<span class="sold-stamp" aria-hidden="true">Sold</span>' : ''}${car.status === 'sold' ? '' : '<span class="view-vehicle" aria-hidden="true">View car</span>'}</span>
    <span class="vehicle-card-heading"><span><span class="make">${escapeHTML(car.make)}</span><span class="vehicle-name">${escapeHTML(car.model)}${car.variant ? ` <small>${escapeHTML(car.variant)}</small>` : ''}</span></span>${price ? `<span class="vehicle-price${car.price === null && car.status !== 'sold' ? ' is-quiet' : ''}">${escapeHTML(price)}</span>` : ''}</span>
    ${specs.length ? `<span class="vehicle-keyspecs">${specs.map(([key, value]) => `<span><span class="dt">${escapeHTML(key)}</span><span class="dd">${escapeHTML(value)}</span></span>`).join('')}</span>` : ''}
    ${meta.length ? `<span class="vehicle-meta">${meta.map(value => `<span>${escapeHTML(value)}</span>`).join('')}</span>` : car.preview ? '<span class="availability">Enquire for current availability</span>' : ''}
    ${car.note && car.status !== 'sold' ? `<span class="vehicle-note">${escapeHTML(car.note)}</span>` : ''}
  </a>`;
  if (saving) article.append(shortlistButton(car));
  attachImageFallback(article);
  article.querySelectorAll('img:not(.inside-photo)').forEach(framePhoto);
  return article;
}

// Cut-out renders stand on the lit plinth; photographs fill the frame. A
// transparent top-left pixel marks a cut-out.
export function framePhoto(img) {
  const frame = img.closest('[data-photo]');
  if (!frame) return;
  const read = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
      frame.dataset.photo = context.getImageData(0, 0, 1, 1).data[3] < 16 ? 'cutout' : 'full';
    } catch { frame.dataset.photo = 'full'; }
  };
  if (img.complete && img.naturalWidth) read(); else img.addEventListener('load', read, { once: true });
}

// A missing small copy falls back to the full photograph, then to the
// placeholder; a missing cabin photograph simply isn't shown.
export function attachImageFallback(container) {
  container.querySelectorAll('img').forEach(img => img.addEventListener('error', function retry() {
    if (img.dataset.full && img.getAttribute('src') !== img.dataset.full) { img.src = img.dataset.full; return; }
    img.removeEventListener('error', retry);
    if (img.classList.contains('inside-photo')) { img.closest('[data-inside]')?.removeAttribute('data-inside'); img.remove(); return; }
    img.alt = 'Vehicle photographs available on request';
    img.src = '/vehicle-placeholder.svg';
  }));
}
