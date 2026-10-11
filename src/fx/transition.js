// Between pages, a black lacquer panel wipes up over the page, its rising
// edge coachlined in gold, and the logo comes up on it; the next page opens
// as the panel wipes on upward and away. The panel is a clip, so the logo
// inside never moves: it only fades, held at the size and place of the
// home loader's logo, so arriving home hands over to the loader without a
// seam. The panel is in the header partial, laid out inline, with a line of
// script that keeps it closed from the first paint when the visitor arrived
// through it (sessionStorage), so the new page never flashes before it
// lifts.
//
// Only links to another page of this site; never new tabs, downloads,
// modified clicks, or links within the page (they glide, main.js). Reduced
// motion goes straight to the page. Back/forward from the cache resets it.
import gsap from 'gsap';

const KEY = 'baba:curtain';

export function setupTransitions() {
  const curtain = document.querySelector('.page-curtain');
  if (!curtain) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = curtain.querySelector('img'), rising = curtain.querySelector('i'), lifting = curtain.querySelector('b');
  const arrived = document.documentElement.classList.contains('curtain-in');
  try { sessionStorage.removeItem(KEY); } catch {}

  const hide = () => {
    gsap.killTweensOf([curtain, logo, rising, lifting]);
    gsap.set(curtain, { display: 'none', '--top': '0%', '--bottom': '0%' });
    gsap.set([logo, rising, lifting], { clearProps: 'all' });
    document.documentElement.classList.remove('curtain-in');
  };
  if (arrived) {
    // Home: the loader, already showing the same logo in the same place,
    // takes over. Elsewhere the panel lifts once the page has painted.
    if (reduced || document.querySelector('#loader')) hide();
    else requestAnimationFrame(() => requestAnimationFrame(() => {
      gsap.timeline({ delay: .1, onComplete: hide })
        .to(logo, { opacity: 0, scale: 1.035, duration: .55, ease: 'power2.inOut' }, 0)
        .set(lifting, { opacity: 1 }, .25)
        .fromTo(curtain, { '--bottom': '0%' }, { '--bottom': '100%', duration: 1.05, ease: 'power3.inOut' }, .25);
    }));
  }
  let leaving = false;
  addEventListener('pageshow', event => { if (event.persisted) { leaving = false; hide(); } });
  if (reduced) return;

  document.addEventListener('click', event => {
    if (leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || link.dataset.enquire !== undefined) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault();
    leaving = true;
    try { sessionStorage.setItem(KEY, '1'); } catch {}
    gsap.set(curtain, { display: 'block', '--top': '100%', '--bottom': '0%' });
    gsap.set(logo, { opacity: 0, scale: .97 });
    gsap.set(rising, { opacity: 1 });
    gsap.timeline({ onComplete: () => location.assign(url.href) })
      .to(curtain, { '--top': '0%', duration: .85, ease: 'power3.inOut' }, 0)
      .to(rising, { opacity: 0, duration: .2 }, .7)
      .to(logo, { opacity: 1, scale: 1, duration: .55, ease: 'power2.out' }, .5)
      // A beat with the logo set, so the hand-over to the next page is calm.
      .to({}, { duration: .12 });
    // If the next page is slow to answer, the panel simply waits, closed.
  });
}
