// The site's own line icons, drawn on one 24-unit grid with a 1.4 stroke so
// they sit together: how to reach the dealership (WhatsApp, a call, email,
// the showroom and its hours) and where it posts (Instagram, YouTube). Each
// is an inline SVG string, hidden from screen readers; the link or button
// around it carries the words. CSS sets the size and colour (.icon).
const svg = paths => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

export const icons = {
  whatsapp: svg('<path d="M4.5 19.5 5.6 16A7.8 7.8 0 1 1 8.4 18.6z"/><path d="M9 9.5c.3 2.4 2.6 4.8 5.2 5.2l1-1.2-1.6-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-1.6z"/>'),
  phone: svg('<path d="M6.5 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.2 6.2l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.6 18.5 5.5 13.4 5 5.1a1.5 1.5 0 0 1 1.5-1.6z"/>'),
  mail: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>'),
  pin: svg('<path d="M12 20.5s-6.5-5.9-6.5-10.8a6.5 6.5 0 0 1 13 0c0 4.9-6.5 10.8-6.5 10.8z"/><circle cx="12" cy="9.8" r="2.3"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>'),
  instagram: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="icon-dot" cx="17.1" cy="6.9" r=".9"/>'),
  youtube: svg('<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path class="icon-fill" d="M10.2 9.3v5.4l4.6-2.7z"/>'),
};
