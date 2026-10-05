import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from './split-words.js';
import { createLightRays } from './light-rays.js';
gsap.registerPlugin(ScrollTrigger);

// The Baba standard, set in motion. One orchestrated entrance as the section
// arrives: the coachline draws out from its centre and gold light falls from
// it (light-rays.js, after React Bits' LightRays); the headline blurs into
// focus word by word (after React Bits' BlurText) and its second line then
// catches the light now and then (ShinyText); the rows rule themselves in.
// After that, motion only answers the visitor: a warm spotlight follows the
// pointer along each row (SpotlightCard), and the steps open and close as an
// accordion, one at a time. Without motion the section stays as authored
// and the rows open natively.
export function setupStandard(section, { motion = true } = {}) {
  const items = [...section.querySelectorAll('.standard-item')].map(item => {
    const details = item.querySelector('details');
    return { item, details, body: details.querySelector('.detail-body'), text: details.querySelector('.detail-body p'), line: item.querySelector('.detail-line'), closing: false };
  });
  const refresh = () => ScrollTrigger.refresh();
  if (!motion) {
    items.forEach(({ details }) => details.addEventListener('toggle', refresh));
    return;
  }
  section.classList.add('is-animated');

  // Spotlight: the light sits under the pointer, in the row's own pixels.
  items.forEach(({ item }) => item.addEventListener('pointermove', event => {
    const rect = item.getBoundingClientRect();
    item.style.setProperty('--mouse-x', `${(event.clientX - rect.left).toFixed(1)}px`);
    item.style.setProperty('--mouse-y', `${(event.clientY - rect.top).toFixed(1)}px`);
  }));

  // Accordion. The native element keeps its semantics and keyboard
  // behaviour; only the opening and closing are drawn out.
  const expand = entry => {
    const { details, body, text, line } = entry;
    const fromClosed = !details.open;
    gsap.killTweensOf([body, text, line]);
    entry.closing = false;
    details.open = true;
    items.forEach(other => { if (other !== entry && other.details.open && !other.closing) collapse(other); });
    if (fromClosed) {
      gsap.set(body, { height: 0 });
      gsap.set(text, { opacity: 0, y: 18, filter: 'blur(8px)' });
      gsap.set(line, { scaleX: 0, transformOrigin: 'left center' });
    }
    gsap.timeline({ onComplete: () => { gsap.set(body, { height: 'auto' }); gsap.set(text, { clearProps: 'filter' }); refresh(); } })
      .to(body, { height: 'auto', duration: .8, ease: 'power3.inOut' }, 0)
      .to(text, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .8, ease: 'power2.out' }, .22)
      .to(line, { scaleX: 1, transformOrigin: 'left center', duration: 1.2, ease: 'power3.inOut' }, .05);
  };
  const collapse = entry => {
    const { details, body, text, line } = entry;
    gsap.killTweensOf([body, text, line]);
    entry.closing = true;
    gsap.timeline({ onComplete: () => { details.open = false; entry.closing = false; refresh(); } })
      .to(text, { opacity: 0, y: -8, filter: 'blur(6px)', duration: .35, ease: 'power2.in' }, 0)
      .to(body, { height: 0, duration: .65, ease: 'power3.inOut' }, .08)
      .to(line, { scaleX: 0, transformOrigin: 'right center', duration: .7, ease: 'power3.inOut' }, 0);
  };
  items.forEach(entry => {
    if (!entry.details.open) gsap.set(entry.body, { height: 0 });
    gsap.set(entry.line, { scaleX: entry.details.open ? 1 : 0 });
    entry.details.querySelector('summary').addEventListener('click', event => {
      event.preventDefault();
      if (!entry.details.open || entry.closing) expand(entry); else collapse(entry);
    });
  });

  // The entrance, held until the section comes into view.
  const raysHost = section.querySelector('.standard-rays');
  let rays = null;
  try {
    rays = createLightRays(raysHost, { origin: [.5, -.22], color: '#ffd896', speed: .7, spread: 1.15, length: 2.2, fadeDistance: 1.3, mouseInfluence: .14, noiseAmount: .06, distortion: .05, maxRatio: 1 });
  } catch (error) { console.warn('Light rays unavailable.', error); }
  const eyebrow = section.querySelector('.eyebrow');
  const headline = section.querySelector('h2'), turn = headline.querySelector('em');
  const intro = section.querySelector('.standard-copy .intro');
  const words = splitWords(headline, 'blur-word');
  const summaries = items.map(({ details }) => details.querySelector('summary'));
  const openText = items.filter(({ details }) => details.open).map(({ text }) => text);

  headline.classList.add('is-revealing');
  gsap.set(words, { opacity: 0, y: -46, filter: 'blur(10px)' });
  const settleHeadline = () => {
    headline.classList.remove('is-revealing');
    gsap.set(words, { clearProps: 'all' });
    turn?.classList.add('is-shiny');
  };
  const entrance = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' }, onComplete: () => gsap.set([intro, eyebrow, ...summaries, ...openText], { clearProps: 'filter' }) })
    .fromTo(section, { '--coach': 0 }, { '--coach': 1, duration: 1.5, ease: 'power2.inOut' }, 0)
    .fromTo(raysHost, { opacity: 0 }, { opacity: rays ? 1 : 0, duration: 2.6, ease: 'power1.inOut' }, .35)
    .fromTo(eyebrow, { '--eyebrow-rule': 0 }, { '--eyebrow-rule': 1, duration: .9, ease: 'power2.inOut' }, .2)
    .from(eyebrow, { opacity: 0, x: -10, duration: .9 }, .3)
    // BlurText's default keyframes: from blurred and above, through half
    // focus, to rest; one word after another.
    .to(words, {
      keyframes: [{ opacity: .5, y: 5, filter: 'blur(5px)', duration: .38, ease: 'power1.out' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .38, ease: 'power1.out' }],
      stagger: .11, onComplete: settleHeadline,
    }, .4)
    .from(intro, { opacity: 0, y: 18, filter: 'blur(6px)', duration: 1.1 }, '>-.45')
    .fromTo(items.map(({ item }) => item), { '--rule-draw': 0 }, { '--rule-draw': 1, duration: 1.2, stagger: .14, ease: 'power3.inOut' }, .5)
    .from(summaries, { opacity: 0, y: 26, duration: 1, stagger: .14 }, .7)
    .from(openText, { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1 }, 1.1);
  // Ends at the bottom of the page, so landing below the section plays it too.
  ScrollTrigger.create({ trigger: section, start: 'top 72%', end: 'max', once: true, refreshPriority: -1, onEnter: () => entrance.play() });

  return { dispose() { entrance.kill(); rays?.dispose(); } };
}
