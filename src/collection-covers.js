// A saved image wins; "auto" deliberately follows the current stock. Empty
// values use the editorial covers, with real car photos as the fallback.
import { safeImage, thumbImage, escapeHTML } from './util.js';

export const GENERATED_COVERS = Object.freeze({
  signature: '/collections/signature-cover.webp',
  family: '/collections/family-cover.webp',
  performance: '/collections/performance-cover.webp',
  adventure: '/collections/adventure-cover.webp',
});
export const AUTO_COVER = 'auto';
export const collectionCover = (slug, value) => value === AUTO_COVER ? '' : safeImage(value) || safeImage(GENERATED_COVERS[slug]);
export const stockPhotos = cars => [...cars].filter(car => car.status !== 'hidden')
  .sort((a, b) => (a.status === 'sold') - (b.status === 'sold'))
  .flatMap(car => (car.photos || []).filter(safeImage).map(url => ({ url, car })));

export function coverImage(url, fallback = '') {
  const full = safeImage(url);
  if (!full) return '';
  return `<img src="${escapeHTML(thumbImage(full))}" data-full="${escapeHTML(full)}"${safeImage(fallback) ? ` data-fallback="${escapeHTML(safeImage(fallback))}"` : ''} alt="" loading="lazy" decoding="async" width="1024" height="1024" />`;
}

// A missing thumbnail retries the original; a missing cover uses a real
// photo. No inline handlers, so this also works under a strict CSP.
export function bindCoverFallbacks(container) {
  container.querySelectorAll('img[data-full]').forEach(img => {
    const attempted = new Set([img.src]);
    const retry = () => {
      const next = [img.dataset.full, img.dataset.fallback, '/vehicle-placeholder.svg'].map(safeImage).find(url => url && !attempted.has(url));
      if (!next) { img.removeEventListener('error', retry); return; }
      attempted.add(next); img.src = next;
    };
    img.addEventListener('error', retry);
  });
}
