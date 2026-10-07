// Baba Concierge (/concierge/): any car, sourced. A ring of the marques
// turns beside the promise; the brief (marque, model, year, specification,
// budget, timing, extras) gathers on a card that sends it on WhatsApp or as a
// call-back request (the admin's inbox, as a concierge enquiry); then how it
// works, and the services that make a car yours. `?marque=Bentley` arrives
// with the marque chosen (from the collection page's strip).
import './styles.css';
import './light.css';
import './collection.css';
import './concierge.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setupPage } from './chrome.js';
import { loadSite, live, conciergeGroups, defaultSettings } from './data.js';
import { saveEnquiry } from './forms.js';
import { MARQUES } from './marques.js';
import { marqueArt, sizeMarques } from './marque-art.js';
import { escapeHTML } from './util.js';

gsap.registerPlugin(ScrollTrigger);
setupPage('concierge');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const CHOICES = {
  budget: ['Under ₹50 lakh', '₹50 lakh – 1 crore', '₹1 – 2 crore', '₹2 – 5 crore', 'Above ₹5 crore', 'Open'],
  timing: ['As soon as possible', 'Within 3 months', 'Within 6 months', 'Just exploring'],
  extras: ['Modifications', 'Paint protection', 'Fancy or VIP number', 'Finance', 'Exchange my car', 'Delivery outside Delhi'],
};
const brief = { marque: '', other: '', model: '', year: '', spec: '', budget: '', timing: '', extras: [] };
let settings = { ...defaultSettings.concierge };


// WhatsApp and call links follow the admin's concierge number.
function contact() {
  const digits = String(settings.whatsapp || '').replace(/\D/g, '');
  const full = digits.length === 10 ? `91${digits}` : digits;
  $$('[data-concierge-whatsapp]').forEach(link => { link.hidden = !digits; link.href = `https://wa.me/${full}?text=${encodeURIComponent('Hello Baba Concierge, I’d like you to find me a car.')}`; });
  $('[data-concierge-number]').textContent = settings.whatsapp || '';
  const call = $('[data-concierge-call]');
  call.hidden = !digits;
  call.href = `tel:+${full}`;
  call.textContent = `Or call ${settings.whatsapp}`;
  sync();
}

// ------------------------------------------------------------------ ring
// The marques on a slow carousel seen a little from above: each faces the
// visitor, larger and darker as it comes round to the front. A fine pointer
// tilts it. It turns only while on screen.
function ring() {
  const holder = $('[data-ring]'), set = $('[data-ring-set]');
  set.innerHTML = MARQUES.map(marque => `<span class="k-ring-mark marque"${marque.scale ? ` data-scale="${marque.scale}"` : ''}>${marqueArt(marque)}</span>`).join('');
  sizeMarques(set, matchMedia('(max-width: 760px)').matches ? 30 : 46, '.k-ring-mark');
  const marks = [...set.children], n = marks.length;
  const tilt = { x: 0, y: 0, toX: 0, toY: 0 };
  let angle = 0, running = false;
  const place = () => {
    const radius = holder.clientWidth * .44, lift = holder.clientHeight * .17;
    marks.forEach((mark, i) => {
      const a = angle + i / n * Math.PI * 2, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
      const front = (z / radius + 1) / 2;
      const y = -z / radius * lift * (1 + tilt.y * .6);
      mark.style.transform = `translate(-50%, -50%) translate3d(${(x + tilt.x * z * .12).toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
      mark.style.opacity = (.06 + .94 * front ** 2.6).toFixed(3);
      mark.style.zIndex = Math.round(front * 100);
    });
  };
  place();
  if (reduced) return;
  gsap.from(marks, { autoAlpha: 0, scale: .6, duration: 1.6, ease: 'expo.out', stagger: .06, delay: .4, clearProps: 'scale,visibility' });
  const tick = (time, delta) => {
    angle -= delta / 1000 * .16;
    tilt.x += (tilt.toX - tilt.x) * .06; tilt.y += (tilt.toY - tilt.y) * .06;
    place();
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === running) return;
    running = entry.isIntersecting;
    running ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
  }).observe(holder);
  if (finePointer) {
    addEventListener('pointermove', event => { tilt.toX = event.clientX / innerWidth * 2 - 1; tilt.toY = event.clientY / innerHeight * 2 - 1; }, { passive: true });
  }
}

// ----------------------------------------------------------------- brief
function form() {
  const marques = $('[data-brief-marques]');
  marques.innerHTML = MARQUES.map(marque => `<button type="button" class="k-marque" role="radio" aria-checked="false" data-marque="${escapeHTML(marque.name)}"><span class="marque"${marque.scale ? ` data-scale="${marque.scale}"` : ''}>${marqueArt(marque)}</span><small>${escapeHTML(marque.name)}</small></button>`).join('')
    + `<button type="button" class="k-marque k-marque--other" role="radio" aria-checked="false" data-marque="other"><span class="k-plus" aria-hidden="true">+</span><small>Another marque</small></button>`;
  sizeMarques(marques, 30);
  const years = $('[name=year]');
  for (let year = new Date().getFullYear(); year >= 2008; year--) years.add(new Option(`${year} or newer`, year));
  for (const [key, options] of Object.entries(CHOICES)) {
    const holder = $(`[data-choice=${key}]`);
    holder.innerHTML = options.map(option => `<button type="button" class="v-chip" aria-pressed="false" data-value="${escapeHTML(option)}"><i aria-hidden="true"></i>${escapeHTML(option)}</button>`).join('');
    holder.addEventListener('click', event => {
      const chip = event.target.closest('.v-chip');
      if (!chip) return;
      const value = chip.dataset.value, multiple = holder.hasAttribute('data-multiple');
      if (multiple) {
        const on = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(on));
        brief[key] = on ? [...brief[key], value] : brief[key].filter(item => item !== value);
      } else {
        const on = brief[key] !== value;
        holder.querySelectorAll('.v-chip').forEach(other => other.setAttribute('aria-pressed', String(on && other === chip)));
        brief[key] = on ? value : '';
      }
      sync();
    });
  }
  const choose = name => {
    brief.marque = brief.marque === name ? '' : name;
    marques.querySelectorAll('.k-marque').forEach(button => button.setAttribute('aria-checked', String(button.dataset.marque === brief.marque)));
    $('[data-other]').hidden = brief.marque !== 'other';
    if (brief.marque === 'other') $('[name=otherMarque]').focus();
    sync(true);
  };
  marques.addEventListener('click', event => { const button = event.target.closest('.k-marque'); if (button) choose(button.dataset.marque); });
  const formElement = $('[data-brief]');
  formElement.addEventListener('input', () => {
    brief.other = formElement.elements.otherMarque.value.trim();
    brief.model = formElement.elements.model.value.trim();
    brief.year = formElement.elements.year.value;
    brief.spec = formElement.elements.spec.value.trim();
    sync();
  });
  formElement.addEventListener('submit', event => event.preventDefault());

  // Arriving from the collection with a marque in mind.
  const wanted = new URLSearchParams(location.search).get('marque');
  if (wanted) {
    if (MARQUES.some(marque => marque.name === wanted)) choose(wanted);
    else { choose('other'); formElement.elements.otherMarque.value = wanted; brief.other = wanted; sync(); }
  }

  if (live) {
    $('[data-card-contact]').hidden = false;
    const send = $('[data-card-send]'), result = $('[data-card-result]');
    send.hidden = false;
    send.addEventListener('click', async () => {
      const name = $('[data-card-name]'), phone = $('[data-card-phone]');
      result.hidden = false;
      if (!name.value.trim()) { result.textContent = 'Add your name, and we’ll call you about the car.'; name.focus(); return; }
      if (!/^[+0-9 ()-]{7,22}$/.test(phone.value.trim())) { result.textContent = 'Add a phone number we can call.'; phone.focus(); return; }
      send.disabled = true; result.textContent = 'Sending…';
      try {
        await saveEnquiry('concierge', { name: name.value.trim(), phone: phone.value.trim(), interest: `Sourcing: ${carLine() || 'a car'}`, message: brief.spec, ...facts().reduce((map, [key, , value]) => ({ ...map, [key]: value }), {}) });
        result.textContent = `Thank you, ${name.value.trim().split(' ')[0]}. The concierge has your brief and will call you shortly.`;
      } catch { result.textContent = 'That didn’t go through. Please send it on WhatsApp instead.'; }
      finally { send.disabled = false; }
    });
  }
  sync();
}
const marqueName = () => brief.marque === 'other' ? brief.other : brief.marque;
const carLine = () => [marqueName(), brief.model].filter(Boolean).join(' ');
const facts = () => [
  ['marque', 'Marque', marqueName()], ['model', 'Model', brief.model], ['year', 'From', brief.year ? `${brief.year} or newer` : ''],
  ['spec', 'Colour and spec', brief.spec], ['budget', 'Budget', brief.budget], ['timing', 'When', brief.timing], ['extras', 'Also', brief.extras.join(', ')],
].filter(([, , value]) => value);

// The card follows the brief; a new marque swaps in with a turn.
let shownMarque = null;
function sync(animate = false) {
  const card = $('[data-card]');
  if (!card) return;
  $('[data-card-title]').textContent = carLine() || 'The car you have in mind';
  $('[data-card-facts]').innerHTML = facts().filter(([key]) => key !== 'marque' && key !== 'model').map(([, label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('') || '<div class="k-card-empty"><dd>Choose a marque, then tell us as much or as little as you like.</dd></div>';
  if (shownMarque !== brief.marque) {
    shownMarque = brief.marque;
    const marque = MARQUES.find(entry => entry.name === brief.marque);
    const mark = $('[data-card-mark]');
    const swap = () => {
      mark.innerHTML = marque ? `<span class="marque"${marque.scale ? ` data-scale="${marque.scale}"` : ''}>${marqueArt(marque)}</span>` : `<span>${escapeHTML(brief.marque === 'other' ? (brief.other || 'Another marque') : 'Any marque')}</span>`;
      if (marque) sizeMarques(mark, 64);
    };
    if (animate && !reduced) gsap.timeline().to(mark, { rotateY: 90, autoAlpha: 0, duration: .25, ease: 'power2.in' }).add(swap).fromTo(mark, { rotateY: -90 }, { rotateY: 0, autoAlpha: 1, duration: .55, ease: 'expo.out' });
    else swap();
  } else if (brief.marque === 'other') $('[data-card-mark] span').textContent = brief.other || 'Another marque';
  const digits = String(settings.whatsapp || '').replace(/\D/g, '');
  const whatsapp = $('[data-card-whatsapp]');
  whatsapp.hidden = !digits;
  const text = ['Hello Baba Concierge, I’d like you to find me a car.', facts().map(([, label, value]) => `${label}: ${value}`).join('\n')].filter(Boolean).join('\n\n');
  whatsapp.href = `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

// --------------------------------------------------------------- services
function services() {
  const groups = conciergeGroups(settings.services, '*');
  $('[data-services]').innerHTML = groups.map((group, i) => `<div class="k-service"><span>${String(i + 1).padStart(2, '0')}</span><h3>${escapeHTML(group.title)}</h3><ul>${group.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></div>`).join('');
}

// ----------------------------------------------------------------- motion
function intro() {
  $$('[data-magnetic]').forEach(element => {
    if (!finePointer || reduced) return;
    const x = gsap.quickTo(element, 'x', { duration: .6, ease: 'power3.out' }), y = gsap.quickTo(element, 'y', { duration: .6, ease: 'power3.out' });
    element.addEventListener('pointermove', event => { const r = element.getBoundingClientRect(); x((event.clientX - r.left - r.width / 2) * .22); y((event.clientY - r.top - r.height / 2) * .32); });
    element.addEventListener('pointerleave', () => { x(0); y(0); });
  });
  if (reduced) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo('.k-hero .c-rule', { scaleX: 0 }, { scaleX: 1, duration: 1.2 }, .1)
    .fromTo('.k-hero .c-kicker', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .9 }, .1)
    .fromTo('.k-title .fl-line > span', { yPercent: 135, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, stagger: .1 }, .15)
    .fromTo('.k-lede, .k-actions', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08, clearProps: 'transform' }, .5);
  gsap.utils.toArray('.c-section-head, .k-step, .k-card, .k-service, .k-talk').forEach(element => {
    gsap.fromTo(element, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
  });
  // The steps: a gold line draws across, lighting each station as it passes.
  const steps = $$('[data-steps] li');
  const timeline = gsap.timeline({ scrollTrigger: { trigger: '[data-steps]', start: 'top 75%', end: 'bottom 55%', scrub: .6 } })
    .fromTo('[data-steps-line]', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 1 }, 0);
  steps.forEach((step, i) => timeline.fromTo(step, { '--lit': 0 }, { '--lit': 1, duration: .12, ease: 'none' }, i / (steps.length - 1) * .88));
}

// Start, once everything above is defined.
intro();
ring();
form();
contact();
services();
loadSite().then(site => { settings = site.settings.concierge; contact(); services(); });
