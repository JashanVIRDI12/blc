// Modifications, on the concierge page: whatever you'd change on a car you
// buy from us, we'll have done. A BMW X7 stands grey and unlit, as it came;
// a gold line sweeps across it with the scroll, and behind the line the car
// is lit, in its own blue: made yours. As the line reaches each part, the
// work we can do there is marked on it: window film, a wrap, wheels, paint
// protection, a body kit. On large screens the band holds while the line
// crosses; on phones it crosses as the band passes. Scrolling back undoes
// it. Reduced motion shows the car lit and marked.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export function createModifications(section, { reduced = false } = {}) {
  if (!section) return;
  const stage = section.querySelector('[data-mods-stage]');
  const tags = [...section.querySelectorAll('.k-tag')];
  const copy = section.querySelectorAll('.k-mods-line > span');
  const rest = section.querySelectorAll('.k-mods-copy > :not(h2)');
  if (reduced) { stage.style.setProperty('--scan', 1); return; }

  // The words rise once, as the band arrives.
  gsap.set(copy, { yPercent: 112 });
  gsap.set(rest, { autoAlpha: 0, y: 22 });
  ScrollTrigger.create({
    trigger: section, start: 'top 70%', once: true,
    onEnter: () => gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(copy, { yPercent: 0, duration: 1.4, stagger: .1 }, 0)
      .to(rest, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08, clearProps: 'transform' }, .25),
  });

  // The sweep. Each mark appears when the line reaches its part.
  const mm = gsap.matchMedia();
  mm.add({ pinned: '(min-width: 1001px) and (min-height: 640px)', loose: '(max-width: 1000px), (max-height: 639px)' }, ({ conditions }) => {
    const sweep = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: conditions.pinned
        ? { trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * 1.1)}`, pin: true, scrub: .8, anticipatePin: 1 }
        : { trigger: stage, start: 'top 80%', end: 'bottom 45%', scrub: .8 },
    }).fromTo(stage, { '--scan': 0 }, { '--scan': 1, duration: 1 }, 0);
    tags.forEach(tag => {
      const at = parseFloat(tag.style.getPropertyValue('--x')) / 100;
      sweep.fromTo(tag, { '--on': 0 }, { '--on': 1, duration: .14, ease: 'power2.out' }, Math.max(0, at - .02));
    });
    // A little time at the end with the car finished, before the band moves on.
    sweep.to({}, { duration: .12 });
    return () => { sweep.scrollTrigger?.kill(); sweep.kill(); gsap.set(stage, { '--scan': 1 }); tags.forEach(tag => gsap.set(tag, { '--on': 1 })); };
  });
}
