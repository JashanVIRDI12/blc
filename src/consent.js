// The cookie choice. The first time someone visits, an ivory card rises in
// the bottom-left corner (the WhatsApp button holds the right) and asks
// whether analytics may be used; essential cookies and storage are always on.
// The answer is kept in the baba_consent cookie for six months, and anything
// marked [data-cookie-settings] (the footer, the privacy policy) opens the
// card again with the choices shown. Analytics (Google Analytics 4, in
// Consent Mode) loads only when config.js has its ID and the visitor allows
// it; withdrawn, its cookies are removed.
import gsap from 'gsap';
import { analytics } from './config.js';

const COOKIE = 'baba_consent', SIX_MONTHS = 60 * 60 * 24 * 182;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const readConsent = () => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match ? { analytics: /analytics:1/.test(decodeURIComponent(match[1])) } : null;
};
const writeConsent = choice => {
  document.cookie = `${COOKIE}=${encodeURIComponent(`v1|analytics:${choice.analytics ? 1 : 0}`)}; Max-Age=${SIX_MONTHS}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
};

// Analytics, loaded once and only with consent. Withdrawn, Consent Mode is
// told and Google's cookies are removed from this site.
let loaded = false;
function apply(choice) {
  const granted = Boolean(choice?.analytics && analytics.ga4);
  if (loaded) window.gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
  if (!granted) {
    document.cookie.split('; ').map(pair => pair.split('=')[0]).filter(name => /^_ga/.test(name)).forEach(name => {
      [location.hostname, `.${location.hostname.replace(/^www\./, '')}`].forEach(domain => { document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`; });
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
    return;
  }
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', analytics.ga4);
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analytics.ga4)}`;
  document.head.append(tag);
}

let built;
export function setupConsent() {
  if (built) return built;
  const card = document.createElement('section');
  card.className = 'consent';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'consent-title');
  card.setAttribute('aria-describedby', 'consent-text');
  card.innerHTML = `<p class="consent-title" id="consent-title">Cookies, <em>kept to a minimum.</em></p>
    <p class="consent-text" id="consent-text">We use only the cookies this site needs to work, and count visits without any. With your permission, we’d also use analytics cookies to learn how the site is used. <a href="/privacy/#cookies">How we use cookies</a></p>
    <div class="consent-choices" data-consent-choices hidden>
      <div class="consent-option"><span><b>Essential</b><small>Your cookie choice and your shortlist. Always on.</small></span><span class="consent-always">On</span></div>
      <label class="consent-option"><span><b>Analytics</b><small>Google Analytics: how the site is used, without identifying you.</small></span><input type="checkbox" name="analytics" role="switch"><i class="consent-switch" aria-hidden="true"></i></label>
    </div>
    <div class="consent-actions">
      <button type="button" class="consent-button consent-button--gold" data-consent="all">Accept all</button>
      <button type="button" class="consent-button" data-consent="essential">Only essential</button>
      <button type="button" class="consent-link" data-consent="choose" aria-expanded="false">Choose</button>
    </div>`;
  document.body.append(card);
  const choices = card.querySelector('[data-consent-choices]'), toggle = card.querySelector('[name=analytics]'), choose = card.querySelector('[data-consent=choose]');

  const show = ({ detailed = false } = {}) => {
    const saved = readConsent();
    toggle.checked = Boolean(saved?.analytics);
    choices.hidden = !detailed;
    choose.setAttribute('aria-expanded', String(detailed));
    choose.textContent = detailed ? 'Save my choice' : 'Choose';
    if (!card.hidden) return;
    card.hidden = false;
    document.body.classList.add('is-asking-consent');
    if (!reduced) gsap.fromTo(card, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', clearProps: 'transform' });
  };
  const hide = () => {
    document.body.classList.remove('is-asking-consent');
    if (reduced) { card.hidden = true; return; }
    gsap.to(card, { autoAlpha: 0, y: 24, duration: .45, ease: 'power3.in', onComplete: () => { card.hidden = true; gsap.set(card, { clearProps: 'all' }); } });
  };
  const decide = choice => { writeConsent(choice); apply(choice); hide(); };

  card.addEventListener('click', event => {
    const button = event.target.closest('[data-consent]');
    if (!button) return;
    const kind = button.dataset.consent;
    if (kind === 'all') decide({ analytics: true });
    else if (kind === 'essential') decide({ analytics: false });
    else if (choices.hidden) { show({ detailed: true }); toggle.focus(); }
    else decide({ analytics: toggle.checked });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-cookie-settings]')) return;
    event.preventDefault();
    show({ detailed: true });
  });

  const saved = readConsent();
  apply(saved);
  if (!saved) setTimeout(() => show(), reduced ? 0 : 1400);
  built = { show, readConsent };
  return built;
}
