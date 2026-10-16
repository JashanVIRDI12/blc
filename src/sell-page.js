// Sell your car (/sell/). The page's object is the car's own number plate:
// an Indian high-security plate on a lacquer floor, its letters pressed in
// one by one as the owner types the registration; "Start the appraisal"
// carries it to the form. Then the four steps, counted off on the last drum
// of an odometer as the scroll reads them (pinned on large screens); sell or
// exchange, two doors, the one under the pointer opening wider; the
// appraisal beside the car's record, a black folio that fills in as the form
// is answered (the plate, the name, the odometer, the care it has had); and
// the questions owners ask. The request itself goes through forms.js as a
// valuation enquiry.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setupPage, paperHeader } from './chrome.js';
import { dealerLines } from './config.js';
import { formatRegistration, kilometresInWords } from './valuation.js';
import { setupSmooth, scrollToTarget } from './smooth.js';

gsap.registerPlugin(ScrollTrigger);
setupPage('sell');
setupSmooth();
paperHeader('.sl-appraisal, .sl-faq');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $('.sl-form');
const field = name => form.elements[name];
field('year').max = String(new Date().getFullYear() + 1);

// The buying team's own line, as the dealership publishes it.
const buying = dealerLines.find(line => /sell/i.test(line.label));
if (buying) $$('[data-buying-line]').forEach(link => {
  link.href = `tel:${buying.phone.replace(/[^+\d]/g, '')}`;
  if (/\d/.test(link.textContent)) link.textContent = buying.phone;
});

// ----------------------------------------------------------------- plate
// The letters are drawn over the field (the field's own text is clear, its
// caret kept), so each can be pressed in as it arrives; the reflection
// repeats them. Empty, the plate shows an example in blind relief.
const SAMPLE = 'DL 3C AB 1234';
function plate() {
  const input = $('#plate-input'), chars = $('[data-plate-chars]'), mirror = $('[data-plate-mirror]'), body = $('[data-plate]');
  let shown = '';
  const draw = (text, placeholder, fresh = []) => {
    for (const holder of [chars, mirror]) {
      holder.classList.toggle('is-placeholder', placeholder);
      holder.replaceChildren(...[...text].map(char => Object.assign(document.createElement('i'), { textContent: char })));
    }
    if (reduced) return;
    const pressed = fresh.flatMap(index => [chars.children[index], mirror.children[index]]).filter(Boolean);
    if (pressed.length) {
      // A letter pressed into the sheeting: it lands from above, a little
      // large, and the plate gives under it.
      gsap.fromTo(pressed, { scale: 1.32, y: '-.08em', opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: .42, ease: 'back.out(2.6)', overwrite: true });
      gsap.fromTo(body, { y: 0 }, { y: 2, duration: .07, yoyo: true, repeat: 1, ease: 'power1.inOut', overwrite: 'auto' });
    }
  };
  const update = () => {
    const caret = input.selectionStart;
    const upper = input.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    if (upper !== input.value) { input.value = upper; input.setSelectionRange(caret, caret); }
    const fresh = [];
    for (let i = 0; i < upper.length; i++) if (upper[i] !== shown[i] && upper[i] !== ' ') fresh.push(i);
    shown = upper;
    upper ? draw(upper, false, fresh.slice(-2)) : draw(SAMPLE, true);
  };
  input.addEventListener('input', update);
  input.addEventListener('blur', () => { if (input.value.trim()) { input.value = formatRegistration(input.value); shown = input.value; draw(shown, false); } });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); start(); } });
  draw(SAMPLE, true);

  // The plate is set as the page opens: it rises onto the floor, a light
  // runs across its sheeting and the example is pressed in, letter by letter.
  if (!reduced) {
    const letters = [...chars.children, ...mirror.children];
    gsap.timeline({ defaults: { ease: 'expo.out' }, delay: .25 })
      .fromTo('.sl-title .fl-line > span', { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: .1 }, 0)
      .fromTo('.sl-lede, .sl-plate-label', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08 }, .35)
      .fromTo('.sl-plate-stage', { autoAlpha: 0, y: 46, rotateX: -18, transformPerspective: 1400, transformOrigin: '50% 100%' }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 1.6, clearProps: 'transform' }, .45)
      .fromTo(letters, { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.4)', stagger: { each: .055, grid: [2, SAMPLE.length], from: 'start' } }, 1.05)
      .fromTo('.sl-plate-sheen', { '--sweep': '120%' }, { '--sweep': '-20%', duration: 2.4, ease: 'power2.inOut' }, 1.1)
      .fromTo('.sl-hero-actions', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 1.4);
  }
  // A fine pointer leads a little light across the sheeting.
  if (finePointer && !reduced) {
    const sheen = $('.sl-plate-sheen'), to = gsap.quickTo(sheen, '--sweep', { duration: 1.4, ease: 'power3.out' });
    gsap.set(sheen, { '--sweep': '-20%' });
    $('.sl-hero').addEventListener('pointermove', event => { const box = body.getBoundingClientRect(); to(`${(110 - (event.clientX - box.left) / box.width * 120).toFixed(1)}%`); });
  }
  return input;
}

// "Start the appraisal": the number goes into the form and the record, and
// the page goes to the form.
function start() {
  const input = $('#plate-input');
  if (input.value.trim()) {
    field('registration').value = formatRegistration(input.value);
    field('registration').dispatchEvent(new Event('input', { bubbles: true }));
  }
  scrollToTarget($('#appraisal'));
  setTimeout(() => field('vehicle').focus({ preventScroll: true }), reduced ? 0 : 1300);
}

// ----------------------------------------------------------------- steps
// The odometer: six drums, each a ten-sided cylinder of digits. The last
// turns to the step being read; the list lights it.
function steps() {
  const odo = $('[data-odo]');
  const drums = Array.from({ length: 6 }, (_, index) => {
    const drum = document.createElement('span');
    drum.className = `sl-drum${index === 5 ? ' sl-drum--last' : ''}`;
    const roll = document.createElement('span');
    roll.className = 'sl-drum-roll';
    for (let digit = 0; digit < 10; digit++) {
      const face = document.createElement('span');
      face.className = 'sl-drum-face';
      face.append(Object.assign(document.createElement('i'), { textContent: digit }));
      face.style.transform = `rotateX(${-digit * 36}deg) translateZ(1.539em)`;
      roll.append(face);
    }
    drum.append(roll);
    odo.append(drum);
    return roll;
  });
  const last = drums[5];
  const turn = digit => gsap.set(last, { rotateX: digit * 36 });
  turn(1);
  const section = $('.sl-steps'), items = $$('.sl-step');
  if (reduced) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1001px) and (min-height: 640px)', () => {
    section.classList.add('is-pinned');
    // The drum's position lights the list: the step it shows is lit, the
    // others dim, and a step half turned to is half lit.
    const roll = { at: 1 };
    const show = () => {
      turn(roll.at);
      items.forEach((item, i) => item.style.setProperty('--lit', Math.max(0, 1 - Math.abs(roll.at - (i + 1))).toFixed(3)));
    };
    show();
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '[data-steps]', start: 'top top', end: () => `+=${Math.round(innerHeight * 2.4)}`, pin: true, scrub: .9, invalidateOnRefresh: true } });
    // Each turn of the drum is a click from one digit to the next: quick,
    // with a small overshoot, then it holds while its step is read.
    for (let i = 1; i < items.length; i++) tl.to(roll, { at: i + 1, duration: .35, ease: 'back.out(2.2)', onUpdate: show }, i - .5);
    tl.to({}, { duration: .5 });
    return () => { section.classList.remove('is-pinned'); items.forEach(item => item.style.removeProperty('--lit')); turn(1); };
  });
  mm.add('(max-width: 1000px), (max-height: 639px)', () => {
    // Not pinned: the drum turns to each step as it passes the middle.
    items.forEach((item, i) => ScrollTrigger.create({ trigger: item, start: 'top 60%', end: 'bottom 60%', onToggle: self => { if (self.isActive) gsap.to(last, { rotateX: (i + 1) * 36, duration: .7, ease: 'back.out(2)' }); } }));
  });
}

// ----------------------------------------------------------- the doors
function doors() {
  const panes = $$('[data-pane]');
  if (finePointer && !reduced && matchMedia('(min-width: 761px)').matches) {
    const open = pane => panes.forEach(other => gsap.to(other, { flexGrow: pane ? (other === pane ? 1.45 : .55) : 1, duration: 1.1, ease: 'expo.out', overwrite: true }));
    panes.forEach(pane => pane.addEventListener('pointerenter', () => open(pane)));
    $('[data-panes]').addEventListener('pointerleave', () => open(null));
  }
  $$('[data-choose]').forEach(button => button.addEventListener('click', () => {
    const exchange = field('exchange');
    exchange.checked = button.dataset.choose === 'exchange';
    exchange.dispatchEvent(new Event('change', { bubbles: true }));
    scrollToTarget($('#appraisal'));
  }));
}

// ------------------------------------------------------------ the record
const DRUMS = 7; // up to 20,00,000 km, the field's maximum
let received = false;
function record() {
  const card = $('[data-record]');
  const plateText = $('[data-record-plate]'), name = $('[data-record-name]'), km = $('[data-record-km]'), care = $('[data-record-care]');
  const mode = $('[data-record-mode]'), status = $('[data-record-status]');
  // The odometer: a strip of digits per place (the drums of styles.css).
  const holder = $('[data-record-odo]');
  const drums = Array.from({ length: DRUMS }, () => {
    const drum = document.createElement('span');
    drum.className = 'drum is-lead';
    const strip = document.createElement('span');
    strip.className = 'drum-strip';
    for (let d = 0; d <= 9; d++) strip.append(Object.assign(document.createElement('span'), { textContent: d }));
    drum.append(strip);
    holder.append(drum);
    return drum;
  });
  const careBoxes = $$('[data-care] input');
  const shown = { care: '' };
  const flash = element => { if (!reduced) gsap.fromTo(element, { textShadow: '0 0 18px rgba(242,191,94,.7)' }, { textShadow: '0 0 0 rgba(242,191,94,0)', duration: .9, ease: 'power2.out' }); };
  const set = (element, value, empty) => {
    const text = value || empty;
    if (element.textContent === text) return;
    element.textContent = text;
    element.classList.toggle('is-placeholder', !value);
    if (value) flash(element);
  };
  const sync = () => {
    const registration = field('registration').value.trim();
    set(plateText, registration ? formatRegistration(registration) : '', 'DL 3C AB 1234');
    set(name, field('vehicle').value.trim(), 'Your car');
    const kilometres = Number.parseInt(field('kilometres').value, 10);
    const valid = Number.isFinite(kilometres) && kilometres >= 0;
    const digits = String(valid ? Math.min(kilometres, 9999999) : 0).padStart(DRUMS, '0');
    const lead = digits.search(/[1-9]/);
    drums.forEach((drum, i) => { drum.firstChild.style.setProperty('--d', digits[i]); drum.classList.toggle('is-lead', lead === -1 || i < lead); });
    km.textContent = valid ? kilometresInWords(kilometres) : 'Distance driven';
    for (const key of ['year', 'city']) $(`[data-record="${key}"]`).textContent = field(key).value.trim() || '—';
    $('[data-record="owners"]').textContent = form.querySelector('[name="owners"]:checked')?.value.replace(' owner', '') || '—';
    const chosen = careBoxes.filter(box => box.checked).map(box => box.value);
    field('care').value = chosen.join(', ');
    if (shown.care !== field('care').value) {
      const before = new Set(shown.care ? shown.care.split(', ') : []);
      shown.care = field('care').value;
      care.replaceChildren(...chosen.map(value => Object.assign(document.createElement('li'), { textContent: value })));
      const added = [...care.children].filter(item => !before.has(item.textContent));
      if (added.length && !reduced) gsap.from(added, { autoAlpha: 0, scale: .8, duration: .5, ease: 'back.out(2.4)' });
    }
    const exchange = field('exchange').checked;
    if (mode.textContent !== (exchange ? 'To exchange' : 'To sell')) {
      mode.textContent = exchange ? 'To exchange' : 'To sell';
      if (!reduced) gsap.fromTo(mode, { rotateX: -90, autoAlpha: 0 }, { rotateX: 0, autoAlpha: 1, duration: .6, ease: 'back.out(2)' });
    }
  };
  form.addEventListener('input', event => { if (received && !event.isTrusted) return; if (received) clear(); sync(); });
  form.addEventListener('change', event => { if (received && event.isTrusted) clear(); sync(); });
  const clear = () => { received = false; card.classList.remove('is-received'); status.textContent = 'Appraised by our team, in person.'; };
  // Sent: the record keeps what was sent and says so.
  form.addEventListener('lead:result', event => {
    if (event.detail.status === 'failed') return;
    received = true;
    card.classList.add('is-received');
    status.textContent = event.detail.status === 'sent' ? 'Appraisal request received. We’ll call you.' : 'Ready to send. Choose how to share it below.';
    if (!reduced) gsap.fromTo($('.sl-record-inner'), { y: 0 }, { y: -6, duration: .25, yoyo: true, repeat: 1, ease: 'power2.out' });
  });
  sync();
}

// ---------------------------------------------------------- the questions
// Each answer opens to its height and closes again; one at a time.
function questions() {
  const all = $$('.sl-q');
  all.forEach(item => {
    const summary = $('summary', item), body = $('.sl-q-body', item);
    summary.addEventListener('click', event => {
      if (reduced) return;
      event.preventDefault();
      if (item.open) {
        gsap.to(body, { height: 0, duration: .55, ease: 'expo.inOut', onComplete: () => { item.open = false; gsap.set(body, { clearProps: 'height' }); } });
      } else {
        all.filter(other => other !== item && other.open).forEach(other => $('summary', other).click());
        item.open = true;
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: .7, ease: 'expo.out', clearProps: 'height' });
        gsap.fromTo($('p', body), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, ease: 'expo.out', delay: .08 });
      }
    });
  });
}

// --------------------------------------------------------------- headings
function headings() {
  if (reduced) return;
  $$('.sl-head').forEach(head => {
    const lines = $$('.fl-line > span', head), words = $$('p', head);
    gsap.timeline({ defaults: { ease: 'expo.out' }, scrollTrigger: { trigger: head, start: 'top 82%', once: true } })
      .fromTo(lines, { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: .1 })
      .fromTo(words, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08 }, .3);
  });
  // The doors' words come up as they are reached.
  $$('[data-pane]').forEach(pane => gsap.fromTo([...$$('h3 > *', pane), $('.sl-pane-more', pane)], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: pane, start: 'top 70%', once: true } }));
}

// ----------------------------------------------------------------- start
plate();
$('[data-start]').addEventListener('click', start);
steps();
doors();
record();
questions();
headings();
document.fonts.ready.then(() => ScrollTrigger.refresh());
if (import.meta.env.DEV) window.__sell = { start, field };
