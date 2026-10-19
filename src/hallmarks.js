// The collection page's promises, each under a hallmark: a gold-foil seal
// with the dealership's name and city around its rim and a mark for the
// promise at its centre (an inspection loupe, the papers, the rupee, a route
// across the country). As the band comes into view the seals press into the
// paper one after another, the way a die stamps foil: down out of the air,
// a small give on contact and a ring of pressure spreading through the
// paper. Then a light runs across the foil, the centre mark draws itself and
// the words rise. Under a fine pointer a seal tilts towards it and the foil
// catches the light where the pointer is. On phones and tablets they simply
// fade in, set. Reduced motion shows them set.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(ScrollTrigger, SplitText);

const RIM = 'Baba Luxury Cars · New Delhi · Baba Luxury Cars · New Delhi · ';
// Each mark in the seal's 120-unit square, inside the inner ring (r 35).
// `draw` strokes draw themselves; the rest fade in after them.
const GLYPHS = {
  loupe: '<circle class="draw" pathLength="1" cx="56" cy="56" r="10.5"/><path class="draw" pathLength="1" d="M63.6 63.6 73 73" stroke-width="2.6"/><path class="draw" pathLength="1" d="M50.5 53.5a6.5 6.5 0 0 1 4-4"/>',
  papers: '<path class="draw" pathLength="1" d="M50 43h14l8 8v26H50z"/><path class="draw" pathLength="1" d="M64 43v8h8"/><path class="draw" pathLength="1" d="M55 58h12M55 63.5h12M55 69h7"/>',
  rupee: '<path class="draw" pathLength="1" d="M49 46h22M49 53h22"/><path class="draw" pathLength="1" d="M54 46c11 0 12.5 13 1 14h-4.5L66 76"/>',
  route: '<path class="fade" d="M46 70C47 54 60 46 72.5 50" stroke-dasharray="2.2 3.2"/><circle class="draw" pathLength="1" cx="45.5" cy="72.5" r="2.4"/><path class="draw" pathLength="1" d="M75 57.5c-3.4-4.3-5.4-6.8-5.4-9.4a5.4 5.4 0 0 1 10.8 0c0 2.6-2 5.1-5.4 9.4z"/><circle class="draw" pathLength="1" cx="75" cy="48.3" r="1.6"/>',
};

function sealSVG(glyph, k) {
  return `<span class="c-seal-die"><svg viewBox="0 0 120 120" focusable="false">
    <defs>
      <linearGradient id="foil-${k}" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="120" y2="100" gradientTransform="translate(0 0)">
        <stop offset="0" stop-color="#7d4d22"/><stop offset=".3" stop-color="#b98336"/><stop offset=".44" stop-color="#e9c47a"/>
        <stop offset=".5" stop-color="#fff2cf"/><stop offset=".56" stop-color="#e2b562"/><stop offset=".74" stop-color="#a06c2c"/><stop offset="1" stop-color="#6e4219"/>
      </linearGradient>
      <path id="rim-${k}" d="M60 60m-40.5 0a40.5 40.5 0 1 1 81 0a40.5 40.5 0 1 1-81 0"/>
    </defs>
    <g fill="none" stroke="url(#foil-${k})">
      <circle cx="60" cy="60" r="57" stroke-width="1.5"/><circle cx="60" cy="60" r="53.2" stroke-width=".55"/><circle cx="60" cy="60" r="35" stroke-width=".55"/>
    </g>
    <text fill="url(#foil-${k})" font-size="8.2" font-style="italic"><textPath href="#rim-${k}" textLength="252" lengthAdjust="spacing">${RIM}</textPath></text>
    <g class="c-seal-glyph" fill="none" stroke="url(#foil-${k})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph] || ''}</g>
  </svg></span><i class="c-seal-ring"></i>`;
}

export function createHallmarks(band, { reduced = false, finePointer = false } = {}) {
  if (!band) return;
  const items = [...band.querySelectorAll('.c-promise')];
  items.forEach((item, k) => { const seal = item.querySelector('[data-seal]'); seal.innerHTML = sealSVG(seal.dataset.seal, k); });
  const foil = k => items[k].querySelector('linearGradient');
  const sheen = (k, at) => foil(k).setAttribute('gradientTransform', `translate(${at.toFixed(1)} ${(at * .35).toFixed(1)})`);
  if (reduced) return;

  // The light on the foil, by item: -120 before the seal, 0 resting, 120 past it.
  const light = items.map(() => ({ at: -120 }));
  const shine = k => sheen(k, light[k].at);
  items.forEach((_, k) => shine(k));

  const media = gsap.matchMedia();
  media.add({ wide: '(min-width: 900px)', narrow: '(max-width: 899px)' }, ({ conditions }) => {
    // Phones and tablets: each seal and its words simply come into view where
    // they stand, already pressed and lit, in one light fade. No fall from
    // the air, no running light, no lines drawing: nothing a phone repaints
    // frame by frame, and nothing that moves up and down as the page scrolls.
    if (conditions.narrow) {
      items.forEach((_, k) => { light[k].at = 0; shine(k); });
      const parts = items.map(item => [...item.querySelectorAll('.c-seal-die, .c-promise-copy')]);
      gsap.set(parts.flat(), { autoAlpha: 0 });
      const reveal = gsap.timeline({ paused: true }).fromTo(band, { '--rule': 0 }, { '--rule': 1, duration: 1.2, ease: 'power2.inOut' }, 0);
      parts.forEach((part, k) => reveal.to(part, { autoAlpha: 1, duration: .8, ease: 'power1.out' }, .15 + k * .1));
      const trigger = ScrollTrigger.create({ trigger: band, start: 'top 88%', once: true, onEnter: () => reveal.play() });
      return () => { trigger.kill(); reveal.kill(); gsap.set(parts.flat(), { clearProps: 'opacity,visibility' }); };
    }
    const titles = items.map(item => SplitText.create(item.querySelector('.c-promise-title'), { type: 'words', mask: 'words' }).words);
    const dies = items.map(item => item.querySelector('.c-seal-die'));
    gsap.set(dies, { autoAlpha: 0, scale: 1.9, rotationX: 38, rotationZ: -16, y: -46, transformPerspective: 600 });
    gsap.set(items.map(item => item.querySelector('.c-seal-ring')), { autoAlpha: 0, scale: .8 });
    gsap.set(band.querySelectorAll('.c-seal-glyph .draw'), { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(band.querySelectorAll('.c-seal-glyph .fade'), { autoAlpha: 0 });
    gsap.set(items.map(item => item.querySelector('.c-promise-note')), { autoAlpha: 0, y: 12 });
    const timeline = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .fromTo(band, { '--rule': 0 }, { '--rule': 1, duration: 1.6, ease: 'expo.inOut' }, 0);
    items.forEach((item, k) => {
      // Down, accelerating, onto the paper; each settles a few degrees off
      // true, as a hand-pressed stamp does.
      const at = .25 + k * (conditions.wide ? .22 : .16), rest = [-4, 3, -2, 5][k % 4];
      timeline.to(dies[k], { autoAlpha: 1, scale: 1, rotationX: 0, rotationZ: rest, y: 0, duration: .5, ease: 'power4.in' }, at)
        .to(dies[k], { scale: .955, duration: .07, ease: 'power2.out' }, at + .5)
        .to(dies[k], { scale: 1, duration: .6, ease: 'elastic.out(1.1, .45)' }, at + .57)
        .fromTo(item.querySelector('.c-seal-ring'), { autoAlpha: .55, scale: .9 }, { autoAlpha: 0, scale: 1.75, duration: 1.1, ease: 'power2.out' }, at + .5)
        .fromTo(light[k], { at: -120 }, { at: 120, duration: 1.4, ease: 'power2.inOut', onUpdate: () => shine(k) }, at + .55)
        .to(light[k], { at: 0, duration: 1.2, ease: 'power2.out', onUpdate: () => shine(k) }, at + 1.95)
        .to(item.querySelectorAll('.c-seal-glyph .draw'), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: .12 }, at + .65)
        .fromTo(titles[k], { yPercent: 105 }, { yPercent: 0, duration: 1.2, stagger: .04 }, at + .62)
        .to(item.querySelector('.c-promise-note'), { autoAlpha: 1, y: 0, duration: 1.1, clearProps: 'transform' }, at + .85);
      const faded = item.querySelectorAll('.c-seal-glyph .fade');
      if (faded.length) timeline.to(faded, { autoAlpha: 1, duration: .8 }, at + 1.1);
    });
    const trigger = ScrollTrigger.create({ trigger: band, start: 'top 82%', once: true, onEnter: () => timeline.play() });

    // The seal tilts towards a fine pointer and its foil catches the light
    // there; leaving, it settles back to rest.
    const leave = [];
    if (finePointer) items.forEach((item, k) => {
      const die = dies[k], seal = item.querySelector('.c-seal');
      const tiltX = gsap.quickTo(die, 'rotationX', { duration: .7, ease: 'power3.out' }), tiltY = gsap.quickTo(die, 'rotationY', { duration: .7, ease: 'power3.out' });
      const move = event => {
        if (timeline.isActive()) return;
        const box = seal.getBoundingClientRect(), u = (event.clientX - box.left) / box.width - .5, v = (event.clientY - box.top) / box.height - .5;
        tiltY(gsap.utils.clamp(-.9, .9, u) * 26); tiltX(gsap.utils.clamp(-.9, .9, v) * -26);
        gsap.to(light[k], { at: gsap.utils.clamp(-80, 80, (u + v * .4) * 150), duration: .6, ease: 'power3.out', overwrite: true, onUpdate: () => shine(k) });
      };
      const rest = () => { tiltX(0); tiltY(0); gsap.to(light[k], { at: 0, duration: 1, ease: 'power3.out', overwrite: true, onUpdate: () => shine(k) }); };
      item.addEventListener('pointermove', move); item.addEventListener('pointerleave', rest);
      leave.push(() => { item.removeEventListener('pointermove', move); item.removeEventListener('pointerleave', rest); });
    });
    return () => { trigger.kill(); timeline.kill(); leave.forEach(off => off()); };
  });
}
