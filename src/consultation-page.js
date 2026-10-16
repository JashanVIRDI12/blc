// The one-to-one consultation (/consultation/). One object carries the page:
// a calling card, black and gilt-edged, lying askew on a desk under a lamp.
// On large screens the scroll picks it up, turns it over in the air and lays
// it beside the booking form, its ivory back now an appointment that fills
// in as the form is answered (the day, the time, how to call, the name);
// a request made presses a gold seal into it. Then the questions the call
// starts with, one at a time in a pinned frame, and the three ways to talk.
// Phones, tablets and reduced motion: the card stays on the desk, and a
// second, already turned, sits above the form. The request itself goes
// through forms.js, as the home page's booking dialog does.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { setupPage, paperHeader } from './chrome.js';
import { loadSite } from './data.js';
import { dealer } from './config.js';
import { setupSmooth, scrollToTarget } from './smooth.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
setupPage('consultation');
paperHeader('.cp-ways');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp01 = value => Math.min(1, Math.max(0, value));
const span = (p, from, to) => clamp01((p - from) / (to - from));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
setupSmooth();

const form = $('.cp-form');
const card = $('[data-card]');

// ------------------------------------------------------------------ days
// The next seven days, as a desk calendar: today first, in Indian time.
// After seven in the evening today is gone; with today chosen, the parts
// of the day already past are too.
const IST = 'Asia/Kolkata';
function istNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-IN', { timeZone: IST, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { date: new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12)), hour: +parts.hour };
}
function days() {
  const holder = $('[data-days]'), { date, hour } = istNow();
  const format = options => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...options });
  for (let i = 0; i < 7; i++) {
    const day = new Date(date.getTime() + i * 864e5);
    const label = document.createElement('label');
    label.className = 'cp-day';
    const value = format({ weekday: 'long', day: 'numeric', month: 'long' }).format(day);
    label.innerHTML = `<input type="radio" name="day" value="${value}"${i === 0 && hour >= 19 ? ' disabled' : ''}><span><small>${i === 0 ? 'Today' : format({ weekday: 'short' }).format(day)}</small><b>${day.getUTCDate()}</b><small>${format({ month: 'short' }).format(day)}</small></span>`;
    label.querySelector('input').dataset.today = i === 0 ? '1' : '';
    holder.append(label);
  }
  // The day's windows: those over already are closed, for today.
  const times = $$('[data-times] input');
  const check = () => {
    const today = $('[name="day"]:checked')?.dataset.today === '1', { hour: now } = istNow();
    times.forEach(input => {
      input.disabled = today && input.dataset.ends && +input.dataset.ends <= now + 1;
      if (input.disabled && input.checked) { times[0].checked = true; times[0].dispatchEvent(new Event('change', { bubbles: true })); }
    });
  };
  holder.addEventListener('change', check);
}

// ------------------------------------------------------------- the glide
// One gold plate per group, gliding to the choice made.
function glides() {
  return $$('.cp-vias, .cp-days, .cp-times').map(group => {
    const plate = document.createElement('i');
    plate.className = 'cp-glide';
    plate.setAttribute('aria-hidden', 'true');
    group.prepend(plate);
    group.classList.add('is-gliding');
    const place = (animate = true) => {
      const span = group.querySelector('input:checked + span');
      if (!span) return;
      const label = span.parentElement;
      const to = { x: label.offsetLeft, y: label.offsetTop, width: span.offsetWidth, height: span.offsetHeight };
      if (animate && !reduced) gsap.to(plate, { ...to, duration: .8, ease: 'expo.out', overwrite: true });
      else gsap.set(plate, to);
    };
    group.addEventListener('change', () => place());
    return place;
  });
}

// ------------------------------------------------------------- the card
// The appointment on the card's back: each line follows its part of the
// form, and is written on (a stroke of ink drawn left to right) when its
// answer changes.
const WHEN = { 'Any time': 'Any time, 11 am to 8 pm IST', Morning: 'Morning, 11 am to 1 pm IST', Afternoon: 'Afternoon, 1 to 5 pm IST', Evening: 'Evening, 5 to 8 pm IST' };
const EMPTY = { name: 'Your name', day: 'Any day', when: WHEN['Any time'], callVia: 'Phone call', about: 'The car that fits you' };
let sealed = false;
function lines() {
  const read = () => {
    const data = Object.fromEntries(new FormData(form));
    const about = [String(data.message || '').trim(), data.budget].filter(Boolean).join(', ');
    return { name: String(data.name || '').trim(), day: data.day && data.day !== 'Any day' ? data.day : '', when: data.when && data.when !== 'Any time' ? WHEN[data.when] : '', callVia: data.callVia || '', about };
  };
  const shown = {};
  const write = (animate = true) => {
    const values = read();
    for (const [key, value] of Object.entries(values)) {
      const line = $(`[data-line="${key}"]`, card);
      const text = value || EMPTY[key];
      if (shown[key] === text) continue;
      const first = shown[key] === undefined, wasEmpty = line.classList.contains('is-empty');
      shown[key] = text;
      line.classList.toggle('is-empty', !value);
      const inner = line.firstElementChild;
      inner.textContent = text;
      // Typing a name or a note rewrites it in place; a new choice, or the
      // first letter after the blank, is written on.
      const typed = ['name', 'about'].includes(key) && !wasEmpty && value;
      if (!first && animate && !reduced && !typed) gsap.fromTo(inner, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'power2.out', clearProps: 'clipPath' });
    }
  };
  write(false);
  form.addEventListener('input', event => {
    // forms.js resets the form after a request is sent: the card keeps it.
    if (sealed && !event.isTrusted) return;
    if (sealed) unseal();
    write();
  });
  form.addEventListener('change', event => { if (sealed && event.isTrusted) unseal(); write(); });
  form.addEventListener('lead:result', event => { if (event.detail.status !== 'failed') seal(event.detail.status); });
}
function seal(status) {
  sealed = true;
  $('[data-card-status]', card).textContent = status === 'sent' ? 'Received. We’ll call to confirm the time.' : 'Ready to send. Choose how to share it below.';
  const mark = $('[data-seal]', card);
  card.classList.add('is-sealed');
  if (reduced) return;
  gsap.timeline()
    .fromTo(mark, { opacity: 0, scale: 1.7, rotate: -26 }, { opacity: 1, scale: .94, rotate: -14, duration: .42, ease: 'power3.in' })
    .to(mark, { scale: 1, duration: .5, ease: 'elastic.out(1, .45)' })
    .fromTo($('.cp-back', card), { y: 0 }, { y: 3, duration: .08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, .4);
}
function unseal() {
  sealed = false;
  card.classList.remove('is-sealed');
  gsap.set($('[data-seal]', card), { clearProps: 'all' });
  $('[data-card-status]', card).textContent = 'We’ll call to confirm the time.';
}

// The journey from the desk to the booking. The card is one fixed object,
// placed every frame between the two places it belongs to (the desk's slot
// and the booking's), so it is glued to the desk until the scroll picks it
// up and glued to the booking once laid down. In flight it lifts towards
// the eye, straightens from lying to upright and turns over.
function journey() {
  const desk = $('[data-slot="desk"]'), book = $('[data-slot="book"]'), inner = $('[data-card-inner]', card), shadow = $('[data-desk-shadow]');
  const POSE = { x: 48, z: -14 };
  const state = { p: 0 }, intro = { x: .45, z: 34, o: 0 };
  document.body.classList.add('cp-travel');
  let size = null, last = '';
  const measure = () => { size = { w: book.offsetWidth, h: book.offsetHeight }; card.style.width = `${size.w}px`; card.style.height = `${size.h}px`; last = ''; };
  measure();
  addEventListener('resize', measure);
  const render = () => {
    const d = desk.getBoundingClientRect(), b = book.getBoundingClientRect(), p = state.p;
    // Off screen at both ends: nothing to place.
    if (d.bottom < -innerHeight && b.top > innerHeight * 2) return;
    const e = smooth(p), lift = Math.sin(Math.PI * p);
    const cx = lerp(d.left + d.width / 2, b.left + b.width / 2, e) + intro.x * innerWidth;
    const cy = lerp(d.top + d.height / 2, b.top + b.height / 2, e) - lift * innerHeight * .06;
    const scale = lerp(d.width / size.w, 1, e) * (1 + lift * .08);
    const rx = POSE.x * (1 - smooth(span(p, 0, .7)));
    const rz = POSE.z * (1 - smooth(span(p, .05, .85))) + intro.z + lift * 5;
    const ry = 180 * smooth(span(p, .18, .82));
    const key = `${cx.toFixed(1)}|${cy.toFixed(1)}|${scale.toFixed(4)}|${rx.toFixed(2)}|${rz.toFixed(2)}|${ry.toFixed(2)}|${intro.o.toFixed(3)}`;
    if (key === last) return;
    last = key;
    card.style.transform = `translate3d(${(cx - size.w / 2).toFixed(1)}px, ${(cy - size.h / 2).toFixed(1)}px, 0)`;
    card.style.opacity = intro.o.toFixed(3);
    inner.style.transform = `perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    shadow.style.opacity = (intro.o * (1 - smooth(span(p, 0, .22)))).toFixed(3);
  };
  gsap.ticker.add(render);
  gsap.to(state, { p: 1, ease: 'none', scrollTrigger: { trigger: desk, start: 'top 32%', endTrigger: book, end: 'top 62%', scrub: 1.1, invalidateOnRefresh: true } });
  // Dealt onto the desk as the page opens.
  gsap.to(intro, { x: 0, z: 0, o: 1, duration: 1.7, ease: 'expo.out', delay: .35 });
  if (import.meta.env.DEV) window.__consultCard = { progress: () => state.p, set: value => { state.p = value; } };
}

// A fine pointer leads the light across the foil.
function sheen() {
  if (!finePointer || reduced) return;
  const cards = $$('.cp-card'), light = { at: 60 };
  const to = gsap.quickTo(light, 'at', { duration: 1.2, ease: 'power3.out', onUpdate: () => cards.forEach(element => element.style.setProperty('--sheen', `${light.at.toFixed(1)}%`)) });
  addEventListener('pointermove', event => to(100 - event.clientX / innerWidth * 80), { passive: true });
}

// ------------------------------------------------------------- questions
// Large screens pin the frame: the title opens alone, then steps back into
// the left column; in the right one each question rises, lights word by word
// as it is read, and makes way for the next, while the rule between them
// fills. Elsewhere the questions sit in a column and light as they pass.
function questions() {
  const section = $('.cp-talk'), frame = $('[data-talk]'), title = $('[data-talk-title]');
  const items = $$('.cp-question'), bar = $('[data-talk-bar]'), track = bar.parentElement;
  if (reduced) return;
  const splits = items.map(item => SplitText.create($('.cp-q', item), { type: 'lines,words', mask: 'lines', wordsClass: 'cp-word' }));
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1001px) and (min-height: 640px)', () => {
    section.classList.add('is-pinned');
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: frame, start: 'top top', end: () => `+=${Math.round(innerHeight * (items.length * .9 + .5))}`, pin: true, scrub: 1, invalidateOnRefresh: true } });
    const total = items.length + .4;
    tl.to(title, { scale: .56, duration: .5, ease: 'power2.inOut' }, 0)
      .fromTo(track, { autoAlpha: 0 }, { autoAlpha: 1, duration: .2 }, .3);
    items.forEach((item, i) => {
      const { words } = splits[i], answer = $('.cp-a', item), at = .4 + i;
      tl.set(item, { visibility: 'visible' }, at)
        .fromTo(words, { yPercent: 115, opacity: .12 }, { yPercent: 0, duration: .32, stagger: .025, ease: 'power3.out' }, at)
        .to(words, { opacity: 1, duration: .25, stagger: .05 }, at + .18)
        .fromTo(answer, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .22, ease: 'power2.out' }, at + .42);
      if (i < items.length - 1) tl.to(words, { yPercent: -115, duration: .26, stagger: .015, ease: 'power2.in' }, at + .82).to(answer, { autoAlpha: 0, y: -14, duration: .18, ease: 'power2.in' }, at + .8).set(item, { visibility: 'hidden' }, at + 1.1);
    });
    tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: total - .4 }, .4);
    return () => section.classList.remove('is-pinned');
  });
  mm.add('(max-width: 1000px), (max-height: 639px)', () => {
    items.forEach((item, i) => gsap.fromTo(splits[i].words, { opacity: .14 }, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: item, start: 'top 82%', end: 'bottom 55%', scrub: .6 } }));
  });
}

// -------------------------------------------------------------- headings
function headings() {
  if (reduced) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo('.cp-title .fl-line > span', { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: .1 }, .1)
    .fromTo('.cp-lede, .cp-actions, .cp-note', { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: .08, clearProps: 'transform' }, .45);
  $$('.cp-book-head, .cp-ways-head').forEach(head => gsap.timeline({ defaults: { ease: 'expo.out' }, scrollTrigger: { trigger: head, start: 'top 80%', once: true } })
    .fromTo($$('.fl-line > span', head), { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: .1 })
    .fromTo($('p', head), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.1 }, .3));
  // The ways' rules are drawn as the list is read.
  gsap.fromTo('.cp-way', { '--draw': 0 }, { '--draw': 1, stagger: .15, ease: 'none', scrollTrigger: { trigger: '[data-ways]', start: 'top 85%', end: 'bottom 75%', scrub: .6 } });
  if (!$('[data-card].cp-card') || document.body.classList.contains('cp-travel')) return;
  // No journey: the card on the desk is dealt on as the page opens.
  gsap.from('.cp-card--still', { x: '30vw', autoAlpha: 0, duration: 1.6, ease: 'expo.out', delay: .3 });
}

// ------------------------------------------------------------- the links
function links() {
  $$('[data-book]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const via = link.dataset.via && form.querySelector(`[name="callVia"][value="${link.dataset.via}"]`);
    if (via && !via.checked) { via.checked = true; via.dispatchEvent(new Event('change', { bubbles: true })); }
    scrollToTarget($('#book'));
  }));
  const contact = () => {
    const digits = String(dealer.whatsapp || '').replace(/\D/g, ''), full = digits.length === 10 ? `91${digits}` : digits;
    const href = `https://wa.me/${full}?text=${encodeURIComponent('Hello Baba Luxury Cars, I’d like a one-to-one call to find the right car for me.')}`;
    $$('[data-cp-whatsapp]').forEach(link => { link.hidden = !digits; link.href = href; });
    const way = $('[data-way-whatsapp]');
    way.hidden = !digits;
    $('a', way).href = href;
    $('[data-visit-text]').textContent = [dealer.address, dealer.hours].filter(Boolean).join('. ') + '.';
  };
  contact();
  loadSite().then(contact);
}

// ----------------------------------------------------------------- start
days();
const places = glides();
lines();
links();
const travel = !reduced && matchMedia('(min-width: 1001px)').matches;
if (travel) journey();
sheen();
headings();
questions();
document.fonts.ready.then(() => { places.forEach(place => place(false)); ScrollTrigger.refresh(); });
addEventListener('resize', () => places.forEach(place => place(false)));
// A request sent resets the form (forms.js): the plates go back with it.
form.addEventListener('reset', () => requestAnimationFrame(() => places.forEach(place => place())));
