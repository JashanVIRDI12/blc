// The motion every public page shares: magnetic actions, the lacquer panel
// between pages, the headline reveals, the keys hanging in the footer
// (loaded only as the footer nears) and whether the showroom is open now. Its stylesheet (fx.css) is linked from
// each page's head.
import { setupMagnetic } from './cursor.js';
import { setupTransitions } from './transition.js';
import { setupReveals } from './reveal.js';
import { setupFooter } from './footer.js';

export function setupFx() {
  setupTransitions();
  // The loupe pointer (setupCursor in cursor.js) is off for now: the
  // browser's own cursor shows. The buttons stay magnetic.
  setupMagnetic();
  setupReveals();
  setupKeys();
  setupFooter();
}

function setupKeys() {
  const holder = document.querySelector('[data-keys]');
  if (!holder) return;
  const footer = holder.closest('.site-footer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const near = new IntersectionObserver(async entries => {
    if (!entries.at(-1).isIntersecting) return;
    near.disconnect();
    try {
      const { createKeyLanyard } = await import('../key-lanyard.js');
      if (!createKeyLanyard(holder, { reduced })) holder.hidden = true;
    } catch (error) {
      console.error('The keys are unavailable.', error);
      holder.hidden = true;
    }
  }, { rootMargin: '0px 0px 700px 0px' });
  near.observe(holder);
  // A press of the key's lock button: the coachline blinks twice, as a
  // car's indicators do when it locks.
  holder.addEventListener('keys:press', () => {
    footer.classList.remove('is-locking');
    void footer.offsetWidth;
    footer.classList.add('is-locking');
  });
  footer.addEventListener('animationend', event => { if (event.animationName === 'keys-blink') footer.classList.remove('is-locking'); });
}
