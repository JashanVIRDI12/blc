// Smooth scrolling for the inner pages that keep the browser's own scroll
// (the consultation and the seller's page): Lenis eases the wheel, but the
// page still scrolls natively, so `position: sticky`, fixed objects and
// ScrollTrigger all work as written (ScrollSmoother, on the home and About
// pages, moves the content instead). Fine pointers only, never with reduced
// motion; it holds still while a dialog or the menu is open.
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let lenis = null;

export function setupSmooth() {
  if (lenis) return lenis;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  lenis = new Lenis({ duration: 1.15, easing: t => 1 - (1 - t) ** 4, prevent: node => Boolean(node.closest?.('dialog, .mobile-menu')) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  const hold = () => (document.querySelector('dialog[open]') || document.body.classList.contains('menu-open') ? lenis.stop() : lenis.start());
  new MutationObserver(hold).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('dialog').forEach(dialog => new MutationObserver(hold).observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  return lenis;
}

// To an element (or a y), clear of the fixed header.
export function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  const header = document.querySelector('.site-header')?.offsetHeight || 0;
  const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY - header - offset;
  if (lenis && !immediate) lenis.scrollTo(Math.max(0, y), { duration: 1.6 });
  else scrollTo({ top: Math.max(0, y), behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
