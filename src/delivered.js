// "Now with their new owners": the cars sold and the handover photographs on
// a carousel in three dimensions, a ring of cards seen from inside its front
// (after Codrops' cylinder scroll grids and React Bits' Circular Gallery,
// rebuilt here in CSS 3D and GSAP). The card at the front stands in full
// colour with its details; the rest curve away in monochrome. On a computer
// the section pins and the scroll turns the ring, settling each car at the
// front; it can also be dragged, everywhere, and on touch screens it drifts
// slowly on its own. Turning fast bends the ring back a little. A card that
// isn't at the front comes round to it when chosen; at the front it opens the
// car. An odometer counts the cars handed over.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import { carURL, cover } from './data.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
gsap.registerPlugin(ScrollTrigger, Observer);

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

export function createDelivered(section, { sold, deliveries, reduced = false }) {
  const stage = section.querySelector('[data-sold-stage]');
  const ring = section.querySelector('[data-sold-ring]');
  const progress = section.querySelector('[data-sold-progress]');
  const index = section.querySelector('[data-sold-index]');
  const count = section.querySelector('[data-sold-count]');

  // The cars, newest sale first, with a handover photograph after every
  // third; a short list repeats, so the ring is never sparse.
  const items = [];
  let d = 0;
  sold.forEach((car, i) => { items.push({ car }); if ((i + 1) % 3 === 0 && d < deliveries.length) items.push({ delivery: deliveries[d++] }); });
  while (d < deliveries.length) items.push({ delivery: deliveries[d++] });
  const real = items.length;
  while (items.length < 10 && real) items.push({ ...items[items.length % real], copy: true });
  const n = items.length;

  ring.innerHTML = items.map((item, i) => {
    const copy = item.copy ? ' aria-hidden="true" tabindex="-1"' : '';
    if (item.car) {
      const car = item.car, when = car.soldAt ? MONTH.format(new Date(car.soldAt)) : '';
      return `<li class="ds-card" data-i="${i}"><a class="ds-link" href="${carURL(car)}"${copy}><span class="ds-photo"><img src="${escapeHTML(thumbImage(cover(car)))}" data-full="${escapeHTML(safeImage(cover(car)))}" alt="" loading="lazy" decoding="async" draggable="false" /></span>
        <span class="ds-meta"><small>${escapeHTML(car.make)}</small><b>${escapeHTML(car.model)}</b><span>${escapeHTML([car.year, car.fuel].filter(Boolean).join(' · '))}</span><em><i aria-hidden="true"></i>Handed over${when ? ` · ${escapeHTML(when)}` : ''}</em></span></a></li>`;
    }
    const delivery = item.delivery;
    return `<li class="ds-card ds-card--delivery" data-i="${i}"><figure class="ds-link"${copy}><span class="ds-photo"><img src="${escapeHTML(thumbImage(delivery.photo))}" data-full="${escapeHTML(safeImage(delivery.photo))}" alt="${escapeHTML(delivery.caption || `A Baba Luxury Cars handover${delivery.city ? ` in ${delivery.city}` : ''}`)}" loading="lazy" decoding="async" draggable="false" /></span>
      <figcaption class="ds-meta"><small>Delivered to</small><b>${escapeHTML(delivery.city || 'A new owner')}</b>${delivery.caption ? `<span>${escapeHTML(delivery.caption)}</span>` : ''}<em><i aria-hidden="true"></i>The keys, handed over</em></figcaption></figure></li>`;
  }).join('');
  ring.querySelectorAll('img[data-full]').forEach(img => img.addEventListener('error', () => { if (img.getAttribute('src') !== img.dataset.full) img.src = img.dataset.full; }, { once: true }));
  const cards = [...ring.children];

  // The odometer: the count rolls up the first time it is seen.
  const total = sold.length;
  count.textContent = reduced ? total : 0;
  if (!reduced) ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => gsap.to({ v: 0 }, { v: total, duration: 2.2, ease: 'power3.out', onUpdate() { count.textContent = Math.round(this.targets()[0].v); } }) });

  if (reduced) { section.classList.add('is-flat'); return { dispose() {} }; }
  section.classList.add('is-ring');

  // ---------------------------------------------------------- the ring
  const step = 360 / n;
  let radius = 0, turn = 0, drag = 0, tilt = 0, front = -1, dirty = true;
  const measure = () => {
    const width = cards[0].offsetWidth;
    radius = (width * 1.16 * n) / (2 * Math.PI);
    cards.forEach((card, i) => { card.style.transform = `rotateY(${i * step}deg) translateZ(${radius.toFixed(1)}px)`; });
    dirty = true;
  };
  const wrap = a => ((a % 360) + 540) % 360 - 180;
  function draw() {
    if (!dirty) return;
    dirty = false;
    const angle = turn + drag;
    ring.style.transform = `translateZ(${(-radius).toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) rotateY(${angle.toFixed(3)}deg)`;
    let nearest = 0, best = 999;
    cards.forEach((card, i) => {
      const a = Math.abs(wrap(i * step + angle));
      if (a < best) { best = a; nearest = i; }
      const tone = Math.max(0, 1 - a / 75), focus = Math.max(0, 1 - a / (step * .85));
      card.style.setProperty('--tone', tone.toFixed(3));
      card.style.setProperty('--focus', focus.toFixed(3));
      card.style.visibility = a > 100 ? 'hidden' : '';
    });
    if (nearest !== front) {
      front = nearest;
      cards.forEach((card, i) => card.classList.toggle('is-front', i === front));
      const shown = front % real;
      index.textContent = `${String(shown + 1).padStart(2, '0')} / ${String(real).padStart(2, '0')}`;
      progress.style.transform = `scaleX(${real > 1 ? shown / (real - 1) : 1})`;
    }
  }
  const tick = () => draw();
  let running = false;
  const watch = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === running) return;
    running = entry.isIntersecting;
    running ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
  });
  watch.observe(section);
  const set = (key, value) => { if (key === 'turn') turn = value; else if (key === 'drag') drag = value; else tilt = value; dirty = true; };

  // Turning fast bends the ring back; it straightens as it slows.
  const bend = gsap.quickTo({ v: 0 }, 'v', { duration: .6, ease: 'power3.out', onUpdate() { set('tilt', this.targets()[0].v); } });
  const lean = velocity => bend(gsap.utils.clamp(-9, 9, velocity * .006));

  let holding = false, settle = null;

  // On a computer, the scroll turns it, one car at a time.
  const pinned = matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)').matches;
  section.querySelector('.ds-hint').textContent = pinned ? 'Scroll or drag' : 'Swipe';
  let trigger = null, drift = null;
  if (pinned) {
    trigger = ScrollTrigger.create({
      trigger: section, start: 'top top', end: () => `+=${Math.max(innerHeight * 1.6, real * innerHeight * .28)}`,
      pin: true, scrub: .8, invalidateOnRefresh: true,
      snap: real > 1 ? { snapTo: 1 / (real - 1), duration: { min: .25, max: .7 }, delay: .08, ease: 'power2.inOut' } : undefined,
      onUpdate: self => { set('turn', -self.progress * step * (real - 1)); lean(self.getVelocity()); },
    });
  } else {
    // Elsewhere, it drifts on its own while nobody touches it.
    drift = () => { if (!holding && running) set('drag', drag - .045); };
    gsap.ticker.add(drift);
  }

  // Dragging turns it, with a little momentum, and settles a card at the front.
  const degreesPerPixel = () => 360 / (2 * Math.PI * radius);
  const toFront = (target, duration = .9) => { settle?.kill(); const goal = { v: drag }; settle = gsap.to(goal, { v: target, duration, ease: 'expo.out', onUpdate: () => set('drag', goal.v) }); };
  const nearestDrag = value => { const angle = turn + value; return value - (angle - Math.round(angle / step) * step); };
  const observer = Observer.create({
    target: stage, type: 'touch,pointer', dragMinimum: 6, lockAxis: true,
    onPress: () => { holding = true; settle?.kill(); },
    onDrag: self => { if (self.axis === 'x') { set('drag', drag + self.deltaX * degreesPerPixel()); lean(self.velocityX * .6); } },
    onDragEnd: self => { holding = false; toFront(nearestDrag(drag + self.velocityX * degreesPerPixel() * .35)); },
    onRelease: () => { holding = false; },
  });
  // Ignore the click that ends a drag.
  let moved = false;
  stage.addEventListener('pointerdown', () => { moved = false; });
  stage.addEventListener('pointermove', event => { if (event.buttons) moved = true; });

  // A card not at the front comes round to it; at the front, it opens.
  const bring = i => {
    if (trigger) {
      const target = i % real, at = real > 1 ? target / (real - 1) : 0;
      // Turned by hand, the ring first returns to the scroll's own place.
      toFront(0, .5);
      window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * at, behavior: 'smooth' });
    } else {
      const angle = wrap(i * step + turn + drag);
      toFront(drag - angle);
    }
  };
  ring.addEventListener('click', event => {
    const card = event.target.closest('.ds-card');
    if (!card) return;
    if (moved) { event.preventDefault(); return; }
    const i = Number(card.dataset.i);
    if (i !== front) { event.preventDefault(); bring(i); }
  });
  ring.addEventListener('focusin', event => { const card = event.target.closest('.ds-card'); if (card && Number(card.dataset.i) !== front) bring(Number(card.dataset.i)); });

  measure();
  draw();
  const resize = new ResizeObserver(measure);
  resize.observe(stage);

  // The section rises in: the ring turns into place as it comes into view.
  gsap.fromTo(stage, { autoAlpha: 0, y: 60, rotateX: -12 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: section, start: 'top 75%', once: true } });

  return {
    refresh: () => ScrollTrigger.refresh(),
    dispose() { gsap.ticker.remove(tick); watch.disconnect(); resize.disconnect(); observer.kill(); trigger?.kill(true); if (drift) gsap.ticker.remove(drift); settle?.kill(); },
  };
}
