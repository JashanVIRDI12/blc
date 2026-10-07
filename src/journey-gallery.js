import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { escapeHTML, safeImage, thumbImage } from './util.js';

// One real photograph per slide; the list comes from Deliveries in admin.
// Thumbnails load near the section, full-size images only on opening.
export function createJourneyGallery(host, { deliveries, reduced = false, onSelect }) {
  const photos = deliveries.filter(delivery => safeImage(delivery.photo));
  let current = -1, disposed = false, opening = false;
  const number = value => String(value).padStart(2, '0');
  host.hidden = !photos.length;
  if (!photos.length) return { show() {}, dispose() {}, get index() { return -1; }, count: 0 };

  const title = photo => photo.city || 'A new beginning';
  host.innerHTML = `
    <div class="journey-gallery-head"><p>Moments from the journey</p><span data-gallery-count></span></div>
    <figure class="journey-gallery-figure">
      <div class="journey-gallery-frame">
        ${photos.map((photo, i) => `<a class="journey-slide" data-photo="${i}" href="${escapeHTML(safeImage(photo.photo))}" target="_blank" rel="noopener" aria-label="View delivery photograph: ${escapeHTML(title(photo))}" tabindex="-1" aria-hidden="true" inert>
          <img src="${escapeHTML(thumbImage(photo.photo))}" data-full="${escapeHTML(safeImage(photo.photo))}" alt="${escapeHTML(photo.caption || `A Baba Luxury Cars handover for ${title(photo)}`)}" loading="lazy" decoding="async" draggable="false" />
          <span class="journey-photo-open" aria-hidden="true">View photograph <svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg></span>
        </a>`).join('')}
      </div>
      <figcaption class="journey-gallery-caption"><div><p>Delivered to</p><h3 data-gallery-city></h3><p class="journey-gallery-note" data-gallery-caption></p></div>
        <div class="journey-gallery-arrows"><button type="button" data-gallery-prev aria-label="Previous delivery photograph">←</button><button type="button" data-gallery-next aria-label="Next delivery photograph">→</button></div>
      </figcaption>
    </figure>
    <div class="journey-gallery-thumbs" aria-label="Choose a delivery photograph">
      ${photos.map((photo, i) => `<button type="button" data-thumb="${i}" aria-label="Show delivery to ${escapeHTML(title(photo))}" aria-pressed="false"><img src="${escapeHTML(thumbImage(photo.photo))}" alt="" loading="lazy" decoding="async"/><span>${escapeHTML(title(photo))}</span></button>`).join('')}
    </div>`;
  const slides = [...host.querySelectorAll('[data-photo]')];
  const thumbs = [...host.querySelectorAll('[data-thumb]')];
  const full = new Map();
  const lightbox = new PhotoSwipeLightbox({
    pswpModule: () => import('photoswipe'),
    bgOpacity: .97, showHideAnimationType: 'fade',
    showAnimationDuration: reduced ? 0 : 350, hideAnimationDuration: reduced ? 0 : 300,
    wheelToZoom: true, loop: false,
    paddingFn: viewport => ({ top: 70, bottom: 64, left: viewport.x < 760 ? 16 : 64, right: viewport.x < 760 ? 16 : 64 }),
  });
  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name: 'journey-caption', order: 9, isButton: false, appendTo: 'root',
      onInit(element, pswp) {
        element.classList.add('journey-lightbox-caption');
        const update = () => {
          const photo = photos[pswp.getItemData(pswp.currIndex).photoIndex];
          element.textContent = [title(photo), photo.caption].filter(Boolean).join(' · ');
        };
        pswp.on('change', update); update();
      },
    });
  });
  lightbox.on('change', () => show(lightbox.pswp.getItemData(lightbox.pswp.currIndex).photoIndex, { notify: true }));
  lightbox.init();

  function show(index, { notify = false } = {}) {
    if (disposed) return;
    index = Math.max(0, Math.min(photos.length - 1, index));
    if (index === current) return;
    current = index;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active); slide.inert = !active;
      slide.tabIndex = active ? 0 : -1; slide.setAttribute('aria-hidden', String(!active));
    });
    thumbs.forEach((thumb, i) => thumb.setAttribute('aria-pressed', String(i === index)));
    host.querySelector('[data-gallery-count]').textContent = `${number(index + 1)} / ${number(photos.length)}`;
    host.querySelector('[data-gallery-city]').textContent = title(photos[index]);
    host.querySelector('[data-gallery-caption]').textContent = photos[index].caption || 'The keys, handed over. A new chapter begins.';
    if (notify) {
      // Keep an expanding list's selected thumbnail in the strip, without
      // scrolling the page or the pinned map.
      const strip = thumbs[index].parentElement;
      strip.scrollTo({ left: Math.max(0, thumbs[index].offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + thumbs[index].clientWidth / 2), behavior: reduced ? 'instant' : 'smooth' });
      onSelect?.(index, photos[index]);
    }
  }
  function imageData(index) {
    if (!full.has(index)) full.set(index, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ src: image.src, width: image.naturalWidth, height: image.naturalHeight, alt: slides[index].querySelector('img').alt, element: slides[index], photoIndex: index });
      image.onerror = () => { full.delete(index); resolve(null); };
      image.src = safeImage(photos[index].photo);
    }));
    return full.get(index);
  }
  const onClick = async event => {
    const thumb = event.target.closest('[data-thumb]');
    if (thumb) { show(Number(thumb.dataset.thumb), { notify: true }); return; }
    if (event.target.closest('[data-gallery-prev]')) { show((current - 1 + photos.length) % photos.length, { notify: true }); return; }
    if (event.target.closest('[data-gallery-next]')) { show((current + 1) % photos.length, { notify: true }); return; }
    const slide = event.target.closest('[data-photo]');
    if (!slide || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (opening) return;
    opening = true; host.classList.add('is-opening'); slide.setAttribute('aria-busy', 'true');
    const index = Number(slide.dataset.photo);
    try {
      // Discover the actual image dimensions, including future uploads.
      // PhotoSwipe needs these to fit and zoom without stretching.
      const data = await Promise.all(photos.map((_, i) => imageData(i)));
      if (disposed) return;
      if (data[index]) {
        const available = data.filter(Boolean);
        lightbox.loadAndOpen(data.slice(0, index).filter(Boolean).length, available);
      } else window.open(slide.href, '_blank', 'noopener');
    } finally { opening = false; host.classList.remove('is-opening'); slide.removeAttribute('aria-busy'); }
  };
  const onKey = event => {
    if (!event.target.closest('[data-thumb]')) return;
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!direction) return;
    event.preventDefault(); show((current + direction + photos.length) % photos.length, { notify: true }); thumbs[current].focus({ preventScroll: true });
  };
  const errors = [];
  host.querySelectorAll('img').forEach(image => {
    const fallback = () => {
      const source = image.dataset.full || safeImage(photos[Number(image.closest('[data-thumb]').dataset.thumb)].photo);
      if (image.src !== source) image.src = source;
    };
    image.addEventListener('error', fallback, { once: true }); errors.push([image, fallback]);
  });
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
  show(0);
  return {
    count: photos.length, get index() { return current; }, show,
    setReduced(value) { reduced = value; lightbox.options.showAnimationDuration = value ? 0 : 350; lightbox.options.hideAnimationDuration = value ? 0 : 300; },
    dispose() { disposed = true; lightbox.destroy(); host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); errors.forEach(([image, handler]) => image.removeEventListener('error', handler)); },
  };
}
