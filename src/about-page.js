// About Baba Luxury Cars (/about/). Seven movements, each with one idea:
//
//   The unveiling   a Maybach under an ivory silk cover, drawn away by the
//                   scroll (unveil.js, cloth.js)
//   Our story       the manifesto comes into focus as it is read (after React
//                   Bits' Scroll Reveal)
//   The figures     a dashboard's rotating display turns from walnut to
//                   three dials to a navigation screen (fascia.js)
//   The inspection  a black Defender on a studio turntable, turned by the
//                   scroll as each check is ticked (inspect-stage.js)
//   The paperwork   the documents, dealt one on another into a dossier
//                   (after React Bits' Scroll Stack)
//   Across India    Baba's handover photographs, each whole, in a run the
//                   scroll draws past
//   The showroom    where, when, and every line, with the showroom's clock
//                   keeping New Delhi time
//
// Desktop scrolls through ScrollSmoother, created before any ScrollTrigger.
// Reduced motion shows every section set and still. The stylesheets are
// linked from the page's head, so the page is never seen without them.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';
import { setupPage } from './chrome.js';
import { loadSite } from './data.js';
import { dealer, dealerLines, deliveryPhotos, figures } from './config.js';
import { escapeHTML, safeImage, thumbImage } from './util.js';
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

if (!reduced && finePointer && innerWidth > 760) ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: .9, effects: false });
const { renderContact } = setupPage('about');
document.body.classList.toggle('is-reduced', reduced);

// ------------------------------------------------------------ the unveiling
// The words arrive at once; the car and its cover follow when they are ready,
// the line beside "Scroll to unveil" filling as they load. The words are
// animated by the browser (the Web Animations API), not from here, so they
// come up smoothly while this thread is busy building the stage, and are not
// begun again when the section is moved into its pin. Arriving through the
// lacquer panel (fx/transition.js), they wait for it to lift.
const hero = $('.ab-unveil');
const heroIntro = () => {
  hero.classList.add('is-in');
  if (reduced) return;
  const settle = 'cubic-bezier(.16,1,.3,1)';
  $$('.ab-line > span', hero).forEach((line, i) => line.animate([{ transform: 'translateY(130%)' }, { transform: 'none' }], { duration: 1800, delay: 100 + i * 120, easing: settle, fill: 'backwards' }));
  $$('[data-hero-reveal]', hero).forEach((element, i) => element.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 1400, delay: 350 + i * 100, easing: settle, fill: 'backwards' }));
  $('[data-unveil-cue]', hero).animate([{ opacity: 0 }], { duration: 1200, delay: 600, fill: 'backwards' });
};
{
  const root = document.documentElement;
  if (!root.classList.contains('curtain-in')) heroIntro();
  else {
    const lifted = new MutationObserver(() => { if (!root.classList.contains('curtain-in')) { lifted.disconnect(); heroIntro(); } });
    lifted.observe(root, { attributes: true, attributeFilter: ['class'] });
  }
}
// Settles once the hero's stage has loaded, or cannot: the stages further
// down the page wait for it, so they never compete with it for the first
// seconds.
let heroSettled;
if (reduced) { hero.classList.add('is-static'); heroSettled = Promise.resolve(); }
else {
  const bar = $('[data-unveil-load] b', hero);
  heroSettled = import('./unveil.js').then(({ createUnveil }) => {
    const unveil = createUnveil(hero, { onProgress: value => { bar.style.transform = `scaleX(${value.toFixed(3)})`; } });
    return unveil.loaded.then(() => ScrollTrigger.refresh());
  }).catch(error => { console.error(error); hero.classList.add('is-static'); });
}

// --------------------------------------------------------------- our story
// Each word comes out of a soft blur as the paragraph is read. Nothing else
// moves: the statement is set at a reading size, and left alone.
const statement = $('[data-scroll-reveal]');
if (!reduced) {
  const split = SplitText.create(statement, { type: 'words', wordsClass: 'sr-word' });
  gsap.fromTo(split.words, { opacity: .16, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)', ease: 'none', stagger: .05, scrollTrigger: { trigger: statement, start: 'top 84%', end: 'bottom 60%', scrub: true, refreshPriority: -1 } });
}

// ------------------------------------------------------------ the mastheads
// A section's head arrives as it is set: the title's two lines rise out of
// their own, and the sentence settles at the right.
if (!reduced) $$('[data-mast]').forEach(mast => {
  const arrive = gsap.timeline({ scrollTrigger: { trigger: mast, start: 'top 88%', once: true, refreshPriority: -1 }, defaults: { ease: 'expo.out' } })
    .from($$('h2 > * > span', mast), { yPercent: 118, duration: 1.7, stagger: .14 });
  const sentence = $('.ab-mast-intro', mast);
  if (sentence) arrive.from(sentence, { autoAlpha: 0, y: 16, duration: 1.3 }, .5);
});
// Where a section is pinned and scrolled through: a screen large enough to
// hold it whole.
const large = matchMedia('(min-width: 1001px) and (min-height: 560px)').matches;

// -------------------------------------------------------------- the figures
// The figures in story order (the years, the people, how they felt), from
// the site's own figures: on the dials, and as type where the display
// cannot run.
const figuresSection = $('#figures');
const byLabel = word => figures.find(figure => figure.label.toLowerCase().includes(word));
const readings = [byLabel('year'), byLabel('client'), byLabel('satisf')].filter(Boolean);
$('[data-readings]', figuresSection).innerHTML = [
  ...readings.map(r => `<div><dt>${escapeHTML(r.label)}</dt><dd>${r.value}<small>${escapeHTML(r.suffix)}</small></dd></div>`),
  '<div class="fa-reach"><dt>Delivered to</dt><dd>Almost every state in India</dd></div>',
].join('');
// Where the handovers went: the built-in set until the site's own arrives.
let places = deliveryPhotos.map(photo => photo.city).filter(Boolean), fascia = null;
if (reduced) figuresSection.classList.add('is-static');
else heroSettled.then(() => import('./fascia.js')).then(({ createFascia }) => {
  fascia = createFascia(figuresSection, { readings, destinations: places });
  fascia.loaded.then(() => ScrollTrigger.refresh());
  ScrollTrigger.refresh();
}).catch(error => { console.error(error); figuresSection.classList.add('is-static'); });

// ----------------------------------------------------------- the inspection
// On paper: the sheet, and beside it a black Defender on a studio turntable
// (inspect-stage.js). The section is pinned and the scroll turns the table
// from one check to the next, resting a moment on each: the check it has
// come to is read out, and ticked once the car has stopped there. Scrolling
// back turns it back. Reduced motion shows the sheet filled in beside a
// photograph. The header is set in ink while the paper is under it.
const inspection = $('#inspection'), siteHeader = $('.site-header');
{
  const half = () => siteHeader.offsetHeight / 2;
  const ink = (start, end, trigger) => ScrollTrigger.create({ trigger, start, end, refreshPriority: 1, onToggle: self => siteHeader.classList.toggle('is-light', self.isActive) });
  const rows = $$('[data-check]', inspection);
  if (reduced) {
    inspection.classList.add('is-static', 'is-plain');
    ink(() => `top ${half()}`, () => `bottom ${half()}`, inspection);
  } else {
    // The table's round is a leg to each check and one more to stand the car
    // whole again; the last part of every leg is spent at rest on its stop.
    const legs = rows.length + 1, REST = .3, ease = gsap.parseEase('power2.inOut');
    const place = progress => { const x = Math.min(legs - 1e-6, progress * legs), leg = Math.floor(x); return leg + ease(Math.min(1, (x - leg) / (1 - REST))); };
    let stage = null, at = 0;
    const show = () => {
      const current = gsap.utils.clamp(0, rows.length - 1, Math.floor(at + .5) - 1);
      rows.forEach((row, i) => { row.classList.toggle('is-on', at >= i + .98); row.classList.toggle('is-current', i === current); });
      stage?.set(at);
    };
    // Measured before the pins below it.
    const pin = ScrollTrigger.create({ trigger: inspection, start: 'top top', end: () => `+=${Math.round(innerHeight * 3.3)}`, pin: true, invalidateOnRefresh: true, refreshPriority: 1, onUpdate: self => { at = place(self.progress); show(); } });
    ink(() => pin.start - half(), () => pin.end + inspection.offsetHeight - half());
    show();
    // The car loads as the visitor nears, and is drawn only while on screen.
    let started = false;
    ScrollTrigger.create({
      trigger: inspection, start: 'top bottom+=1400', end: () => pin.end + innerHeight, refreshPriority: 1,
      onToggle: self => {
        stage?.setActive(self.isActive);
        if (!self.isActive || started) return;
        started = true;
        import('./inspect-stage.js').then(({ createInspectStage }) => {
          stage = createInspectStage($('[data-inspect-stage]', inspection), { phone: innerWidth <= 760 || matchMedia('(pointer: coarse)').matches });
          stage.set(at);
          return stage.loaded;
        }).then(() => inspection.classList.add('is-ready')).catch(error => { console.error('The inspection car is unavailable; keeping the photograph.', error); inspection.classList.add('is-static'); });
      },
    });
  }
}

// ------------------------------------------------------------ the paperwork
// The dossier. Large screens pin it and deal each card onto the last (after
// React Bits' Scroll Stack): the card comes up from below, its paper
// straightening as it lands, a band of light crossing the paper and its name
// and sentence rising beside it. Each card stands one tab lower than the
// last, so the tabs of those beneath stay in sight; they step back a little
// and dim.
// Elsewhere each card simply arrives.
const dossier = $('#paperwork'), docs = $$('[data-doc]', dossier);
const staged = matchMedia('(min-width: 1001px) and (min-height: 700px)').matches;
if (!reduced && staged) {
  dossier.classList.add('is-stacked');
  const paper = doc => $('.doc', doc), words = doc => $$('.ab-doc-copy > *', doc);
  docs.forEach((doc, i) => doc.style.setProperty('--i', i));
  gsap.set(docs.slice(1), { yPercent: 118 });
  docs.slice(1).forEach(doc => { gsap.set(paper(doc), { rotate: -10, '--sheen': '0%' }); gsap.set(words(doc), { opacity: 0, y: 36 }); });
  const deal = gsap.timeline({ defaults: { ease: 'power2.out' } });
  docs.forEach((doc, i) => {
    if (!i) return;
    const at = i - 1;
    deal.to(doc, { yPercent: 0, duration: 1 }, at)
      .to(paper(doc), { rotate: -3, duration: 1 }, at)
      .to(paper(doc), { '--sheen': '100%', duration: .85, ease: 'power1.inOut' }, at + .3)
      .to(words(doc), { opacity: 1, y: 0, duration: .45, stagger: .09 }, at + .5);
    docs.slice(0, i).forEach((under, depth) => {
      const level = i - depth;
      deal.to(under, { scale: 1 - level * .022, '--dim': Math.min(.7, level * .24), duration: 1 }, at);
    });
  });
  deal.to({}, { duration: .4 });
  ScrollTrigger.create({ trigger: dossier, start: 'top top', end: () => `+=${Math.round(innerHeight * .75 * (docs.length - 1 + .4))}`, pin: true, scrub: .6, animation: deal, invalidateOnRefresh: true });
} else if (!reduced) {
  docs.forEach(doc => gsap.from(doc, { autoAlpha: 0, y: 60, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: doc, start: 'top 88%', once: true, refreshPriority: -1 } }));
}

// ------------------------------------------------------------ the handovers
// A run of the handover photographs, each whole and at its own shape. On a
// large screen the section is pinned and the scroll draws the run past, a
// line under it keeping count; elsewhere it is swiped.
const runSection = $('#handovers'), run = $('[data-run]', runSection), track = $('[data-run-track]', runSection);
function buildRun(photos) {
  if (!photos.length) { runSection.hidden = true; return; }
  const two = n => String(n).padStart(2, '0');
  track.innerHTML = photos.map((photo, i) => `<figure class="ab-shot" role="listitem"><img src="${escapeHTML(photo.card || thumbImage(photo.photo))}" alt="${escapeHTML(photo.caption || `A Baba Luxury Cars handover${photo.city ? `, delivered to ${photo.city}` : ''}`)}" decoding="async" draggable="false" /><figcaption><i>${two(i + 1)}</i><b>${escapeHTML(photo.city || 'A new owner')}</b></figcaption></figure>`).join('');
  $('[data-run-total]', runSection).textContent = two(photos.length);
  if (reduced || !large) return;
  runSection.classList.add('is-drawn');
  const count = $('[data-run-count]', runSection), bar = $('[data-run-bar]', runSection);
  const distance = () => Math.max(0, track.scrollWidth - run.clientWidth);
  ScrollTrigger.create({
    trigger: runSection, start: 'top top', end: () => `+=${Math.round(distance())}`, pin: true, scrub: .7, invalidateOnRefresh: true,
    animation: gsap.to(track, { x: () => -distance(), ease: 'none' }),
    onUpdate: self => { bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; count.textContent = two(1 + Math.round(self.progress * (photos.length - 1))); },
  });
  // The photographs come to their widths as they load: the run is measured again.
  let again = 0;
  const measure = () => { clearTimeout(again); again = setTimeout(() => ScrollTrigger.refresh(), 150); };
  $$('img', track).forEach(image => { if (!image.complete) image.addEventListener('load', measure, { once: true }); });
  gsap.from($$('.ab-shot', track), { autoAlpha: 0, x: 90, duration: 1.5, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: run, start: 'top 88%', once: true, refreshPriority: -1 } });
}

// ------------------------------------------------------------ the showroom
const visit = $('#visit');
const IST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
const nowInDelhi = () => {
  const parts = Object.fromEntries(IST.formatToParts(new Date()).map(({ type, value }) => [type, Number(value)]));
  return { h: parts.hour, m: parts.minute, s: parts.second + new Date().getMilliseconds() / 1000 };
};
// Open every day from 11 am to 8 pm, New Delhi time.
function status() {
  const { h, m } = nowInDelhi(), minutes = h * 60 + m;
  const open = minutes >= 11 * 60 && minutes < 20 * 60;
  const element = $('[data-visit-status]', visit);
  element.classList.toggle('is-open', open);
  $('span', element).textContent = open ? 'Open now, until 8 pm' : minutes < 11 * 60 ? 'Closed now, opens at 11 am' : 'Closed now, opens tomorrow at 11 am';
}
function lines() {
  const tel = number => number.replace(/[^+\d]/g, '');
  const digits = String(dealer.whatsapp || '').replace(/\D/g, '');
  const rows = [
    dealer.phone && `<div><dt>Sales${digits ? ' and WhatsApp' : ''}</dt><dd><a href="tel:${tel(dealer.phone)}">${escapeHTML(dealer.phone)}</a>${digits ? `<a class="ab-wa" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</dd></div>`,
    ...dealerLines.map(line => `<div><dt>${escapeHTML(line.label)}</dt><dd><a href="tel:${tel(line.phone)}">${escapeHTML(line.phone)}</a></dd></div>`),
  ].filter(Boolean);
  $('[data-visit-lines]', visit).innerHTML = rows.join('');
  if (dealer.address) $('[data-visit-address]', visit).textContent = dealer.address;
}
// The showroom clock: New Delhi time, the seconds hand sweeping.
function clock() {
  const figure = $('[data-clock]', visit), faceGroup = $('[data-clock-face]', figure);
  const at = (r, deg) => [200 + r * Math.sin(deg * Math.PI / 180), 200 - r * Math.cos(deg * Math.PI / 180)].map(v => v.toFixed(2));
  let marks = '', batons = '', rays = '';
  for (let i = 0; i < 60; i++) {
    const [x1, y1] = at(168, i * 6), [x2, y2] = at(i % 5 ? 173 : 175, i * 6);
    marks += `<line class="ck-mark" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    // Applied batons at the hours, but for the four that are numerals: each
    // a polished bar, with the shadow it throws on the dial.
    if (i % 5 === 0 && i % 15) batons += `<g transform="rotate(${i * 6} 200 200)"><rect x="198.6" y="37.4" width="5" height="21" rx="1" fill="#000" opacity=".55"/><rect x="197.5" y="36" width="5" height="21" rx="1" fill="url(#ck-gold-bar)"/></g>`;
  }
  // The dial's sunburst: fine rays from the centre, some catching the light.
  for (let i = 0; i < 120; i++) { const [x, y] = at(166, i * 3 + (i % 2)); rays += `<line x1="200" y1="200" x2="${x}" y2="${y}" stroke="#fff" stroke-width="${i % 3 ? 1.2 : 2.4}" opacity="${(.012 + .03 * Math.abs(Math.sin(i * 1.7)) * Math.max(0, Math.cos((i * 3 - 315) * Math.PI / 180))).toFixed(3)}"/>`; }
  const numerals = [12, 3, 6, 9].map(n => { const [x, y] = at(138, n * 30); return `<text class="ck-num" x="${x}" y="${y}">${n}</text>`; }).join('');
  const metal = (id, x2, y2, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  faceGroup.innerHTML = `<defs>
    ${metal('ck-gold', 1, 1, [[0, '#f8e3ad'], [.2, '#b5843d'], [.42, '#f4d28e'], [.6, '#8b5b27'], [.82, '#e6bd74'], [1, '#9a6a30']])}
    ${metal('ck-gold-in', 1, 1, [[0, '#7d5123'], [.35, '#e9c47e'], [.6, '#a9783a'], [1, '#f6dfa6']])}
    ${metal('ck-gold-bar', 1, 0, [[0, '#fbe9b8'], [.5, '#d7a655'], [1, '#8f6129']])}
    <radialGradient id="ck-gold-cap" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff0c4"/><stop offset=".5" stop-color="#d7a655"/><stop offset="1" stop-color="#6f4a1e"/></radialGradient>
    <radialGradient id="ck-dial" cx=".4" cy=".32" r=".85"><stop offset="0" stop-color="#232327"/><stop offset=".5" stop-color="#0e0e10"/><stop offset="1" stop-color="#030304"/></radialGradient>
    <radialGradient id="ck-crystal" cx=".3" cy=".18" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".3" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="ck-edge" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
    <filter id="ck-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <ellipse cx="200" cy="214" rx="186" ry="184" fill="#000" opacity=".75" filter="url(#ck-soft)"/>
  <circle cx="200" cy="200" r="197" fill="url(#ck-gold)"/><circle cx="200" cy="200" r="189" fill="url(#ck-gold-in)"/>
  <circle cx="200" cy="200" r="183.5" fill="#060607"/><circle cx="200" cy="200" r="180" fill="url(#ck-dial)"/>
  ${rays}<circle cx="200" cy="200" r="180" fill="url(#ck-edge)"/>
  ${marks}${batons}${numerals}<image href="/brand/baba-luxury-car-800.webp" x="150" y="252" width="100" height="31" opacity=".9"/>`;
  // The crystal over the hands: its dome's highlight, and one clean reflection.
  $('[data-clock-glass]', figure).innerHTML = '<circle cx="200" cy="200" r="181" fill="url(#ck-crystal)"/><path d="M62 150A148 148 0 0 1 176 54" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="13" stroke-linecap="round" style="filter:blur(3px)"/>';
  const hands = { h: $('[data-hand="h"]', figure), m: $('[data-hand="m"]', figure), s: $('[data-hand="s"]', figure) };
  // Each hand's shadow turns with it, about the same arbor, a little down and to the right of it.
  const shadows = { h: $('[data-shadow="h"]', figure), m: $('[data-shadow="m"]', figure), s: $('[data-shadow="s"]', figure) };
  const label = $('[data-clock-time]', figure);
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
  let lastLabel = '';
  const tick = () => {
    const { h, m, s } = nowInDelhi();
    gsap.set(hands.s, { rotation: s * 6, svgOrigin: '200 200' });
    gsap.set(shadows.s, { rotation: s * 6, svgOrigin: '203 205' });
    gsap.set(hands.m, { rotation: (m + s / 60) * 6, svgOrigin: '200 200' });
    gsap.set(shadows.m, { rotation: (m + s / 60) * 6, svgOrigin: '203 205' });
    gsap.set(hands.h, { rotation: ((h % 12) + m / 60) * 30, svgOrigin: '200 200' });
    gsap.set(shadows.h, { rotation: ((h % 12) + m / 60) * 30, svgOrigin: '203 205' });
    const text = time.format(new Date());
    if (text !== lastLabel) { lastLabel = text; label.textContent = text; status(); }
  };
  tick();
  if (reduced) { setInterval(tick, 30000); return; }
  let running = false;
  ScrollTrigger.create({ trigger: figure, start: 'top bottom', end: 'bottom top', onToggle: self => { if (self.isActive !== running) { running = self.isActive; running ? gsap.ticker.add(tick) : gsap.ticker.remove(tick); } } });
  gsap.from($$('.ck-mark', figure), { autoAlpha: 0, duration: .6, stagger: { each: .012, from: 'start' }, scrollTrigger: { trigger: figure, start: 'top 80%', once: true, refreshPriority: -1 } });
}
status(); lines(); clock();

loadSite().then(site => {
  renderContact?.();
  lines(); status();
  const builtIn = site.settings.gallery?.builtIn === false ? [] : deliveryPhotos;
  places = [...site.deliveries.map(delivery => delivery.city), ...builtIn.map(photo => photo.city)].filter(Boolean);
  fascia?.setDestinations(places);
  buildRun([
    ...site.deliveries.filter(delivery => safeImage(delivery.photo)),
    ...builtIn.map(({ city, card, full, caption }) => ({ city, caption, photo: full, card })),
  ]);
  ScrollTrigger.refresh();
}).catch(error => console.error('The page data is unavailable.', error));
