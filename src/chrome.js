// The parts every public page shares: the menu, the header and its
// coachline, and the footer's year. The home page drives its header from the
// film (main.js); the other pages use setupPage().
import { setupForms } from './forms.js';
import { loadSite } from './data.js';
import { dealer, social } from './config.js';
import { setupFx } from './fx/index.js';
import { setupWhatsApp } from './whatsapp.js';
import { icons } from './icons.js';

export function setupMenu(wrapper) {
  const menu = document.querySelector('#mobile-menu');
  const button = document.querySelector('.menu-toggle');
  // The menu's foot: how to reach the dealership, read when it opens, so it
  // follows the contact details saved in the admin.
  const contact = () => {
    const foot = menu.querySelector('[data-menu-contact]');
    if (!foot) return;
    const digits = dealer.whatsapp.replace(/\D/g, ''), tel = dealer.phone.replace(/[^+\d]/g, '');
    const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    foot.innerHTML = `<p class="mm-label">Talk to us</p>
      <div class="mm-actions">${digits ? `<a class="mm-action mm-action--gold" href="https://wa.me/${digits}" target="_blank" rel="noopener" data-wa-open>${icons.whatsapp}WhatsApp</a>` : ''}${tel ? `<a class="mm-action" href="tel:${tel}">${icons.phone}Call ${esc(dealer.phone)}</a>` : ''}</div>
      ${dealer.address || dealer.hours ? `<p class="mm-visit">${dealer.address ? `<span>${icons.pin}${esc(dealer.address)}</span>` : ''}${dealer.hours ? `<span>${icons.clock}${esc(dealer.hours)}</span>` : ''}</p>` : ''}
      <p class="mm-social">${social.map(({ name, icon, url }) => `<a href="${url}" target="_blank" rel="noopener" aria-label="Baba Luxury Car on ${name}">${icons[icon]}</a>`).join('')}</p>`;
  };
  const set = open => {
    if (open) contact();
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.classList.toggle('menu-open', open);
    if (wrapper) wrapper.inert = open;
  };
  button.addEventListener('click', () => set(menu.hidden));
  addEventListener('keydown', event => { if (event.key === 'Escape') set(false); });
  menu.addEventListener('click', event => { if (event.target.closest('a')) set(false); });
  return () => set(false);
}

// Marks the current page in the navigation.
export function markNav(page) {
  document.querySelectorAll(`[data-nav="${page}"]`).forEach(link => link.setAttribute('aria-current', 'page'));
}

// The admin's browser-only preview is always labelled as such.
export function previewBanner(site) {
  if (site.source !== 'preview' || document.querySelector('.preview-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'preview-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span><b>Admin preview.</b> Only this browser sees these changes; connect Supabase to publish them.</span><a href="?end-preview">Leave preview</a>';
  document.body.append(banner);
}

// Inner pages: the header is glass from the start, its coachline filling as
// the page is read.
export function setupPage(page) {
  const header = document.querySelector('.site-header');
  header.classList.add('is-practical');
  // Light pages keep the header in white glass.
  header.classList.toggle('is-light', document.body.classList.contains('theme-light'));
  const progress = () => {
    const range = document.documentElement.scrollHeight - innerHeight;
    header.style.setProperty('--progress', range > 0 ? Math.min(1, scrollY / range).toFixed(4) : '0');
  };
  addEventListener('scroll', progress, { passive: true });
  addEventListener('resize', progress);
  new ResizeObserver(progress).observe(document.body);
  setupMenu(document.querySelector('main'));
  markNav(page);
  document.querySelector('#year').textContent = new Date().getFullYear();
  document.querySelector('[data-top]')?.addEventListener('click', event => { event.preventDefault(); scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  loadSite().then(previewBanner);
  setupFx();
  setupWhatsApp();
  return setupForms();
}

// Pages that turn to paper for a while (the seller's form, the ways to talk)
// turn the header to paper over them, so a dark glass bar never sits on
// ivory.
export function paperHeader(selector) {
  const header = document.querySelector('.site-header');
  const sections = [...document.querySelectorAll(selector)];
  if (!sections.length) return;
  const update = () => {
    const line = header.offsetHeight / 2;
    header.classList.toggle('is-light', sections.some(section => { const box = section.getBoundingClientRect(); return box.top <= line && box.bottom > line; }));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
