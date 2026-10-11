// The one-to-one consultation band (partials/consultation.html), on the home
// page. "1:1" is the call itself: one of you, one of us, cast in gold in the
// dark studio (consult-stage.js).
//
// Large screens pin the band and the scroll plays it: the title is already
// set as the band arrives; the two figures turn to the visitor and come
// together, the colon rises and rings and then glows, and beside them the
// words follow, line by line, to the button that books the call. Scrolling
// back plays it in reverse. Phones and short screens: no pin; the sculpture
// stands above the words and plays as it crosses the screen, and the words
// rise once. Reduced motion or no WebGL: "1:1" set in gold type, the words
// set. The call itself is booked in a dialog (forms.js).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
gsap.registerPlugin(ScrollTrigger);

const STAGED = '(min-width: 1001px) and (min-height: 700px)';

export function createConsultation(section, { reduced = false } = {}) {
  if (!section) return { scrollTo() {} };
  const $ = selector => section.querySelector(selector), $$ = selector => [...section.querySelectorAll(selector)];
  const eyebrow = $('.consult-eyebrow'), lines = $$('.consult-line > span'), lede = $('.consult-lede');
  const list = $('.consult-points'), dots = $$('.consult-points li > i'), items = $$('.consult-points b, .consult-points span');
  const actions = $('.consult-actions'), cta = $('.consult-cta'), note = $('.consult-note');
  let pin = null;
  const scrollTo = (instant = false) => {
    const y = pin ? pin.end - 2 : section.getBoundingClientRect().top + scrollY;
    const smoother = ScrollSmoother.get();
    if (smoother) smoother.scrollTo(y, !instant);
    else window.scrollTo({ top: y, behavior: instant ? 'instant' : 'smooth' });
  };
  if (reduced) { section.classList.add('is-still'); return { scrollTo }; }

  const staged = matchMedia(STAGED).matches;
  section.classList.add(staged ? 'is-staged' : 'is-flowing');
  // The sculpture loads with three.js, in the background; until then (or
  // without WebGL) the band keeps its type.
  let stage = null;
  const sculpt = { p: 0 };
  import('./consult-stage.js').then(({ createConsultStage }) => {
    stage = createConsultStage(section, { stacked: () => !matchMedia(STAGED).matches });
    stage.update(sculpt.p);
  }).catch(error => { console.error('The one-to-one sculpture is unavailable; keeping the type.', error); section.classList.add('is-still'); });

  // The title arrives with the band, so the screen is never empty.
  gsap.set(lines, { yPercent: 112 });
  gsap.set([eyebrow, lede, actions, note, ...items], { autoAlpha: 0 });
  gsap.set(list, { '--line': 0 });
  gsap.set(dots, { scale: 0, autoAlpha: 0 });
  const title = ScrollTrigger.create({
    trigger: section, start: 'top 72%', once: true,
    onEnter: () => gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(eyebrow, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 0)
      .to(lines, { yPercent: 0, duration: 1.6, stagger: .12 }, .1),
  });
  // The rest of the words, at `at`, spread over `span` of a timeline.
  const words = (tl, at, span) => tl
    .fromTo(lede, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: span * .3, ease: 'power3.out' }, at)
    .fromTo(list, { '--line': 0 }, { '--line': 1, duration: span * .45, ease: 'expo.inOut' }, at + span * .12)
    .fromTo(dots, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: span * .2, stagger: span * .1, ease: 'back.out(3)' }, at + span * .2)
    .fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: span * .3, stagger: span * .04, ease: 'power3.out' }, at + span * .25)
    .fromTo(actions, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: span * .3, ease: 'power3.out' }, at + span * .55)
    .fromTo(cta, { '--sheen': '-60%' }, { '--sheen': '160%', duration: span * .4, ease: 'power2.inOut' }, at + span * .66)
    .fromTo(note, { autoAlpha: 0 }, { autoAlpha: 1, duration: span * .25 }, at + span * .7);

  let play;
  if (staged) {
    play = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * 1.7)}`, pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 0 },
    }).to(sculpt, { p: 1, duration: 1, onUpdate: () => stage?.update(sculpt.p) }, 0);
    words(play, .26, .6);
    pin = play.scrollTrigger;
  } else {
    const figure = $('[data-consult-stage]');
    play = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: figure, start: 'top 85%', end: 'bottom 30%', scrub: .8, invalidateOnRefresh: true, refreshPriority: 0 } })
      .to(sculpt, { p: 1, duration: 1, onUpdate: () => stage?.update(sculpt.p) }, 0);
    const copy = $('.consult-copy');
    ScrollTrigger.create({ trigger: copy, start: 'top 82%', once: true, onEnter: () => words(gsap.timeline(), 0, 2.4) });
  }
  if (import.meta.env.DEV) window.__consultBand = { progress: () => sculpt.p, pinned: () => pin?.isActive };
  return { scrollTo, dispose() { title.kill(); play?.scrollTrigger?.kill(); play?.kill(); } };
}
