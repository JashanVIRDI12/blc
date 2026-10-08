// The featured collection's motion (inventory.js sets the cars).
//
// Wide screens: a printed catalogue. The section pins on the closed
// catalogue, and each stop of the scroll turns one leaf: the cover swings
// open (the catalogue sliding across to sit open in the middle), then a
// spread for each car, its photograph on the left page and its own page on
// the right. A page darkens as it rises edge-on, catches a gloss on the way
// and throws its shadow across the page beneath, near the spine; a jump of
// several cars riffles through the leaves between, one after another. The
// contents beneath turn straight to a car, as do the corners of the pages.
//
// Phones and tall screens: the cards, each photograph opening upward as it
// comes into view and its words following. Reduced motion: the cards, still.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
gsap.registerPlugin(ScrollTrigger);

const WIDE = '(min-width: 1200px) and (min-aspect-ratio: 1/1) and (min-height: 560px)';
// The share of the pinned scroll the closed catalogue holds before the cover
// turns (and the last spread holds after).
const LEAD = .1;
// Depth between leaves lying in a stack, in pixels: enough to order them,
// too little to see.
const LAYER = .6;
const OPEN = 'inset(0% 0% 0% 0%)', BELOW = 'inset(100% 0% 0% 0%)';

export function createFeaturedMotion(section) {
  const mm = gsap.matchMedia();
  mm.add({ wide: WIDE, reduced: '(prefers-reduced-motion: reduce)' }, context => {
    const { wide, reduced } = context.conditions;
    if (reduced) return;
    return wide ? catalogue(section, context) : cards(section);
  });
  return () => mm.revert();
}

// The head: the title rises out of its line, the introduction after it.
function heading(section) {
  const title = section.querySelector('.ft-head .ft-line'), intro = section.querySelector('.ft-intro');
  gsap.set(title, { yPercent: 110 });
  gsap.set(intro, { autoAlpha: 0, y: 14 });
  return gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .to(title, { yPercent: 0, duration: 1.5 }, 0)
    .to(intro, { autoAlpha: 1, y: 0, duration: 1.2, clearProps: 'transform' }, .25);
}

function cards(section) {
  const items = [...section.querySelectorAll('.ft-card:not(.is-skeleton)')];
  const foot = section.querySelector('.ft-foot');
  const head = heading(section);
  const parts = card => ({ photo: card.querySelector('.ft-card-photo'), image: card.querySelector('.ft-card-photo > img'), words: card.querySelectorAll(':scope > :not(.ft-card-photo)') });
  items.forEach(card => {
    const { photo, image, words } = parts(card);
    gsap.set(photo, { clipPath: BELOW });
    gsap.set(image, { scale: 1.2 });
    gsap.set(words, { autoAlpha: 0, y: 20 });
  });
  gsap.set(foot, { autoAlpha: 0, y: 16 });
  ScrollTrigger.create({ trigger: section, start: 'top 78%', end: 'max', once: true, onEnter: () => head.play() });
  // Cards that arrive together open one after another, left to right.
  ScrollTrigger.batch(items, {
    start: 'top 88%', end: 'max', once: true,
    onEnter: batch => batch.forEach((card, i) => {
      const { photo, image, words } = parts(card);
      gsap.timeline({ delay: i * .12, defaults: { ease: 'expo.out' } })
        .to(photo, { clipPath: OPEN, duration: 1.3, ease: 'expo.inOut' }, 0)
        .to(image, { scale: 1, duration: 1.9, clearProps: 'transform' }, .08)
        .to(words, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .07, clearProps: 'transform' }, .45);
    }),
  });
  ScrollTrigger.create({ trigger: foot, start: 'top 94%', end: 'max', once: true, onEnter: () => gsap.to(foot, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform' }) });
}

function catalogue(section, context) {
  const book = section.querySelector('.ft-book'), spread = book.querySelector('.ft-spread');
  const leaves = [...book.querySelectorAll('.ft-leaf')].sort((a, b) => a.dataset.leaf - b.dataset.leaf);
  const last = book.querySelector('.ft-base > .ft-face');
  const castLeft = book.querySelector('.ft-cast--left'), castRight = book.querySelector('.ft-cast--right');
  const contents = section.querySelector('.ft-contents'), track = contents.querySelector('.ft-rows');
  const rows = [...contents.querySelectorAll('.ft-row')], marker = contents.querySelector('.ft-marker');
  const turners = [...book.querySelectorAll('[data-turn]')], foot = section.querySelector('.ft-foot');
  const n = leaves.length;
  if (!n) return;
  section.classList.add('is-staged');
  // The page corners stand just above the stack, below a page in the air.
  book.style.setProperty('--layers', n + .8);
  const controller = new AbortController(), signal = controller.signal;
  const sheets = leaves.map(leaf => {
    const front = leaf.querySelector('.ft-front'), back = leaf.querySelector('.ft-back');
    return { leaf, front, back, a: 0, want: 0, light: [front, back].map(face => ({ shade: face.querySelector('.ft-shade'), gloss: face.querySelector('.ft-gloss') })) };
  });
  // 0: the catalogue closed; k: the k-th car's spread.
  let state = -1, pin;

  // Every leaf where its turn has brought it (a: 0 flat on the right, 1 flat
  // on the left). At rest the right-hand stack keeps the earlier leaves on
  // top and the left-hand stack the last turned; a leaf in the air rises
  // above both.
  function render() {
    let right = 0, left = 0, rightSpread = 0, leftSpread = 0;
    sheets.forEach((sheet, i) => {
      const { a } = sheet, moving = a > 0 && a < 1;
      const z = (moving ? n + 1 + i : a >= 1 ? i - n - 1 : n - i) * LAYER;
      sheet.leaf.style.transform = `translateZ(${z}px) rotateY(${(-180 * a).toFixed(3)}deg)`;
      // Edge-on (a = .5) the page is darkest; a gloss runs across it as it
      // tilts towards the light and away again.
      const edge = Math.sin(Math.PI * a), gloss = Math.sin(2 * Math.PI * a) ** 2;
      sheet.light.forEach(({ shade, gloss: sheen }, side) => {
        shade.style.opacity = (edge * .5).toFixed(3);
        sheen.style.opacity = (gloss * .55).toFixed(3);
        sheen.style.backgroundPosition = `${((side ? 1 - a : a) * 220 - 60).toFixed(1)}% 0`;
      });
      if (!moving) return;
      // The shadow beneath falls from the spine: deep and narrow as the page
      // stands up, wide and faint as it lies down.
      if (a < .5) { right = Math.max(right, edge); rightSpread = Math.max(rightSpread, Math.cos(Math.PI * a)); }
      else { left = Math.max(left, edge); leftSpread = Math.max(leftSpread, -Math.cos(Math.PI * a)); }
    });
    castRight.style.opacity = (right * .62).toFixed(3);
    castRight.style.transform = `translateZ(${(n + .5) * LAYER}px) scaleX(${Math.max(.12, rightSpread).toFixed(3)})`;
    castLeft.style.opacity = (left * .62).toFixed(3);
    castLeft.style.transform = `translateZ(${(n + .5) * LAYER}px) scaleX(${Math.max(.12, leftSpread).toFixed(3)})`;
    // Closed, the catalogue sits in the middle; it slides across as the
    // cover opens, so the open spread is centred in its turn.
    spread.style.transform = `translateX(${(-(1 - sheets[0].a) * 25).toFixed(3)}%)`;
  }

  const load = img => { if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src; };
  // Only the pages in view can be read or reached: the cover when closed;
  // a car's photograph and its page when open.
  function expose(s) {
    const shown = s === 0 ? [sheets[0].front] : [sheets[s - 1].back, s < n ? sheets[s].front : last];
    [...sheets.flatMap(sheet => [sheet.front, sheet.back]), last].forEach(face => { const on = shown.includes(face); face.inert = !on; face.setAttribute('aria-hidden', String(!on)); });
    // The photographs two spreads either way, so a riffle never turns a blank.
    [s - 3, s - 2, s - 1, s, s + 1].forEach(i => load(sheets[i]?.back.querySelector('img')));
  }

  // The contents follow the spread in view: its row lights, the gold line
  // slides beneath it, and a row out of sight scrolls into it.
  function mark(s, duration) {
    const row = rows[s - 1];
    rows.forEach(other => other.classList.toggle('is-active', other === row));
    const room = contents.clientWidth, overflow = Math.max(0, track.scrollWidth - room);
    const shift = row ? gsap.utils.clamp(0, overflow, row.offsetLeft + row.offsetWidth / 2 - room / 2) : 0;
    gsap.to(track, { x: -shift, duration, ease: 'expo.inOut', overwrite: true });
    if (row) gsap.to(marker, { x: row.offsetLeft - shift, width: row.offsetWidth, autoAlpha: 1, duration, ease: 'expo.inOut', overwrite: 'auto' });
    else gsap.to(marker, { autoAlpha: 0, duration: duration * .5, overwrite: 'auto' });
    turners.forEach(button => {
      const to = s + Number(button.dataset.turn);
      button.disabled = to < 0 || to > n;
      button.firstElementChild.textContent = button.dataset.turn === '1' ? (s === 0 ? 'Open the catalogue' : 'Next car') : (s === 1 ? 'Back to the cover' : 'Previous car');
    });
  }

  // Turns the catalogue to a spread. Each leaf that must change sides turns
  // on its own, the next a beat after the last, the way a hand riffles
  // through; a leaf already on its way is caught where it is.
  const turnTo = s => context.add(() => {
    if (s === state) return;
    const from = state;
    state = s;
    expose(s);
    mark(s, .9);
    const turning = sheets.map((sheet, i) => [sheet, i < s ? 1 : 0, i]).filter(([sheet, want]) => sheet.want !== want);
    if (s < from) turning.reverse();
    turning.forEach(([sheet, want], order) => {
      sheet.want = want;
      gsap.killTweensOf(sheet);
      gsap.to(sheet, { a: want, duration: .45 + .85 * Math.abs(want - sheet.a), delay: order * .16, ease: 'power2.inOut', onUpdate: render, onComplete: render });
    });
  });

  // The scroll: a stop for the closed catalogue and one for each spread; a
  // scroll that comes to rest between two settles on the nearer.
  const at = s => LEAD + (1 - 2 * LEAD) * s / n;
  const stepAt = p => gsap.utils.clamp(0, n, Math.round((p - LEAD) / (1 - 2 * LEAD) * n));
  pin = ScrollTrigger.create({
    trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * (.4 + .8 * n))}`,
    pin: true, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 0,
    // The nearest stop, not the next one along: a scroll that runs a little past
    // a spread settles back on it rather than skipping the car beyond.
    snap: { snapTo: [0, ...Array.from({ length: n + 1 }, (_, s) => at(s)), 1], directional: false, duration: { min: .35, max: 1 }, delay: .12, ease: 'power3.inOut' },
    onUpdate: self => turnTo(stepAt(self.progress)),
    onRefresh: () => mark(Math.max(0, state), 0),
  });
  // Where the scroll already stands, without turning.
  const start = stepAt(pin.progress);
  sheets.forEach((sheet, i) => { sheet.a = sheet.want = i < start ? 1 : 0; });
  state = start;
  expose(start);
  mark(start, 0);
  render();

  // The contents and the page corners turn by scrolling to the spread, so
  // the scroll and the catalogue never disagree: the page is carried there
  // (through the smoother when there is one, which a plain jump of the
  // window's scroll leaves behind while pinned), turning each leaf on the way.
  const travel = { y: 0 };
  const scrollToState = s => context.add(() => {
    const to = gsap.utils.clamp(0, n, s), smoother = ScrollSmoother.get();
    travel.y = smoother ? smoother.scrollTop() : scrollY;
    gsap.to(travel, {
      y: pin.start + at(to) * (pin.end - pin.start), duration: .8 + .3 * Math.abs(to - state), ease: 'power2.inOut', overwrite: true,
      onUpdate: () => smoother ? smoother.scrollTop(travel.y) : window.scrollTo(0, travel.y),
    });
  });
  // A visitor's own scroll takes over from a journey under way.
  addEventListener('wheel', () => gsap.killTweensOf(travel), { passive: true, signal });
  addEventListener('touchstart', () => gsap.killTweensOf(travel), { passive: true, signal });
  rows.forEach((row, k) => row.addEventListener('click', () => scrollToState(k + 1), { signal }));
  turners.forEach(button => button.addEventListener('click', () => scrollToState(state + Number(button.dataset.turn)), { signal }));
  // The cabin photograph is fetched the first time the pointer comes to it.
  book.addEventListener('pointerover', event => load(event.target.closest?.('.ft-photo')?.querySelector('.inside-photo')), { signal });

  // The closed catalogue is set down as it comes into view, tilting up off
  // the table to face the visitor; the contents follow.
  gsap.set(book, { autoAlpha: 0, y: 80, rotationX: 24, transformPerspective: 1800, transformOrigin: '50% 100%' });
  gsap.set([contents, foot], { autoAlpha: 0, y: 14 });
  ScrollTrigger.create({
    trigger: section, start: 'top 72%', end: 'max', once: true, refreshPriority: 0,
    onEnter: () => context.add(() => {
      // The cabin pictures are small; every page has its own before any turns.
      book.querySelectorAll('.ft-inset img').forEach(load);
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .to(book, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.9, clearProps: 'transform' }, 0)
        .to([contents, foot], { autoAlpha: 1, y: 0, duration: 1.2, stagger: .1, clearProps: 'transform' }, .7);
    }),
  });

  if (import.meta.env.DEV) window.__featured = { state: () => ({ state, n, turns: sheets.map(sheet => +sheet.a.toFixed(3)), pinned: pin.isActive, progress: pin.progress, start: pin.start, end: pin.end }), at,
    // Holds a leaf part-way through its turn, to look at the light on it.
    pose(i, a) { gsap.killTweensOf(sheets[i]); sheets[i].a = a; render(); } };
  return () => {
    controller.abort();
    sheets.forEach(sheet => gsap.killTweensOf(sheet));
    section.classList.remove('is-staged');
    [...leaves, spread, castLeft, castRight, book].forEach(element => element.removeAttribute('style'));
    book.querySelectorAll('.ft-face, .ft-shade, .ft-gloss').forEach(element => { element.removeAttribute('style'); element.inert = false; element.removeAttribute('aria-hidden'); });
    rows.forEach(row => row.classList.remove('is-active'));
    if (import.meta.env.DEV) delete window.__featured;
  };
}
