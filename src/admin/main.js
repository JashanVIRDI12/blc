// The admin portal (/admin/): sign in, then Overview, Cars, Enquiries,
// Insights, Deliveries, Home page, Collections and Settings. Every change saves to
// Supabase (or, before it is connected, to a preview in this browser).
import { createStore } from './store.js';
import { $, $$, esc, toast, busy, icon, confirmDialog } from './ui.js';
import { installPickers } from './pickers.js';
import { renderCars, renderEditor, siteURL } from './cars.js';
import { renderOverview } from './overview.js';
import { renderEnquiries } from './enquiries.js';
import { renderInsights } from './insights.js';
import { renderDeliveries } from './deliveries.js';
import { renderHome } from './home.js';
import { renderCollections } from './collections.js';
import { renderSettings } from './settings.js';
import { FOR_SALE } from '../data.js';

const root = $('#app');
const app = { store: null, user: null, cars: [], collections: [], settings: null, private: {}, enquiries: [], deliveries: [], guard: null, discard: null, refresh: () => {} };
const logo = '<img src="/brand/baba-luxury-car-800.webp" alt="Baba Luxury Car" width="800" height="250" />';

installPickers();
boot();

async function boot() {
  root.innerHTML = `<div class="a-auth"><div class="a-loading"><i class="a-spinner"></i>Opening the admin…</div></div>`;
  try {
    app.store = await createStore();
    if (app.store.mode === 'supabase') {
      app.store.onAuth(event => {
        if (event === 'PASSWORD_RECOVERY') newPasswordScreen();
        if (event === 'SIGNED_OUT') signInScreen();
      });
      if (/type=recovery/.test(location.hash)) return;
      const session = await app.store.session();
      if (!session) return signInScreen();
      return enter(session);
    }
    enter(await app.store.session());
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="a-auth"><div class="a-card a-auth-card">${logo}<h1>Can’t reach the database.</h1><p class="a-hint">${esc(error.message)}</p><button class="a-button a-button--primary" type="button" onclick="location.reload()">Try again</button></div></div>`;
  }
}

function signInScreen(message = '') {
  root.innerHTML = `<div class="a-auth"><form class="a-card a-auth-card" data-sign-in>${logo}<h1>Admin</h1><p class="a-hint">Sign in to manage the collection.</p>
    <label class="a-field">Email<input name="email" type="email" autocomplete="username" required /></label>
    <label class="a-field">Password<input name="password" type="password" autocomplete="current-password" required /></label>
    <p class="a-error" role="alert" data-error>${esc(message)}</p>
    <button class="a-button a-button--primary a-button--wide" type="submit">Sign in</button>
    <button class="a-link" type="button" data-forgot>Forgot your password?</button></form></div>`;
  const form = $('[data-sign-in]');
  const error = $('[data-error]');
  form.elements.email.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.textContent = '';
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        await app.store.signIn(form.elements.email.value.trim(), form.elements.password.value);
        await enter(await app.store.session());
      } catch (problem) { error.textContent = /invalid/i.test(problem.message) ? 'That email and password don’t match.' : /fetch|network/i.test(problem.message) ? 'Can’t reach the database. Check the internet connection, or the Supabase address in the site’s settings.' : problem.message; }
    });
  });
  $('[data-forgot]').addEventListener('click', async () => {
    const email = form.elements.email.value.trim();
    if (!email) { error.textContent = 'Type your email above first, then press this again.'; form.elements.email.focus(); return; }
    try { await app.store.resetPassword(email); error.textContent = ''; toast(`If ${email} is an account, a reset link is on its way.`); }
    catch (problem) { error.textContent = problem.message; }
  });
}

function newPasswordScreen() {
  root.innerHTML = `<div class="a-auth"><form class="a-card a-auth-card" data-new-password>${logo}<h1>Choose a new password</h1>
    <label class="a-field">New password<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label>
    <p class="a-error" role="alert" data-error></p><button class="a-button a-button--primary a-button--wide" type="submit">Save and sign in</button></form></div>`;
  const form = $('[data-new-password]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    await busy(form.querySelector('button'), async () => {
      try { await app.store.updatePassword(form.elements.password.value); history.replaceState(null, '', '/admin/#cars'); await enter(await app.store.session()); }
      catch (problem) { $('[data-error]').textContent = problem.message; }
    });
  });
}

async function enter(session) {
  app.user = session?.user;
  if (!(await app.store.isAdmin())) {
    root.innerHTML = `<div class="a-auth"><div class="a-card a-auth-card">${logo}<h1>Not an admin yet.</h1><p class="a-hint">You are signed in as <b>${esc(app.user?.email)}</b>, but this account can’t edit the site. The owner can allow it by running this in Supabase’s SQL editor:</p><pre class="a-code">insert into public.admins (user_id, email)\nvalues ('${esc(app.user?.id)}', '${esc(app.user?.email)}');</pre><button class="a-button a-button--wide" type="button" data-out>Sign out</button></div></div>`;
    $('[data-out]').addEventListener('click', () => app.store.signOut());
    return;
  }
  // Private details, enquiries and deliveries are optional extras: the
  // portal still opens if one of them can't be read.
  const optional = (task, fallback) => task.catch(error => { console.warn(error); return fallback; });
  [app.cars, app.collections, app.settings, app.private, app.enquiries, app.deliveries] = await Promise.all([app.store.listCars(), app.store.listCollections(), app.store.getSettings(), optional(app.store.listPrivate(), {}), optional(app.store.listEnquiries(), []), optional(app.store.listDeliveries(), [])]);
  shell();
  if (!location.hash || location.hash.length < 2 || /access_token/.test(location.hash)) history.replaceState(null, '', '#overview');
  route();
  // New enquiries arrive while the portal is open: check every minute.
  setInterval(async () => {
    if (document.hidden) return;
    try {
      const fresh = await app.store.countNewEnquiries();
      if (fresh > app.enquiries.filter(row => row.status === 'new').length) {
        app.enquiries = await app.store.listEnquiries();
        app.refresh();
        toast(`New enquiry from ${app.enquiries[0]?.name || 'the site'}`, { action: 'Open', onAction: () => { location.hash = '#enquiries'; } });
        if (location.hash === '#enquiries' || location.hash === '#overview') route();
      }
    } catch {}
  }, 60000);
}

// The sections, in the menu's order: route, name, the tab bar's short name,
// its icon, whether phones keep it under "More", and its count.
const sections = [
  ['overview', 'Overview', 'Today', icon.gauge],
  ['cars', 'Cars', 'Cars', icon.car, false, '<b data-count></b>'],
  ['enquiries', 'Enquiries', 'Inbox', icon.inbox, false, '<b class="is-hot" data-new></b>'],
  ['insights', 'Insights', 'Insights', icon.chart, true],
  ['deliveries', 'Deliveries', 'Deliveries', icon.gallery],
  ['home', 'Home page', 'Home', icon.home, true],
  ['collections', 'Collections', 'Groups', icon.stack, true],
  ['settings', 'Settings', 'Settings', icon.cog, true],
];
const inMore = new Set(sections.filter(section => section[4]).map(([route]) => route));

function shell() {
  const preview = app.store.mode === 'preview';
  const account = preview ? '' : `<span class="a-user">${esc(app.user?.email || '')}</span><button type="button" data-sign-out>Sign out</button>`;
  root.innerHTML = `<div class="a-shell${preview ? ' is-preview' : ''}">
    ${preview ? `<div class="a-preview-bar" role="note"><span><b>Preview mode.</b> Supabase isn’t connected, so changes stay in this browser. <a href="${siteURL(app, '/')}" target="_blank" rel="noopener">See them on the site ${icon.out}</a></span><a href="#settings/connect">How to publish</a></div>` : ''}
    <aside class="a-nav">
      <a class="a-brand" href="#cars">${logo}<span>Admin</span></a>
      <nav aria-label="Admin">${sections.map(([route, name, short, glyph, more, count = '']) => `<a href="#${route}" data-route="${route}" data-short="${short}"${more ? ' data-more' : ''}>${glyph}<span>${name}</span>${count}</a>`).join('')}<button type="button" class="a-more-tab" data-more-open data-short="More" aria-haspopup="dialog" aria-expanded="false">${icon.more}<span>More</span></button></nav>
      <div class="a-nav-foot"><a href="${siteURL(app, '/')}" target="_blank" rel="noopener">View the site ${icon.out}</a>${account}</div>
    </aside>
    <main class="a-main" id="view" tabindex="-1"></main>
    <dialog class="a-sheet" data-more-sheet aria-label="More"><div class="a-sheet-body"><i class="a-sheet-grip" aria-hidden="true"></i>
      <nav aria-label="More sections">${sections.filter(section => section[4]).map(([route, name, , glyph]) => `<a href="#${route}" data-route="${route}">${glyph}<span>${name}</span></a>`).join('')}</nav>
      <div class="a-sheet-foot"><a href="${siteURL(app, '/')}" target="_blank" rel="noopener">${icon.out}<span>View the site</span></a>${account}</div>
    </div></dialog>
  </div>`;
  $$('[data-sign-out]').forEach(button => button.addEventListener('click', async () => { if (!(await leave())) return; app.guard = null; await app.store.signOut(); }));
  // Phones: "More" opens the other sections in a sheet that rises from the
  // foot of the screen. It slides away when one is chosen, when the dim
  // backdrop is tapped, or on Escape.
  const sheet = $('[data-more-sheet]'), more = $('[data-more-open]');
  app.closeSheet = () => {
    if (!sheet.open || sheet.classList.contains('is-leaving')) return;
    sheet.classList.add('is-leaving');
    setTimeout(() => { sheet.close(); sheet.classList.remove('is-leaving'); }, 200);
  };
  more.addEventListener('click', () => { sheet.showModal(); more.setAttribute('aria-expanded', 'true'); });
  sheet.addEventListener('close', () => more.setAttribute('aria-expanded', 'false'));
  sheet.addEventListener('cancel', event => { event.preventDefault(); app.closeSheet(); });
  sheet.addEventListener('click', event => { if (event.target === sheet || event.target.closest('a')) app.closeSheet(); });
  app.refresh = () => {
    $('[data-count]').textContent = app.cars.filter(car => FOR_SALE.includes(car.status)).length || '';
    const fresh = app.enquiries.filter(row => row.status === 'new').length;
    $('[data-new]').textContent = fresh || '';
    document.title = `${fresh ? `(${fresh}) ` : ''}Admin — Baba Luxury Cars`;
  };
  app.refresh();
}

// Hash routes: #overview, #cars, #car/new, #car/new/paste, #car/<id>,
// #enquiries, #insights, #deliveries, #home, #collections, #settings.
let current = '';
function route() {
  const hash = location.hash.slice(1) || 'overview';
  if (/access_token|type=recovery/.test(hash)) return;
  const [name, id, extra] = hash.split('/');
  const view = $('#view');
  if (!view) return;
  current = location.hash;
  app.guard = null; app.saveEdits = null;
  app.discard = null;
  const section = name === 'car' ? 'cars' : name;
  $$('[data-route]').forEach(link => link.toggleAttribute('aria-current', link.dataset.route === section));
  $('[data-more-open]')?.toggleAttribute('aria-current', inMore.has(section));
  app.closeSheet?.();
  if (name === 'car') renderEditor(view, app, id, { paste: extra === 'paste' });
  else if (name === 'overview') renderOverview(view, app);
  else if (name === 'enquiries') renderEnquiries(view, app);
  else if (name === 'insights') renderInsights(view, app);
  else if (name === 'deliveries') renderDeliveries(view, app);
  else if (name === 'home') renderHome(view, app);
  else if (name === 'collections') renderCollections(view, app);
  else if (name === 'settings') { renderSettings(view, app); if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })); }
  else renderCars(view, app);
  view.focus({ preventScroll: true });
  if (!(name === 'settings' && id)) scrollTo(0, 0);
}
// Leaving a car with unsaved changes asks first, in the portal's own dialog:
// save and go, keep editing, or go without saving. Resolves true to go.
let asking = false;
async function leave() {
  if (!app.guard?.()) return true;
  if (asking) return false;
  asking = true;
  const answer = await confirmDialog({ tone: 'warn', title: 'Save your changes?', body: 'This car has changes that haven’t been saved yet.', confirm: 'Save and leave', cancel: 'Keep editing', extra: 'Discard changes', extraDanger: true });
  asking = false;
  if (answer === true) { await app.saveEdits?.(); return !app.guard?.(); }
  if (answer === 'extra') { app.discard?.(); app.guard = null; return true; }
  return false;
}
addEventListener('hashchange', async () => {
  if (!$('#view')) return;
  if (app.guard?.()) {
    // Stay put while the question is open; go once it is answered.
    const target = location.hash;
    history.replaceState(null, '', current);
    if (await leave()) location.hash = target;
    return;
  }
  route();
});
// Closing the tab or reloading can only be guarded by the browser's own
// question: no page may draw its own there.
addEventListener('beforeunload', event => { if (app.guard?.()) event.preventDefault(); });
// Shortcuts: "/" searches the cars, "N" starts a new one.
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable || !$('#view')) return;
  if (event.key === '/') { const search = $('[data-query]'); if (search) { event.preventDefault(); search.focus(); } else if (location.hash !== '#cars') { event.preventDefault(); location.hash = '#cars'; requestAnimationFrame(() => $('[data-query]')?.focus()); } }
  if (event.key === 'n' || event.key === 'N') { event.preventDefault(); location.hash = '#car/new'; }
});
// An open "•••" menu closes when you click elsewhere.
document.addEventListener('click', event => { $$('.a-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
