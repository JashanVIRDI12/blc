// Across India: where Baba's cars have gone. An atlas of India in fine dots
// (india-atlas.js, three.js) with gold routes from the showroom in Paschim
// Vihar to every destination; beside it an index of the destinations, a
// panel that tells the chosen one, the figures, and a strip of real handover
// photographs. The section scrolls like any other: nothing is pinned. It
// assembles once as it comes into view, then the atlas leans gently with the
// scroll. An SVG of the same map stands in at once, and for good without WebGL.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { dots, outline, project, viewBox } from './india-map.js';
import { ORIGIN, findPlace, readPlaces, stateCode } from './places.js';
import { carName, carURL, FOR_SALE } from './data.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
gsap.registerPlugin(ScrollTrigger);

const grouping = new Intl.NumberFormat('en-IN');
const km = ([lat1, lng1], [lat2, lng2]) => {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};
const samePlace = (a, b) => a && b && km(a.at, b.at) < 1;
const two = n => String(n).padStart(2, '0');
const distanceText = j => `${grouping.format(Math.round(j.km / 10) * 10)} km`;
const coordinates = ([lat, lng]) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lng).toFixed(2)}° ${lng < 0 ? 'W' : 'E'}`;

export function createAcrossIndia(section, { settings, deliveries = [], cars = [], reduced = false }) {
  const $ = selector => section.querySelector(selector);
  const stage = $('[data-india-stage]'), canvas = $('[data-india-canvas]'), pinLayer = $('[data-india-pins]');
  const list = $('[data-india-list]'), panel = $('[data-india-panel]'), panelBody = $('[data-panel-body]');
  const india = settings.india || {};
  $('[data-india-intro]').textContent = india.intro || '';

  // ------------------------------------------------------------ the places
  // The places in Settings, and every place a handover photograph names.
  const { places } = readPlaces(india.places);
  const photographs = deliveries.filter(delivery => safeImage(delivery.photo));
  const handovers = photographs.map((delivery, index) => ({ ...delivery, index, place: findPlace(delivery.city) }));
  for (const { place } of handovers) if (place && !places.some(other => samePlace(other, place))) places.push(place);
  const stock = cars.filter(car => !car.preview && car.status !== 'hidden');
  // A state registration is useful context, not evidence that a particular
  // car went to this city; only a photograph says a car was delivered there.
  const journeys = places.filter((place, i) => places.findIndex(other => samePlace(other, place)) === i).map(place => {
    const photo = handovers.find(delivery => samePlace(delivery.place, place));
    const code = stateCode(place.name);
    const local = code ? stock.filter(car => String(car.registration).trim().toUpperCase().startsWith(code)).sort((a, b) => FOR_SALE.includes(b.status) - FOR_SALE.includes(a.status)) : [];
    return { name: photo?.place.name || place.name, at: place.at, km: km(ORIGIN.at, place.at), photo, local, code };
  }).filter(j => j.km >= 60).sort((a, b) => a.km - b.km);
  handovers.forEach(delivery => { delivery.journey = delivery.place ? journeys.findIndex(j => samePlace(j, delivery.place)) : -1; });

  // ------------------------------------------------------------- the index
  $('[data-india-count]').textContent = two(journeys.length);
  list.innerHTML = journeys.map((j, i) => `<li><button type="button" class="india-place" data-place="${i}" aria-pressed="false">
      <span class="india-place-index">${two(i + 1)}</span><span class="india-place-name">${escapeHTML(j.name)}</span>
      <span class="india-place-km">${j.photo ? '<i class="india-place-photo" aria-label="Handover photograph"></i>' : ''}${distanceText(j)}</span>
    </button></li>`).join('');
  const items = [...list.querySelectorAll('[data-place]')];

  // ------------------------------------------------------------- the figures
  const sold = stock.filter(car => car.status === 'sold').length;
  const onSale = stock.filter(car => FOR_SALE.includes(car.status)).length;
  const delivered = Number(String(india.delivered || '').replace(/[^\d]/g, '')) || 0;
  const longest = journeys.at(-1);
  const stats = [
    [journeys.length + 1, 'Cities and states', ''],
    ...(delivered ? [[delivered, 'Cars delivered', /\+\s*$/.test(String(india.delivered)) ? '+' : '']] : sold ? [[sold, 'Recently delivered', '']] : []),
    ...(longest ? [[Math.round(longest.km / 10) * 10, `Our longest journey, to ${longest.name}`, ' km']] : []),
    ...(onSale ? [[onSale, 'On sale today', '']] : []),
  ];
  $('[data-india-stats]').innerHTML = `<div class="india-origin"><dt>Every journey starts here</dt><dd>Paschim Vihar, New Delhi</dd></div>`
    + stats.map(([value, label, suffix]) => `<div><dt>${escapeHTML(label)}</dt><dd><span data-count="${value}">${grouping.format(value)}</span>${suffix}</dd></div>`).join('');
  const counters = [...section.querySelectorAll('[data-count]')];

  // ------------------------------------------------------------- the panel
  const panelPhoto = $('[data-panel-photo]'), panelImage = panelPhoto.querySelector('img');
  const fields = { coords: $('[data-panel-coords]'), number: $('[data-panel-number]'), kicker: $('[data-panel-kicker]'), name: $('[data-panel-name]'), meta: $('[data-panel-meta]'), caption: $('[data-panel-caption]'), car: $('[data-panel-car]') };
  panelImage.addEventListener('error', () => { panelPhoto.hidden = true; });
  function fill(i) {
    const j = journeys[i];
    fields.coords.textContent = coordinates(j ? j.at : ORIGIN.at);
    fields.number.textContent = j ? two(i + 1) : '';
    if (!j) {
      fields.kicker.textContent = 'Every journey starts here';
      fields.name.textContent = 'Paschim Vihar';
      fields.meta.textContent = journeys.length ? `New Delhi · ${journeys.length} destinations and counting` : 'New Delhi';
      fields.caption.textContent = journeys.length ? 'Choose a destination to see where our cars have gone.' : '';
      panelPhoto.hidden = true; fields.car.hidden = true;
      return;
    }
    const car = j.local[0];
    fields.kicker.textContent = j.photo ? 'Delivered here' : car ? `Registered in ${j.code}` : 'Within our reach';
    fields.name.textContent = j.name;
    fields.meta.textContent = `${distanceText(j)} from Paschim Vihar`;
    fields.caption.textContent = j.photo?.caption || '';
    panelPhoto.hidden = !j.photo;
    if (j.photo) { panelImage.src = thumbImage(j.photo.photo); panelImage.alt = j.photo.caption || `A Baba Luxury Cars handover in ${j.name}`; }
    fields.car.hidden = !car;
    if (car) { fields.car.href = carURL(car); fields.car.textContent = `${carName(car)} · ${FOR_SALE.includes(car.status) ? 'View the car' : 'Sold'} ↗`; }
    else fields.car.removeAttribute('href');
  }
  let shownInPanel = null, panelSwap;
  function showPanel(i) {
    if (i === shownInPanel) return;
    shownInPanel = i;
    panelSwap?.kill();
    if (reduced) { fill(i); return; }
    panelSwap = gsap.timeline()
      .to(panelBody, { autoAlpha: 0, y: 6, duration: .16, ease: 'power2.in' })
      .add(() => fill(i))
      .to(panelBody, { autoAlpha: 1, y: 0, duration: .5, ease: 'expo.out' });
  }
  fill(-1); shownInPanel = -1;

  // ------------------------------------------------------- the stand-in map
  // The same map as an SVG, drawn at once: the dots, the coast, the routes
  // as flat arcs and the points. It gives way to the atlas when that is
  // ready, and stays where WebGL is unavailable.
  const [vw, vh] = viewBox.slice(2);
  const home = project(ORIGIN.at);
  const flatRoute = j => { const [x, y] = project(j.at), mx = (home[0] + x) / 2, my = (home[1] + y) / 2 - Math.hypot(x - home[0], y - home[1]) * .22; return `M${home[0].toFixed(1)} ${home[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; };
  $('[data-india-fallback]').innerHTML = `<svg viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">
      <path class="india-svg-dots" d="${dots}"/><path class="india-svg-coast" d="${outline}"/>
      ${journeys.map((j, i) => `<path class="india-svg-route" data-route="${i}" d="${flatRoute(j)}"/>`).join('')}
      ${journeys.map((j, i) => { const [x, y] = project(j.at); return `<circle class="india-svg-point" data-point="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`; }).join('')}
      <circle class="india-svg-home" cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="7"/>
    </svg>`;
  const svgRoutes = [...section.querySelectorAll('[data-route]')], svgPoints = [...section.querySelectorAll('[data-point]')];

  // --------------------------------------------------------------- the pins
  // Names on the atlas, in the page's own type: crisp at any density, and
  // each one a way in. Where names would collide (the cities crowd round
  // Delhi), the chosen one and the farther ones win; the index lists them all.
  pinLayer.innerHTML = `<span class="india-pin india-pin--home"><b>Paschim Vihar</b></span>`
    + journeys.map((j, i) => `<button type="button" class="india-pin" data-pin="${i}" tabindex="-1">${escapeHTML(j.name)}</button>`).join('');
  const homePin = pinLayer.querySelector('.india-pin--home'), pins = [...pinLayer.querySelectorAll('[data-pin]')];
  // Sizes are read here, on resize and once the type has loaded, never while
  // drawing: a read after the frame's writes would force a layout each frame.
  let widths = [], homeWidth = 0, stageSize = { w: 1, h: 1 };
  const measurePins = () => {
    widths = pins.map(pin => pin.offsetWidth); homeWidth = homePin.offsetWidth;
    stageSize = { w: stage.clientWidth, h: stage.clientHeight };
    placed = '';
  };

  // --------------------------------------------------------------- choosing
  let atlas = null, hovered = -1, selected = -1, focus = -1, placed = '';
  function setFocus() {
    const next = hovered >= 0 ? hovered : selected;
    if (next === focus) return;
    focus = next;
    items.forEach((item, i) => { item.classList.toggle('is-active', i === focus); item.setAttribute('aria-pressed', String(i === selected)); });
    pins.forEach((pin, i) => pin.classList.toggle('is-active', i === focus));
    section.classList.toggle('has-focus', focus >= 0);
    svgRoutes.forEach((route, i) => route.classList.toggle('is-on', i === focus));
    svgPoints.forEach((point, i) => point.classList.toggle('is-on', i === focus));
    strip?.querySelectorAll('[data-journey]').forEach(card => card.classList.toggle('is-on', focus >= 0 && Number(card.dataset.journey) === focus));
    // overwrite 'auto': only an earlier focus tween gives way, never the
    // intro's, which tweens the same routes' other values.
    atlas?.routes.forEach((route, i) => gsap.to(route, { focus: i === focus ? 1 : 0, duration: reduced ? 0 : .6, ease: 'expo.out', overwrite: 'auto', onUpdate: atlas.request }));
    showPanel(focus);
    placePins();
  }
  const hover = i => { hovered = i; setFocus(); };
  const choose = i => { selected = i === selected ? -1 : i; hovered = -1; setFocus(); };
  list.addEventListener('click', event => { const item = event.target.closest('[data-place]'); if (item) choose(Number(item.dataset.place)); });
  list.addEventListener('pointerover', event => { const item = event.target.closest('[data-place]'); if (item && event.pointerType !== 'touch') hover(Number(item.dataset.place)); });
  list.addEventListener('pointerleave', () => hover(-1));
  list.addEventListener('focusin', event => { const item = event.target.closest('[data-place]'); if (item) hover(Number(item.dataset.place)); });
  list.addEventListener('focusout', event => { if (!list.contains(event.relatedTarget)) hover(-1); });
  pinLayer.addEventListener('click', event => { const pin = event.target.closest('[data-pin]'); if (pin) { event.stopPropagation(); choose(Number(pin.dataset.pin)); } });
  const onKey = event => { if (event.key === 'Escape' && selected >= 0 && !document.querySelector('.pswp--open')) { selected = -1; setFocus(); } };
  document.addEventListener('keydown', onKey);

  // On the atlas itself: the nearest point within reach of the pointer.
  const nearest = (event, reach) => {
    if (!atlas) return -1;
    const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    let best = -1, closest = reach;
    journeys.forEach((j, i) => { const p = atlas.screen(i), d = Math.hypot(p.x - x, p.y - y); if (d < closest) { closest = d; best = i; } });
    return best;
  };
  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || event.target.closest('.india-panel')) return;
    const i = event.target.closest('[data-pin]') ? Number(event.target.closest('[data-pin]').dataset.pin) : nearest(event, 26);
    stage.classList.toggle('is-pointing', i >= 0);
    if (i !== hovered) hover(i);
  });
  stage.addEventListener('pointerleave', () => { stage.classList.remove('is-pointing'); hover(-1); });
  stage.addEventListener('click', event => {
    if (event.target.closest('.india-panel, [data-pin]')) return;
    const i = nearest(event, event.pointerType === 'touch' ? 34 : 26);
    if (i >= 0) choose(i); else if (selected >= 0) choose(selected);
  });

  // When the atlas has moved (or a route has landed, or the focus changed),
  // the names follow their points. Unchanged frames, the routes' lights
  // running, touch nothing.
  const boxes = [], last = new Map();
  const set = (element, transform, hidden) => {
    const before = last.get(element);
    if (before?.transform !== transform) element.style.transform = transform;
    if (before?.hidden !== hidden) element.classList.toggle('is-hidden', hidden);
    last.set(element, { transform, hidden });
  };
  function placePins() {
    if (!atlas) return;
    const { view, routes } = atlas;
    const key = `${view.elevation.toFixed(4)}|${view.lean.toFixed(4)}|${view.intro > .5}|${focus}|${routes.filter(route => route.shown > .6).length}|${stageSize.w}x${stageSize.h}`;
    if (key === placed) return;
    placed = key;
    const { w: width, h: height } = stageSize;
    boxes.length = 0;
    const place = (x, y, w, priority) => {
      // Right of the point, or left of it near the right edge.
      const left = x + 12 + w > width - 8 ? x - 12 - w : x + 12;
      const box = [left - 4, y - 11, left + w + 4, y + 11];
      const clear = box[0] > 4 && box[2] < width - 4 && box[1] > 4 && box[3] < height - 4 && !boxes.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
      if (clear || priority) boxes.push(box);
      return { transform: `translate3d(${left.toFixed(1)}px,${(y - 11).toFixed(1)}px,0)`, shown: clear || priority };
    };
    const origin = atlas.screen(-1), home = place(origin.x, origin.y, homeWidth, true);
    set(homePin, home.transform, view.intro < .5);
    const order = journeys.map((_, i) => i).sort((a, b) => (b === focus) - (a === focus) || journeys[b].km - journeys[a].km);
    for (const i of order) {
      const p = atlas.screen(i), landed = routes[i].shown > .6;
      const spot = landed ? place(p.x, p.y, widths[i], i === focus) : { transform: last.get(pins[i])?.transform ?? '', shown: false };
      set(pins[i], spot.transform, !spot.shown);
    }
  }

  // -------------------------------------------------------- the photographs
  const moments = $('[data-india-moments]'), strip = $('[data-india-strip]');
  const cleanups = [];
  let lightbox = null;
  if (photographs.length) {
    moments.hidden = false;
    $('[data-moments-count]').textContent = `${two(photographs.length)} ${photographs.length === 1 ? 'handover' : 'handovers'}`;
    strip.innerHTML = handovers.map(delivery => `<li><a class="india-moment" href="${escapeHTML(safeImage(delivery.photo))}" data-photo="${delivery.index}" data-journey="${delivery.journey}" target="_blank" rel="noopener">
        <img src="${escapeHTML(thumbImage(delivery.photo))}" alt="${escapeHTML(delivery.caption || `A Baba Luxury Cars handover${delivery.city ? ` in ${delivery.city}` : ''}`)}" loading="lazy" decoding="async" draggable="false" />
        <span class="india-moment-copy"><b>${escapeHTML(delivery.city || 'A new owner')}</b>${delivery.caption ? `<small>${escapeHTML(delivery.caption)}</small>` : ''}</span>
      </a></li>`).join('');
    strip.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { const full = safeImage(photographs[Number(image.closest('[data-photo]').dataset.photo)].photo); if (image.src !== full) image.src = full; }, { once: true }));
    lightbox = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      bgOpacity: .97, showHideAnimationType: 'fade', showAnimationDuration: reduced ? 0 : 350, hideAnimationDuration: reduced ? 0 : 300,
      wheelToZoom: true, loop: false,
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
    lightbox.init();
    // PhotoSwipe fits and zooms by the real dimensions; read them on opening.
    const sizes = new Map();
    const dimensions = i => {
      if (!sizes.has(i)) sizes.set(i, new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve({ src: image.src, width: image.naturalWidth, height: image.naturalHeight, alt: handovers[i].caption || '', caption: [handovers[i].city, handovers[i].caption].filter(Boolean).join(' · ') });
        image.onerror = () => { sizes.delete(i); resolve(null); };
        image.src = safeImage(photographs[i].photo);
      }));
      return sizes.get(i);
    };
    // A drag scrolls the strip with a fine pointer; a click opens the photograph.
    let drag = null, dragged = false;
    strip.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, left: strip.scrollLeft }; dragged = false;
    });
    const onDrag = event => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (!dragged && Math.abs(dx) > 6) { dragged = true; strip.classList.add('is-dragging'); }
      if (dragged) strip.scrollLeft = drag.left - dx;
    };
    const onDrop = () => { if (!drag) return; drag = null; strip.classList.remove('is-dragging'); };
    addEventListener('pointermove', onDrag); addEventListener('pointerup', onDrop);
    cleanups.push(() => { removeEventListener('pointermove', onDrag); removeEventListener('pointerup', onDrop); });
    strip.addEventListener('click', async event => {
      const card = event.target.closest('[data-photo]');
      if (!card) return;
      if (dragged) { event.preventDefault(); dragged = false; return; }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const index = Number(card.dataset.photo);
      const data = await Promise.all(photographs.map((_, i) => dimensions(i)));
      if (!data[index]) { window.open(card.href, '_blank', 'noopener'); return; }
      lightbox.loadAndOpen(data.slice(0, index).filter(Boolean).length, data.filter(Boolean));
    });
    strip.addEventListener('pointerover', event => { const card = event.target.closest('[data-journey]'); if (card && event.pointerType !== 'touch') hover(Number(card.dataset.journey)); });
    strip.addEventListener('pointerleave', () => hover(-1));
    const step = direction => { const card = strip.querySelector('li'); strip.scrollBy({ left: direction * (card ? card.offsetWidth + 16 : 300) * Math.max(1, Math.floor(strip.clientWidth / ((card?.offsetWidth || 300) + 16))), behavior: reduced ? 'instant' : 'smooth' }); };
    $('[data-moments-prev]').addEventListener('click', () => step(-1));
    $('[data-moments-next]').addEventListener('click', () => step(1));
    const track = moments.querySelector('.india-strip-track');
    const onStrip = () => {
      const room = strip.scrollWidth - strip.clientWidth;
      track.style.setProperty('--strip', room > 0 ? (strip.scrollLeft / room).toFixed(3) : '1');
      track.style.setProperty('--strip-size', room > 0 ? (strip.clientWidth / strip.scrollWidth).toFixed(3) : '1');
      moments.classList.toggle('is-scrollable', room > 1);
    };
    strip.addEventListener('scroll', onStrip, { passive: true });
    new ResizeObserver(onStrip).observe(strip);
    onStrip();
  }

  // ----------------------------------------------------------------- motion
  const lines = section.querySelectorAll('.india-line > span');
  const reveal = section.querySelectorAll('[data-india-reveal], .india-stats > div, .india-moments');
  let entered = reduced, atlasIntro = null, lean = null;
  if (!reduced) {
    gsap.set(lines, { yPercent: 108 });
    gsap.set([...reveal, ...items], { autoAlpha: 0, y: 16 });
    counters.forEach(counter => { counter.textContent = '0'; });
    ScrollTrigger.create({
      trigger: section, start: 'top 72%', once: true,
      onEnter: () => {
        entered = true;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .to(lines, { yPercent: 0, duration: 1.5, stagger: .1 }, 0)
          .to(reveal, { autoAlpha: 1, y: 0, duration: 1.2, stagger: .07, clearProps: 'transform' }, .2)
          .to(items, { autoAlpha: 1, y: 0, duration: 1, stagger: .035, clearProps: 'transform' }, .55);
        counters.forEach((counter, i) => gsap.to({ v: 0 }, { v: Number(counter.dataset.count), duration: 2.2, delay: .6 + i * .12, ease: 'power3.out', onUpdate() { counter.textContent = grouping.format(Math.round(this.targets()[0].v)); } }));
        playAtlas();
      },
    });
  }
  // The atlas assembles once, when the section is first in view (or at once,
  // if it arrives after that); each name appears as its route lands.
  function playAtlas() {
    if (!atlas || atlasIntro) return;
    atlasIntro = atlas.intro();
  }

  // ------------------------------------------------------------- the atlas
  let disposeAtlas = () => {}, visible = false, disposed = false;
  const watcher = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; atlas?.loop(visible); });
  watcher.observe(stage);
  const onVisibility = () => atlas?.loop(visible && !document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  if ('WebGL2RenderingContext' in window) {
    import('./india-atlas.js').then(({ createAtlas }) => {
      if (disposed) return;
      atlas = createAtlas(canvas, { origin: ORIGIN.at, destinations: journeys, reduced });
      const off = atlas.onRender(placePins);
      document.fonts.ready.then(() => { measurePins(); atlas?.request(); });
      measurePins();
      section.classList.add('has-atlas');
      if (entered) playAtlas();
      // The atlas leans a few degrees as the page scrolls past it.
      if (!reduced) lean = gsap.fromTo(atlas.view, { lean: -.075 }, { lean: .075, ease: 'none', onUpdate: atlas.request, scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: .9 } });
      atlas.loop(visible);
      focus = -2; setFocus();
      disposeAtlas = () => { off(); lean?.scrollTrigger?.kill(); lean?.kill(); atlasIntro?.kill(); atlas.dispose(); atlas = null; };
    }).catch(error => { atlas = null; section.classList.remove('has-atlas'); console.error('The atlas is unavailable; keeping the map.', error); });
  }
  const resizer = new ResizeObserver(() => { measurePins(); atlas?.request(); });
  resizer.observe(stage);

  if (import.meta.env.DEV) window.__india = {
    journeys: () => journeys.map(j => ({ name: j.name, km: Math.round(j.km), photo: Boolean(j.photo), local: j.local.length })),
    state: () => ({ atlas: Boolean(atlas), entered, focus, selected, hovered, view: atlas ? { elevation: atlas.view.elevation, lean: atlas.view.lean, reveal: atlas.view.reveal, intro: atlas.view.intro } : null, pins: pins.filter(pin => !pin.classList.contains('is-hidden')).length, shown: atlas?.routes.map(route => +route.shown.toFixed(2)) }),
    choose,
  };
  return {
    refresh: () => atlas?.request(),
    dispose() {
      disposed = true; disposeAtlas(); watcher.disconnect(); resizer.disconnect(); lightbox?.destroy(); cleanups.forEach(cleanup => cleanup());
      document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
