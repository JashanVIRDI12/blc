// Across India: the figures that say how far Baba's cars go, and the
// handover photographs themselves. No map, no tally of places: the cars go
// to almost every state, and the photographs say the rest.
//
// The photographs ride a gentle arc that drifts on by itself, after React
// Bits' Circular Gallery, built in the DOM rather than WebGL so any photo host
// works and every photograph stays a real, focusable link: the cards dip and
// lean towards the edges, the picture inside each shifts against its frame,
// a drag (or a swipe) throws the strip with inertia and settles a photograph
// in the middle, and the page's own scroll speed hurries it a little. It runs
// only while on screen. With reduced motion it is a plain row that scrolls.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { figures } from './config.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin);

const DRIFT = 28;      // px per second the strip drifts on its own
const BEND = 2.2;      // the arc's radius, in gallery widths: larger is flatter
const LEAN = .42;      // how much of the arc's slope each card leans with
const PARALLAX = .06;  // how far a picture shifts in its frame, per px from the middle

export function createAcrossIndia(section, { deliveries = [], reduced = false } = {}) {
  const $ = selector => section.querySelector(selector);
  const cleanups = [];

  // ------------------------------------------------------------ the figures
  // Each digit is a drum of 0-9, three times over, that rolls to its place.
  const list = $('[data-india-figures]');
  list.innerHTML = figures.map(({ value, suffix, label }) => `<div class="india-figure">
      <dt>${escapeHTML(label)}</dt>
      <dd><span class="sr-only">${escapeHTML(`${value}${suffix}`)}</span><span class="india-odo" aria-hidden="true">${String(value).split('').map(digit => `<span class="india-digit" data-digit="${digit}"><span class="india-drum">${'0123456789'.repeat(3).split('').map(n => `<span>${n}</span>`).join('')}</span></span>`).join('')}</span><span class="india-suffix" aria-hidden="true">${escapeHTML(suffix)}</span></dd>
    </div>`).join('');
  const drums = [...list.querySelectorAll('.india-digit')].map(digit => ({ drum: digit.firstElementChild, to: -(20 + Number(digit.dataset.digit)) / 30 * 100 }));

  // ---------------------------------------------------------- the gallery
  const gallery = $('[data-india-gallery]'), track = $('[data-india-track]'), foot = $('[data-india-foot]');
  const photos = deliveries.filter(delivery => safeImage(delivery.photo));
  const alt = photo => photo.caption || `A Baba Luxury Cars handover${photo.city ? ` in ${photo.city}` : ''}`;
  const card = (photo, index, copy) => `<div class="india-card" role="listitem"${copy ? ' aria-hidden="true"' : ''}>
      <a class="india-card-frame" href="${escapeHTML(safeImage(photo.photo))}" data-photo="${index}" target="_blank" rel="noopener"${copy ? ' tabindex="-1"' : ''} aria-label="${escapeHTML(`View the photograph: ${alt(photo)}`)}">
        <span class="india-card-shift"><img src="${escapeHTML(thumbImage(photo.photo))}" alt="" loading="lazy" decoding="async" draggable="false" /></span>
      </a>
      <p class="india-card-caption"><span>Delivered to</span><b>${escapeHTML(photo.city || 'A new owner')}</b></p>
    </div>`;
  // A strip needs enough photographs to read as one; fewer stand still.
  const moving = !reduced && photos.length >= 3;
  let cards = [], size = { card: 1, span: 1, width: 1, radius: 1 }, sets = 0, lightbox = null;
  const state = { offset: 0, speed: DRIFT, boost: 0 };
  let dragging = false, moved = false, visible = false, hovering = false, introduced = !moving;

  function build(count) {
    sets = count;
    track.innerHTML = Array.from({ length: count }, (_, set) => photos.map((photo, i) => card(photo, i, set > 0)).join('')).join('');
    cards = [...track.children].map(element => ({ element, shift: element.querySelector('.india-card-shift'), rise: introduced ? 1 : 0, last: '' }));
    track.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
      const full = safeImage(photos[Number(image.closest('[data-photo]').dataset.photo)].photo);
      if (image.src !== full) image.src = full;
    }, { once: true }));
  }
  // Sizes are read here, on resize, never while drawing.
  function layout() {
    if (!photos.length) return;
    const first = track.firstElementChild;
    const width = gallery.clientWidth, cardWidth = first ? first.offsetWidth : 300;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 28;
    size = { card: cardWidth, span: cardWidth + gap, width, radius: width * BEND };
    if (!moving) return;
    // Enough copies that the strip always overfills the screen as it wraps.
    const wanted = Math.max(2, Math.ceil((width + size.span * 2) / (photos.length * size.span)));
    if (wanted !== sets) { build(wanted); return layout(); }
    render(true);
  }

  // Every card's place on the arc, from the strip's offset.
  const total = () => cards.length * size.span;
  const xOf = k => gsap.utils.wrap(-size.span, total() - size.span, k * size.span - state.offset);
  // The offset at which card k stands in the middle.
  const centred = k => k * size.span + size.card / 2 - size.width / 2;
  function render(force = false) {
    const { radius } = size;
    for (let k = 0; k < cards.length; k++) {
      const c = cards[k], x = xOf(k);
      const from = x + size.card / 2 - size.width / 2;
      const dip = radius - Math.sqrt(Math.max(0, radius * radius - from * from));
      const lean = Math.asin(gsap.utils.clamp(-1, 1, from / radius)) * LEAN;
      const transform = `translate3d(${x.toFixed(1)}px,${(dip + (1 - c.rise) * 90).toFixed(1)}px,0) rotate(${lean.toFixed(4)}rad)`;
      if (!force && transform === c.last) continue;
      c.last = transform;
      c.element.style.transform = transform;
      c.element.style.opacity = c.rise < 1 ? c.rise.toFixed(3) : '';
      c.shift.style.transform = `translate3d(${(-from * PARALLAX).toFixed(1)}px,0,0)`;
    }
  }
  function tick(time, deltaTime) {
    if (!dragging) state.offset += (state.speed + state.boost) * Math.min(.05, deltaTime / 1000);
    state.boost *= .94;
    render();
  }
  let ticking = false;
  const run = on => {
    on = on && moving && !document.hidden;
    if (on === ticking) return;
    ticking = on;
    if (on) gsap.ticker.add(tick); else gsap.ticker.remove(tick);
  };

  if (photos.length) {
    gallery.hidden = false; foot.hidden = false;
    gallery.classList.toggle('is-static', !moving);
    build(1);
    layout();
    const resizer = new ResizeObserver(() => layout());
    resizer.observe(gallery);
    // One callback can carry several entries, oldest first: the last is current.
    const watcher = new IntersectionObserver(entries => { visible = entries.at(-1).isIntersecting; run(visible); });
    watcher.observe(gallery);
    const onVisibility = () => run(visible);
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => { resizer.disconnect(); watcher.disconnect(); document.removeEventListener('visibilitychange', onVisibility); run(false); });

    if (moving) {
      // Throw the strip; it settles with a photograph in the middle.
      const proxy = document.createElement('div');
      let start = 0, origin = 0;
      const offsetAt = x => start - (x - origin);
      const [drag] = Draggable.create(proxy, {
        type: 'x', trigger: gallery, inertia: true, dragClickables: true, allowNativeTouchScrolling: true, minimumMovement: 6,
        onPress() { gsap.killTweensOf(state, 'offset'); start = state.offset; origin = this.x; dragging = true; moved = false; },
        onDrag() { moved = true; state.offset = offsetAt(this.x); },
        onThrowUpdate() { state.offset = offsetAt(this.x); },
        onRelease() { if (!this.tween?.isActive()) dragging = false; },
        onThrowComplete() { dragging = false; },
        snap: x => { const end = offsetAt(x), c = centred(0); return origin + start - (Math.round((end - c) / size.span) * size.span + c); },
      });
      cleanups.push(() => drag.kill());
      // The page's own scroll speed hurries the strip along, briefly, the
      // way the page is going.
      const pace = ScrollTrigger.create({ trigger: gallery, start: 'top bottom', end: 'bottom top', onUpdate: self => { state.boost = gsap.utils.clamp(-220, 220, self.getVelocity() * .18); } });
      cleanups.push(() => pace.kill());
      // Under a fine pointer the strip comes to rest, to be looked at.
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        gallery.addEventListener('pointerenter', () => { hovering = true; gsap.to(state, { speed: 0, duration: .9, ease: 'power3.out', overwrite: 'auto' }); });
        gallery.addEventListener('pointerleave', () => { hovering = false; gsap.to(state, { speed: DRIFT, duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' }); });
      }
      // Keyboard: a focused photograph glides to the middle; the arrows step.
      const glide = to => gsap.to(state, { offset: to, duration: .9, ease: 'expo.out', overwrite: 'auto' });
      track.addEventListener('focusin', event => {
        const k = cards.findIndex(c => c.element.contains(event.target));
        if (k >= 0) glide(state.offset + gsap.utils.wrap(-total() / 2, total() / 2, centred(k) - state.offset));
      });
      gallery.addEventListener('keydown', event => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const c = centred(0);
        glide((Math.round((state.offset - c) / size.span) + step) * size.span + c);
      });
    }

    // A click (not the end of a drag) opens the photograph.
    lightbox = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      bgOpacity: .97, showHideAnimationType: 'fade', showAnimationDuration: reduced ? 0 : 350, hideAnimationDuration: reduced ? 0 : 300,
      wheelToZoom: true, loop: true,
      paddingFn: viewport => ({ top: 70, bottom: 64, left: viewport.x < 760 ? 16 : 64, right: viewport.x < 760 ? 16 : 64 }),
    });
    lightbox.on('uiRegister', () => lightbox.pswp.ui.registerElement({
      name: 'journey-caption', order: 9, isButton: false, appendTo: 'root',
      onInit(element, pswp) {
        element.classList.add('journey-lightbox-caption');
        const update = () => { element.textContent = pswp.currSlide?.data.caption ?? ''; };
        pswp.on('change', update); update();
      },
    }));
    lightbox.on('close', () => { if (moving && !hovering) gsap.to(state, { speed: DRIFT, duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' }); });
    lightbox.init();
    // PhotoSwipe fits and zooms by the real dimensions; they are read on opening.
    const sizes = new Map();
    const dimensions = i => {
      if (!sizes.has(i)) sizes.set(i, new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve({ src: image.src, width: image.naturalWidth, height: image.naturalHeight, alt: alt(photos[i]), caption: [photos[i].city, photos[i].caption].filter(Boolean).join(' · ') });
        image.onerror = () => { sizes.delete(i); resolve(null); };
        image.src = safeImage(photos[i].photo);
      }));
      return sizes.get(i);
    };
    track.addEventListener('click', async event => {
      const frame = event.target.closest('[data-photo]');
      if (!frame || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (moved) { moved = false; return; }
      const index = Number(frame.dataset.photo);
      const data = await Promise.all(photos.map((_, i) => dimensions(i)));
      if (!data[index]) { window.open(frame.href, '_blank', 'noopener'); return; }
      gsap.to(state, { speed: 0, duration: .3, overwrite: 'auto' });
      lightbox.loadAndOpen(data.slice(0, index).filter(Boolean).length, data.filter(Boolean));
    });
    cleanups.push(() => lightbox.destroy());
  }

  // ----------------------------------------------------------------- motion
  // The section assembles once as it comes into view: the title rises out of
  // its lines, the statement line by line, the figures roll to their values
  // and the photographs rise onto their arc, from the left.
  const lines = section.querySelectorAll('.india-line > span');
  const statement = $('[data-india-statement]');
  if (reduced) drums.forEach(({ drum, to }) => gsap.set(drum, { yPercent: to }));
  else {
    gsap.set(lines, { yPercent: 108 });
    gsap.set(section.querySelectorAll('[data-india-reveal], .india-figure dt, .india-suffix, .india-foot'), { autoAlpha: 0, y: 14 });
    const split = SplitText.create(statement, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: self => gsap.from(self.lines, { yPercent: 105, duration: 1.5, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: statement, start: 'top 88%', once: true } }),
    });
    cleanups.push(() => split.revert());
    const head = ScrollTrigger.create({
      trigger: section, start: 'top 70%', once: true,
      onEnter: () => gsap.timeline({ defaults: { ease: 'expo.out' } })
        .to(lines, { yPercent: 0, duration: 1.6, stagger: .1 }, 0)
        .to(section.querySelectorAll('[data-india-reveal]'), { autoAlpha: 1, y: 0, duration: 1.2, clearProps: 'transform' }, .1),
    });
    // Odometer: every drum spins through its digits and comes to rest, each
    // a beat after the one before, like a counter settling.
    const counts = ScrollTrigger.create({
      trigger: list, start: 'top 88%', once: true,
      onEnter: () => {
        const timeline = gsap.timeline({ defaults: { ease: 'expo.out' } })
          .to(section.querySelectorAll('.india-figure dt'), { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08, clearProps: 'transform' }, .1);
        drums.forEach(({ drum, to }, i) => timeline.fromTo(drum, { yPercent: 0 }, { yPercent: to, duration: 2.4, ease: 'expo.inOut' }, .05 + i * .07));
        timeline.to(section.querySelectorAll('.india-suffix'), { autoAlpha: 1, y: 0, duration: 1, stagger: .08, clearProps: 'transform' }, 1.5);
      },
    });
    cleanups.push(() => { head.kill(); counts.kill(); });
    if (photos.length) {
      const rise = ScrollTrigger.create({
        trigger: gallery, start: 'top 85%', once: true,
        onEnter: () => {
          gsap.to(foot, { autoAlpha: 1, y: 0, duration: 1.2, delay: .6, ease: 'expo.out', clearProps: 'transform' });
          if (!moving) return;
          // The photographs rise onto the arc in the order they stand.
          introduced = true;
          const order = cards.map((c, k) => [c, xOf(k)]).sort((a, b) => a[1] - b[1]).map(([c]) => c);
          gsap.to(order, { rise: 1, duration: 1.6, ease: 'expo.out', stagger: .07, onUpdate: () => render(true) });
        },
      });
      cleanups.push(() => rise.kill());
    }
  }

  if (import.meta.env.DEV) window.__india = { state: () => ({ photos: photos.length, cards: cards.length, sets, moving, offset: state.offset, speed: state.speed, ticking, introduced }) };
  return {
    refresh: () => layout(),
    dispose() { cleanups.forEach(cleanup => cleanup()); },
  };
}
