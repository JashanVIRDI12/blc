// iPhone and iPad Safari scroll on a thread of their own and paint the page
// already moved before a pinned section has been set in place, so pinned
// stages jump and shake as they start and end, and the address bar coming and
// going shifts them (GSAP's notes on ScrollTrigger.normalizeScroll). On those
// devices a page with pinned stages hands its scrolling to ScrollTrigger,
// which keeps it on the page's own thread, in step with the pins; areas that
// scroll on their own (galleries, dialogs, the menu) keep their own scrolling.
// Everywhere else scrolling stays the browser's.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function steadyPins() {
  if (appleTouch) ScrollTrigger.normalizeScroll({ allowNestedScroll: true });
}
