// Anonymous counts for the dealership's Insights (the admin): each page
// seen, each car looked at, and each tap to call, WhatsApp, get directions or
// shortlist, sent to api/track.js. No cookie is set and nothing that
// identifies the visitor is sent: the kind of event, the page, the car, the
// kind of device, and, on a visit's first page only, the site it came from
// (its name) or the campaign it came by (?utm_source=…). A car opened twice
// in one visit counts once. Only the live site counts: local development
// (which reads the live database) and the admin's preview do not.
const live = import.meta.env.PROD && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
const memory = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
const remember = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} };
const previewing = () => memory('baba:preview') === 1 || /[?&]preview\b/.test(location.search);

const device = () => matchMedia('(max-width: 760px)').matches ? 'mobile' : matchMedia('(pointer: coarse) and (max-width: 1280px)').matches ? 'tablet' : 'desktop';
// Where this visit came from, said once: the campaign, the referring site's
// name, or "direct".
function source() {
  if (memory('baba:landed')) return null;
  remember('baba:landed', true);
  const campaign = new URLSearchParams(location.search).get('utm_source');
  if (campaign) return campaign.toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 80) || 'campaign';
  try {
    const host = document.referrer ? new URL(document.referrer).hostname.replace(/^(www|m|l|lm)\./, '') : '';
    return host && host !== location.hostname.replace(/^www\./, '') ? host : 'direct';
  } catch { return 'direct'; }
}

export function track(kind, { car = null } = {}) {
  if (!live || previewing()) return;
  if (kind === 'car_view' && car) {
    const seen = memory('baba:seen') || [];
    if (seen.includes(car)) return;
    remember('baba:seen', [...seen, car].slice(-200));
  }
  const body = JSON.stringify({ kind, car, path: location.pathname, device: device(), source: kind === 'view' ? source() : null });
  try { if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return; } catch {}
  fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

// A car's page names its car: the view is counted, and the taps on the page
// are that car's.
let current = null;
export function trackCar(id) {
  current = id || null;
  if (current) track('car_view', { car: current });
}

// Every page: the page itself, then the taps that matter to a dealer. A link
// that only opens the WhatsApp card is not a tap to WhatsApp; a line in the
// card is.
let started = false;
export function setupTracking() {
  if (started) return;
  started = true;
  track('view');
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('data-wa-open')) return;
    const href = link.getAttribute('href');
    const kind = /^tel:/.test(href) ? 'call' : /wa\.me|whatsapp\.com/.test(href) ? 'whatsapp' : /maps\.apple\.com|google\.[a-z.]+\/maps|maps\.google/.test(href) ? 'directions' : '';
    if (kind) track(kind, { car: current });
  }, { capture: true });
}
