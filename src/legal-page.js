// The privacy policy, the terms and the policies (/privacy/, /terms/,
// /booking-policy/, /delivery-policy/, /test-drive-policy/,
// /rc-transfer-policy/): the shared chrome,
// the title rising out of its lines as on the other pages, and the contents
// in the margin marking the section being read.
import gsap from 'gsap';
import { setupPage } from './chrome.js';

setupPage(document.body.dataset.page);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduced) gsap.timeline({ defaults: { ease: 'expo.out' } })
  .fromTo('.lg-head .fl-line > span', { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: .1 }, .1)
  .fromTo('.lg-lede, .lg-glance, .lg-meta', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .08, clearProps: 'transform' }, .4);

// The section being read is the last whose heading has passed a line a
// third of the way down the screen.
const links = [...document.querySelectorAll('.lg-toc a')];
const sections = links.map(link => document.querySelector(link.hash)).filter(Boolean);
const mark = () => {
  const line = innerHeight / 3;
  const current = sections.filter(section => section.getBoundingClientRect().top <= line).at(-1) || sections[0];
  links.forEach(link => link.setAttribute('aria-current', String(link.hash === `#${current?.id}`)));
};
addEventListener('scroll', mark, { passive: true });
addEventListener('resize', mark);
mark();
