// The WhatsApp button in the corner of every public page: a lacquered disc
// with a gold rim. Pressed, a black card unfolds from it, gilt-edged like the
// consultation's calling card, with the dealership's lines (buying, selling,
// customer support), each opening a chat with its own first message. The
// lines are the admin's (Settings, WhatsApp lines) or, until saved there,
// whatsappLines in config.js. Anything marked [data-wa-open] opens it too.
import gsap from 'gsap';
import { whatsappLines } from './config.js';
import { loadSite } from './data.js';
import { icons } from './icons.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// A chat with the line, its first message already typed. Indian numbers
// written without the country code get it.
export const chatLink = ({ number, message }) => {
  const digits = String(number || '').replace(/\D/g, ''), full = digits.length === 10 ? `91${digits}` : digits;
  return full.length >= 10 ? `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ''}` : '';
};
// The showroom's hours, 11 am to 8 pm, in Indian time.
const openNow = () => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  return hour >= 11 && hour < 20;
};
const CLOSED = 'circle(0% at 100% 100%)', SHOWN = 'circle(150% at 100% 100%)';

let built;
export function setupWhatsApp() {
  if (built) return built;
  const root = document.createElement('div');
  root.className = 'wa';
  root.hidden = true;
  root.innerHTML = `<div class="wa-card" id="wa-card" role="dialog" aria-labelledby="wa-title" data-lenis-prevent hidden>
      <div class="wa-sheet">
        <div class="wa-head"><p class="wa-title" id="wa-title">Talk to us <em>on WhatsApp.</em></p><p class="wa-status"><i></i><span></span></p></div>
        <ul class="wa-lines" data-wa-lines></ul>
      </div>
    </div>
    <button class="wa-button" type="button" aria-expanded="false" aria-controls="wa-card" aria-label="Talk to us on WhatsApp"><span class="wa-glyph">${icons.whatsapp}</span><span class="wa-cross" aria-hidden="true"></span><span class="wa-tip" aria-hidden="true">WhatsApp us</span></button>`;
  document.body.append(root);
  const card = root.querySelector('.wa-card'), sheet = root.querySelector('.wa-sheet'), head = root.querySelector('.wa-head');
  const list = root.querySelector('[data-wa-lines]'), button = root.querySelector('.wa-button'), status = root.querySelector('.wa-status');
  let open = false, motion;

  const draw = lines => {
    const usable = (Array.isArray(lines) ? lines : []).filter(line => line?.label && chatLink(line));
    list.innerHTML = usable.map(line => `<li><a class="wa-line" href="${esc(chatLink(line))}" target="_blank" rel="noopener"><span class="wa-line-text"><b>${esc(line.label)}</b><small>${esc(line.number)}</small></span><i aria-hidden="true"></i></a></li>`).join('');
    return usable.length;
  };

  function set(next, { focus = false } = {}) {
    if (next === open) return;
    open = next;
    root.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close the WhatsApp lines' : 'Talk to us on WhatsApp');
    motion?.kill();
    if (open) {
      const hours = openNow();
      status.classList.toggle('is-open', hours);
      status.lastElementChild.textContent = hours ? 'Open now, till 8 pm IST.' : 'We reply from 11 am IST.';
      card.hidden = false;
      // The card unfolds from the button, its lines following it up.
      if (!reduced) motion = gsap.timeline()
        .fromTo(sheet, { clipPath: CLOSED }, { clipPath: SHOWN, duration: .85, ease: 'expo.out', clearProps: 'clipPath' }, 0)
        .fromTo(card, { y: 18, '--lift': 0 }, { y: 0, '--lift': 1, duration: .85, ease: 'expo.out' }, 0)
        .fromTo([head, ...list.children], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .7, stagger: .06, ease: 'expo.out', clearProps: 'transform' }, .12);
      if (focus) list.querySelector('a')?.focus();
    } else {
      const done = () => { card.hidden = true; };
      if (reduced) done();
      else motion = gsap.timeline({ onComplete: done })
        .fromTo(sheet, { clipPath: SHOWN }, { clipPath: CLOSED, duration: .45, ease: 'power3.in' }, 0)
        .to(card, { y: 10, '--lift': 0, duration: .45, ease: 'power3.in' }, 0);
      if (focus) button.focus();
    }
  }

  // A keyboard press (no pointer) carries the focus into the card and back.
  button.addEventListener('click', event => set(!open, { focus: event.detail === 0 }));
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-wa-open]');
    if (opener && !root.hidden) { event.preventDefault(); set(true, { focus: event.detail === 0 }); return; }
    if (open && !root.contains(event.target)) set(false);
  });
  addEventListener('keydown', event => { if (event.key === 'Escape' && open) set(false, { focus: root.contains(document.activeElement) }); });
  // A chat opens in its own tab; the card folds away behind it.
  list.addEventListener('click', event => { if (event.target.closest('a')) setTimeout(() => set(false), 400); });

  // Shown once the admin's lines are known, rising into its corner; the rim
  // sends out two rings of light, once.
  loadSite().then(site => {
    if (!draw(site.settings.whatsapp?.lines ?? whatsappLines)) return;
    root.hidden = false;
    if (reduced) return;
    gsap.fromTo(button, { autoAlpha: 0, scale: .4, y: 28 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1.2, ease: 'back.out(1.8)', delay: .5, clearProps: 'transform', onComplete: () => root.classList.add('is-calling') });
  });

  built = { open: () => set(true), close: () => set(false), isOpen: () => open };
  if (import.meta.env.DEV) window.__wa = built;
  return built;
}
