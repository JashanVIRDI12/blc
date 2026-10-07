// A scroll-led atlas: the country expands, routes unfurl, and real handover
// photographs tell the journeys. Every camera movement follows the scroll.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { dots, project as geo } from './india-map.js';
import { ORIGIN, findPlace, readPlaces, stateCode } from './places.js';
import { carName, carURL, cover, FOR_SALE } from './data.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
import { createJourneyGallery } from './journey-gallery.js';
gsap.registerPlugin(ScrollTrigger);

const RAW = [...dots.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map(m => [Number(m[1]), Number(m[2])]);
const N = RAW.length;
const CX = RAW.reduce((s, [x]) => s + x, 0) / N, CY = RAW.reduce((s, [, y]) => s + y, 0) / N;
const PX = new Float32Array(N), PY = new Float32Array(N);
RAW.forEach(([x, y], i) => { PX[i] = x - CX; PY[i] = y - CY; });
const HULL = Array.from({ length: 48 }, (_, s) => {
  const a = s / 48 * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
  let best = 0;
  for (let i = 1; i < N; i++) if (PX[i] * c + PY[i] * si > PX[best] * c + PY[best] * si) best = i;
  return [PX[best], PY[best], 0];
});
const D = 1900, TILT = .48, EXPANDED = 1.2;
const GOLD = '213,178,123', IVORY = '224,215,196';
const grouping = new Intl.NumberFormat('en-IN');
const km = ([lat1, lng1], [lat2, lng2]) => {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};
const samePlace = (a, b) => a && b && km(a.at, b.at) < 1;

export function createAcrossIndia(section, { settings, deliveries = [], cars = [], reduced = false }) {
  const map = section.querySelector('.india-map-stage');
  const canvas = section.querySelector('[data-india-canvas]');
  const card = section.querySelector('[data-india-card]');
  const select = section.querySelector('[data-india-select]');
  const status = section.querySelector('[data-india-status]');
  const storyElement = section.querySelector('.india-story');
  const phase = section.querySelector('[data-india-phase]');
  const ctx = canvas.getContext('2d');
  const india = settings.india || {};
  section.querySelector('[data-india-intro]').textContent = india.intro || '';

  const { places } = readPlaces(india.places);
  const photographs = deliveries.filter(delivery => safeImage(delivery.photo));
  const handovers = photographs.map(delivery => ({ ...delivery, place: findPlace(delivery.city) })).filter(delivery => delivery.place);
  for (const delivery of handovers) {
    if (!places.some(place => samePlace(place, delivery.place))) places.push(delivery.place);
  }
  const [gx, gy] = geo(ORIGIN.at), OX = gx - CX, OY = gy - CY;
  const PD = Float32Array.from(PX, (x, i) => Math.hypot(x - OX, PY[i] - OY));
  const revealEnd = Math.max(...PD) + 140;
  const stock = cars.filter(car => !car.preview && car.status !== 'hidden');
  // A state registration is useful context, not evidence that a particular
  // car was delivered to this city. Delivery photos match actual places.
  const journeys = places.filter((place, i) => places.findIndex(other => samePlace(other, place)) === i).map(place => {
    const [x, y] = geo(place.at), code = stateCode(place.name);
    const photo = handovers.find(delivery => samePlace(delivery.place, place));
    const local = code ? stock.filter(car => String(car.registration).trim().toUpperCase().startsWith(code)).sort((a, b) => FOR_SALE.includes(b.status) - FOR_SALE.includes(a.status)) : [];
    return { name: photo?.place.name || place.name, km: km(ORIGIN.at, place.at), photo, local, code, X: x - CX, Y: y - CY };
  }).filter(j => j.km >= 60).sort((a, b) => a.km - b.km);
  journeys.forEach(j => {
    const length = Math.hypot(j.X - OX, j.Y - OY), lift = 22 + length * .24;
    j.samples = Array.from({ length: 49 }, (_, s) => {
      const t = s / 48;
      return [OX + (j.X - OX) * t, OY + (j.Y - OY) * t, Math.sin(Math.PI * t) * lift];
    });
    Object.assign(j, { screen: new Float32Array(98), base: [0, 0], top: [0, 0], draw: reduced ? 1 : 0, pillar: reduced ? 1 : 0 });
  });
  section.querySelector('[data-india-list]').innerHTML = journeys.map(j => `<li>${escapeHTML(j.name)}, approximately ${grouping.format(Math.round(j.km))} km from Paschim Vihar</li>`).join('');
  select.innerHTML = '<option value="">Choose a destination</option>' + journeys.map((j, i) => `<option value="${i}">${escapeHTML(j.name)}</option>`).join('');
  select.disabled = !journeys.length;

  let narrativePhoto = 0, manualPhoto = null, manualAt = 0, storyActive = -1, activeAt = 0;
  const journeyForPhoto = index => {
    const place = findPlace(photographs[index]?.city);
    return place ? journeys.findIndex(j => samePlace(findPlace(j.name), place)) : -1;
  };
  const gallery = createJourneyGallery(section.querySelector('[data-india-gallery]'), {
    deliveries: photographs, reduced,
    onSelect(index, delivery) {
      manualPhoto = index; manualAt = view.progress; storyActive = journeyForPhoto(index);
      selected = -1; select.value = ''; showCard(-1);
      status.textContent = `Delivery photograph ${index + 1} of ${photographs.length}. ${delivery.city || 'A new owner'}. ${delivery.caption || ''}`;
      requestDraw();
    },
  });
  section.classList.toggle('has-no-photos', !gallery.count);
  storyActive = journeyForPhoto(0);

  const sold = stock.filter(car => car.status === 'sold').length;
  const onSale = stock.filter(car => FOR_SALE.includes(car.status)).length;
  const delivered = Number(String(india.delivered || '').replace(/[^\d]/g, '')) || 0;
  const stats = [
    [journeys.length + 1, 'Cities and states'],
    ...(delivered ? [[delivered, 'Cars delivered', /\+\s*$/.test(String(india.delivered)) ? '+' : '']] : sold ? [[sold, 'Recently delivered']] : []),
    ...(onSale ? [[onSale, 'On sale today']] : []),
  ];
  section.querySelector('[data-india-stats]').innerHTML = stats.map(([value, label, suffix = '']) => `<div><dt>${label}</dt><dd><span data-count="${value}">${reduced ? grouping.format(value) : 0}</span>${suffix}</dd></div>`).join('');

  const cardPhoto = card.querySelector('[data-card-photo]'), cardKicker = card.querySelector('[data-card-kicker]');
  const cardName = card.querySelector('[data-card-name]'), cardMeta = card.querySelector('[data-card-meta]');
  const cardCaption = card.querySelector('[data-card-caption]'), cardCar = card.querySelector('[data-card-car]');
  const close = card.querySelector('[data-card-close]');
  let active = -1, selected = -1, closeTimer;
  function showCard(i) {
    clearTimeout(closeTimer);
    if (i === active) return;
    active = i;
    activeAt = view.progress;
    card.inert = i < 0;
    card.setAttribute('aria-hidden', String(i < 0));
    card.classList.toggle('is-visible', i >= 0);
    if (i < 0) { gallery.show(manualPhoto ?? narrativePhoto); requestDraw(); return; }
    const j = journeys[i], car = j.local[0];
    if (j.photo) gallery.show(photographs.findIndex(photo => photo.photo === j.photo.photo));
    const image = j.photo ? thumbImage(j.photo.photo) : car ? thumbImage(cover(car)) : '';
    card.classList.toggle('has-photo', Boolean(image));
    card.classList.toggle('is-handover', Boolean(j.photo));
    if (image) cardPhoto.src = image;
    else cardPhoto.removeAttribute('src');
    cardPhoto.alt = j.photo ? (j.photo.caption || `A Baba Luxury Cars handover in ${j.name}`) : car ? carName(car) : '';
    cardKicker.textContent = j.photo ? 'Delivered here' : car ? `Registered in ${j.code}` : 'Our reach';
    cardName.textContent = j.name;
    cardMeta.textContent = `Approx. ${grouping.format(Math.round(j.km))} km from Paschim Vihar`;
    cardMeta.title = 'Straight-line distance';
    cardCaption.textContent = j.photo?.caption || '';
    cardCar.hidden = !car;
    if (car) {
      cardCar.href = carURL(car);
      cardCar.textContent = `${carName(car)} · ${FOR_SALE.includes(car.status) ? 'View car' : 'Sold'} ↗`;
      cardCar.title = `Registered in ${j.code}`;
    } else cardCar.removeAttribute('href');
    placeCard();
    requestDraw();
  }
  function placeCard() {
    if (active < 0) return;
    const j = journeys[active], x = j.base[0] / dpr, y = j.base[1] / dpr;
    const width = card.offsetWidth, height = card.offsetHeight, gap = 18, inset = 10;
    let left = x + gap;
    if (left + width > map.clientWidth - inset) left = x - width - gap;
    card.style.left = `${Math.max(inset, Math.min(left, map.clientWidth - width - inset))}px`;
    card.style.top = `${Math.max(inset, Math.min(y - height * .45, map.clientHeight - height - inset))}px`;
  }

  const view = { tilt: reduced ? TILT : .02, reveal: reduced ? revealEnd : 0, zoom: reduced ? EXPANDED : .64, turn: reduced ? 0 : -.1, progress: reduced ? 1 : 0 };
  let dpr = 1, cw = 1, ch = 1, small = false, pending = 0, disposed = false;
  let ct = 1, st = 0, cr = 1, sr = 0, k = 1, ox = 0, oy = 0, measuring = false;
  const P = [0, 0, 0], labels = [];
  const project = (X, Y, Z) => {
    const xs = X * cr + Z * sr, zs = Z * cr - X * sr;
    const ys = Y * ct - zs * st, depth = -Y * st - zs * ct, f = D / (D + depth);
    const scale = k * (measuring ? 1 : view.zoom);
    P[0] = ox + xs * f * scale; P[1] = oy + ys * f * scale; P[2] = f;
    return P;
  };
  // Fit the complete camera envelope once. Expansion is intentional and
  // monotonic, rather than a side effect of refitting each animation frame.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    small = rect.width < 600;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cw = canvas.width = Math.max(1, Math.round(rect.width * dpr));
    ch = canvas.height = Math.max(1, Math.round(rect.height * dpr));
    k = 1; ox = oy = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const bounds = [...HULL, [OX, OY, 72], ...journeys.flatMap(j => [[j.X, j.Y, 30], ...j.samples])];
    measuring = true;
    for (let step = 0; step <= 4; step++) {
      ct = Math.cos(TILT * step / 4); st = Math.sin(TILT * step / 4);
      cr = Math.cos(-.1 * (1 - step / 4)); sr = Math.sin(-.1 * (1 - step / 4));
      for (const point of bounds) {
        const [x, y] = project(...point);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    measuring = false;
    const padX = cw * .05, padY = ch * .1;
    k = Math.min((cw - padX * 2) / (x1 - x0), (ch - padY * 2) / (y1 - y0));
    ox = cw / 2 - (x0 + x1) / 2 * k;
    oy = ch / 2 - (y0 + y1) / 2 * k;
    requestDraw();
  }
  function requestDraw() {
    if (!disposed && !pending) pending = requestAnimationFrame(frame);
  }
  const BUCKETS = 6, bucket = Array.from({ length: BUCKETS }, () => new Float32Array(N * 3)), counts = new Int32Array(BUCKETS);
  function frame() {
    pending = 0;
    ct = Math.cos(view.tilt); st = Math.sin(view.tilt);
    cr = Math.cos(view.turn); sr = Math.sin(view.turn);
    ctx.clearRect(0, 0, cw, ch);
    counts.fill(0);
    const radius = Math.max(.85 * dpr, 1.5 * k * view.zoom);
    for (let i = 0; i < N; i++) {
      const fade = .22 + .78 * gsap.utils.clamp(0, 1, (view.reveal - PD[i]) / 140);
      const [x, y, f] = project(PX[i], PY[i], 0);
      const alpha = (.34 + .16 * gsap.utils.clamp(0, 1, (f - .8) / .5)) * fade;
      const b = Math.min(BUCKETS - 1, Math.floor(alpha / .55 * BUCKETS)), o = counts[b]++ * 3;
      bucket[b][o] = x; bucket[b][o + 1] = y; bucket[b][o + 2] = radius * f;
    }
    for (let b = 0; b < BUCKETS; b++) {
      if (!counts[b]) continue;
      ctx.fillStyle = `rgba(${IVORY},${(b + .5) / BUCKETS * .55})`;
      ctx.beginPath();
      for (let c = 0; c < counts[b]; c++) {
        const o = c * 3, x = bucket[b][o], y = bucket[b][o + 1], r = bucket[b][o + 2];
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    journeys.forEach((j, i) => {
      const [bx, by] = project(j.X, j.Y, 0);
      j.base[0] = bx; j.base[1] = by;
      const focus = active >= 0 ? active : storyActive;
      const on = i === focus, draw = i === active ? 1 : j.draw, pillar = i === active ? 1 : j.pillar;
      if (draw <= 0) return;
      for (let s = 0; s < 49; s++) {
        const [x, y] = project(...j.samples[s]); j.screen[s * 2] = x; j.screen[s * 2 + 1] = y;
      }
      const end = draw * 48;
      ctx.beginPath(); ctx.moveTo(j.screen[0], j.screen[1]);
      for (let s = 1; s <= Math.floor(end); s++) ctx.lineTo(j.screen[s * 2], j.screen[s * 2 + 1]);
      if (end % 1) {
        const s = Math.floor(end), f = end - s;
        ctx.lineTo(j.screen[s * 2] + (j.screen[s * 2 + 2] - j.screen[s * 2]) * f, j.screen[s * 2 + 1] + (j.screen[s * 2 + 3] - j.screen[s * 2 + 1]) * f);
      }
      ctx.strokeStyle = `rgba(${GOLD},${on ? .95 : active >= 0 ? .18 : .42})`;
      ctx.lineWidth = (on ? 1.65 : .85) * dpr; ctx.stroke();
      if (draw < 1) {
        const sample = Math.min(48, Math.floor(end));
        dot(j.screen[sample * 2], j.screen[sample * 2 + 1], 1.5 * dpr, `rgba(${IVORY},.85)`);
      }
      if (pillar <= 0) return;
      const [tx, ty] = project(j.X, j.Y, 30 * pillar);
      j.top[0] = tx; j.top[1] = ty;
      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, `rgba(${GOLD},${.75 * pillar})`); g.addColorStop(1, `rgba(${GOLD},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      glowAt(bx, by, on ? 15 : 8, (on ? .4 : .2) * pillar);
      dot(bx, by, (on ? 3 : 2.3) * dpr, `rgba(${GOLD},${pillar})`);
    });
    const show = .3 + .7 * Math.min(1, view.reveal / 300);
    const [bx, by] = project(OX, OY, 0), [tx, ty] = project(OX, OY, 72);
    ctx.strokeStyle = `rgba(${GOLD},${show * .6})`; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    glowAt(bx, by, 17, .45 * show);
    dot(bx, by, 3.2 * dpr, `rgba(${GOLD},${show})`);
    labels.length = 0;
    const focus = active >= 0 ? active : storyActive;
    if (focus >= 0 && journeys[focus].pillar > .5) label(journeys[focus].name.toUpperCase(), ...journeys[focus].top, `rgb(${GOLD})`, focus);
    label('PASCHIM VIHAR', tx, ty, `rgba(${IVORY},${show})`, -1);
    // Every destination gets a chance at a label; the selector also reaches
    // crowded northern cities whose labels cannot fit beside one another.
    [...journeys.keys()].reverse().forEach(i => {
      const j = journeys[i];
      if (i !== focus && j.pillar > .5) label(j.name.toUpperCase(), ...j.top, `rgba(${IVORY},${(active >= 0 ? .3 : .7) * (j.pillar - .5) * 2})`, i);
    });
    placeCard();
  }
  function glowAt(x, y, radius, alpha) {
    const r = radius * dpr, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${GOLD},${alpha})`); g.addColorStop(1, `rgba(${GOLD},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function dot(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function label(text, x, y, color, index) {
    const size = (small ? 8.5 : 10.5) * dpr, gap = 9 * dpr;
    ctx.font = `600 ${size}px Manrope, system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(small ? .8 : 1.4) * dpr}px`;
    const width = ctx.measureText(text).width;
    const tries = x > cw * .6 ? [x - gap - width, x + gap] : [x + gap, x - gap - width];
    for (const tx of tries) {
      const box = [tx - 3 * dpr, y - size, tx + width + 3 * dpr, y + size];
      if (box[0] < 4 * dpr || box[2] > cw - 4 * dpr || labels.some(({ box: o }) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      labels.push({ index, box });
      ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, tx, y); break;
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function hit(event) {
    const r = canvas.getBoundingClientRect(), x = (event.clientX - r.left) * dpr, y = (event.clientY - r.top) * dpr;
    let best = -1, nearest = (event.pointerType === 'touch' ? 26 : 19) * dpr;
    journeys.forEach((j, i) => {
      const distance = Math.hypot(j.base[0] - x, j.base[1] - y);
      if (j.pillar > .5 && distance < nearest) { best = i; nearest = distance; }
    });
    if (best >= 0) return best;
    return labels.find(({ index, box: b }) => index >= 0 && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])?.index ?? -1;
  }
  const onMove = event => {
    if (event.pointerType === 'touch') return;
    const i = hit(event);
    canvas.style.cursor = i >= 0 ? 'pointer' : '';
    if (i >= 0) showCard(i);
    else scheduleClose();
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!card.matches(':hover') && !card.contains(document.activeElement)) showCard(selected); }, 180);
  };
  const choose = i => {
    selected = i; select.value = i < 0 ? '' : String(i); showCard(i);
    status.textContent = i < 0 ? 'Destination details closed.' : `${journeys[i].name}. ${cardMeta.textContent}. ${cardKicker.textContent}. ${cardCaption.textContent}`;
  };
  const onTap = event => { const i = hit(event); choose(i === selected ? -1 : i); };
  const onSelect = () => choose(select.value === '' ? -1 : Number(select.value));
  const dismiss = () => { if (card.contains(document.activeElement)) select.focus({ preventScroll: true }); choose(-1); };
  const onKey = event => { if (event.key === 'Escape' && active >= 0 && !document.querySelector('.pswp--open')) { event.preventDefault(); dismiss(); } };
  const holdCard = () => clearTimeout(closeTimer);
  const onPhotoError = () => card.classList.remove('has-photo');
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', scheduleClose);
  canvas.addEventListener('click', onTap);
  card.addEventListener('pointerenter', holdCard);
  card.addEventListener('pointerleave', scheduleClose);
  card.addEventListener('focusout', scheduleClose);
  close.addEventListener('click', dismiss);
  select.addEventListener('change', onSelect);
  document.addEventListener('keydown', onKey);
  cardPhoto.addEventListener('error', onPhotoError);

  let story, intro;
  const desktop = matchMedia('(min-width: 1001px) and (min-height: 800px)');
  const copy = section.querySelectorAll('.india-copy > :not(.sr-only)');
  function updateStory() {
    if (manualPhoto !== null && Math.abs(view.progress - manualAt) > .04) manualPhoto = null;
    if (active >= 0 && selected < 0 && Math.abs(view.progress - activeAt) > .03) showCard(-1);
    if (!reduced && photographs.length) narrativePhoto = Math.min(photographs.length - 1, Math.floor(gsap.utils.clamp(0, .99999, (view.progress - .32) / .64) * photographs.length));
    storyActive = journeyForPhoto(manualPhoto ?? narrativePhoto);
    if (active < 0) gallery.show(manualPhoto ?? narrativePhoto);
    phase.textContent = reduced ? 'Pan-India delivery' : view.progress < .3 ? 'Scroll to explore' : view.progress < .72 ? 'The journeys unfold' : 'Explore the destinations';
    section.style.setProperty('--journey-progress', `${view.progress * 100}%`);
    requestDraw();
  }
  function motion() {
    story?.scrollTrigger?.kill(); story?.kill();
    intro?.scrollTrigger?.kill(); intro?.kill();
    story = intro = null;
    if (reduced) {
      Object.assign(view, { reveal: revealEnd, tilt: TILT, zoom: EXPANDED, turn: 0, progress: 1 });
      journeys.forEach(j => Object.assign(j, { draw: 1, pillar: 1 }));
      gsap.set(copy, { clearProps: 'opacity,visibility,transform' });
      section.querySelectorAll('[data-count]').forEach(count => { count.textContent = grouping.format(Number(count.dataset.count)); });
    } else {
      // Desktop holds the complete composition while the story unfolds.
      // Smaller screens retain native scrolling and an accessible gallery.
      story = gsap.timeline({ onUpdate: updateStory, scrollTrigger: {
        trigger: section, start: desktop.matches ? 'top top' : 'top 70%',
        end: desktop.matches ? () => `+=${innerHeight * Math.max(2.1, Math.min(3.5, photographs.length * .7))}` : 'clamp(bottom 85%)',
        pin: desktop.matches ? storyElement : false, anticipatePin: 1,
        scrub: .85, invalidateOnRefresh: true,
      } })
        .fromTo(view, { progress: 0 }, { progress: 1, duration: 1, ease: 'none' }, 0)
        .fromTo(view, { reveal: 0 }, { reveal: revealEnd, duration: .4, ease: 'power1.out' }, 0)
        .fromTo(view, { zoom: .64 }, { zoom: EXPANDED, duration: .7, ease: 'sine.inOut' }, .02)
        .fromTo(view, { turn: -.1 }, { turn: 0, duration: .65, ease: 'sine.inOut' }, .04)
        .fromTo(view, { tilt: .02 }, { tilt: TILT, duration: .65, ease: 'sine.inOut' }, .04);
      journeys.forEach((j, i) => {
        const offset = journeys.length > 1 ? i / (journeys.length - 1) * .18 : 0;
        story.fromTo(j, { draw: 0 }, { draw: 1, duration: .35, ease: 'sine.inOut' }, .2 + offset)
          .fromTo(j, { pillar: 0 }, { pillar: 1, duration: .18, ease: 'sine.out' }, .43 + offset);
      });
      intro = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 78%', once: true } })
        .fromTo(copy, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .9, stagger: .07, ease: 'power2.out' });
      section.querySelectorAll('[data-count]').forEach(count => intro.to({ v: 0 }, { v: Number(count.dataset.count), duration: 1.6, ease: 'power2.out', onUpdate() { count.textContent = grouping.format(Math.round(this.targets()[0].v)); } }, .2));
    }
    updateStory();
  }
  const resizer = new ResizeObserver(resize), cardResizer = new ResizeObserver(placeCard);
  resizer.observe(canvas); cardResizer.observe(card);
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => { reduced = motionQuery.matches; gallery.setReduced?.(reduced); motion(); ScrollTrigger.refresh(); };
  motionQuery.addEventListener('change', onMotion);
  desktop.addEventListener('change', onMotion);
  document.fonts.ready.then(() => requestDraw());
  resize(); motion();
  if (import.meta.env.DEV) window.__india = {
    journeys: () => journeys.map(j => ({ name: j.name, base: j.base.map(v => v / dpr), local: j.local.length, photo: Boolean(j.photo) })),
    state: () => ({ tilt: view.tilt, zoom: view.zoom, turn: view.turn, reveal: view.reveal, active, selected, storyActive, photo: gallery.index, photos: gallery.count, reduced, pinned: Boolean(story?.scrollTrigger?.isActive && desktop.matches), settled: journeys.every(j => j.draw === 1 && j.pillar === 1), progress: story?.progress() ?? 1, start: story?.scrollTrigger?.start, end: story?.scrollTrigger?.end }),
  };
  return {
    refresh: resize,
    dispose() {
      disposed = true; cancelAnimationFrame(pending); clearTimeout(closeTimer);
      resizer.disconnect(); cardResizer.disconnect();
      story?.scrollTrigger?.kill(); story?.kill(); intro?.scrollTrigger?.kill(); intro?.kill();
      motionQuery.removeEventListener('change', onMotion);
      desktop.removeEventListener('change', onMotion); gallery.dispose();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', scheduleClose); canvas.removeEventListener('click', onTap);
      card.removeEventListener('pointerenter', holdCard); card.removeEventListener('pointerleave', scheduleClose); card.removeEventListener('focusout', scheduleClose);
      close.removeEventListener('click', dismiss); select.removeEventListener('change', onSelect); document.removeEventListener('keydown', onKey); cardPhoto.removeEventListener('error', onPhotoError);
    },
  };
}
