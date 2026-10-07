// The admin portal (/admin/): sign in, then Overview, Cars, Enquiries,
// Deliveries, Home page, Collections and Settings. Every change saves to
// Supabase (or, before it is connected, to a preview in this browser).
import './admin.css';
import { createStore } from './store.js';
import { $, $$, esc, toast, busy, icon } from './ui.js';
import { renderCars, renderEditor, siteURL } from './cars.js';
import { renderOverview } from './overview.js';
import { renderEnquiries } from './enquiries.js';
import { renderDeliveries } from './deliveries.js';
import { renderHome } from './home.js';
import { renderCollections } from './collections.js';
import { renderSettings } from './settings.js';
import { FOR_SALE } from '../data.js';

const root = $('#app');
const app = { store: null, user: null, cars: [], collections: [], settings: null, private: {}, enquiries: [], deliveries: [], guard: null, discard: null, refresh: () => {} };
const logo = '<img src="/brand/baba-luxury-car-800.webp" alt="Baba Luxury Car" width="800" height="250" />';

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

function shell() {
  const preview = app.store.mode === 'preview';
  root.innerHTML = `<div class="a-shell${preview ? ' is-preview' : ''}">
    ${preview ? `<div class="a-preview-bar" role="note"><span><b>Preview mode.</b> Supabase isn’t connected, so changes stay in this browser. <a href="${siteURL(app, '/')}" target="_blank" rel="noopener">See them on the site ${icon.out}</a></span><a href="#settings/connect">How to publish</a></div>` : ''}
    <aside class="a-nav">
      <a class="a-brand" href="#cars">${logo}<span>Admin</span></a>
      <nav aria-label="Admin"><a href="#overview" data-route="overview" data-short="Today">${icon.gauge}<span>Overview</span></a><a href="#cars" data-route="cars" data-short="Cars">${icon.car}<span>Cars</span><b data-count></b></a><a href="#enquiries" data-route="enquiries" data-short="Inbox">${icon.inbox}<span>Enquiries</span><b class="is-hot" data-new></b></a><a href="#deliveries" data-route="deliveries" data-short="Deliveries">${icon.gallery}<span>Deliveries</span></a><a href="#home" data-route="home" data-short="Home">${icon.home}<span>Home page</span></a><a href="#collections" data-route="collections" data-short="Groups">${icon.stack}<span>Collections</span></a><a href="#settings" data-route="settings" data-short="Settings">${icon.cog}<span>Settings</span></a></nav>
      <div class="a-nav-foot"><a href="${siteURL(app, '/')}" target="_blank" rel="noopener">View the site ${icon.out}</a>${preview ? '' : `<span class="a-user">${esc(app.user?.email || '')}</span><button type="button" data-sign-out>Sign out</button>`}</div>
    </aside>
    <main class="a-main" id="view" tabindex="-1"></main>
  </div>`;
  $('[data-sign-out]')?.addEventListener('click', async () => { if (app.guard?.() && !confirm('Leave without saving your changes?')) return; app.guard = null; await app.store.signOut(); });
  app.refresh = () => {
    $('[data-count]').textContent = app.cars.filter(car => FOR_SALE.includes(car.status)).length || '';
    const fresh = app.enquiries.filter(row => row.status === 'new').length;
    $('[data-new]').textContent = fresh || '';
    document.title = `${fresh ? `(${fresh}) ` : ''}Admin — Baba Luxury Cars`;
  };
  app.refresh();
}

// Hash routes: #overview, #cars, #car/new, #car/new/paste, #car/<id>,
// #enquiries, #deliveries, #home, #collections, #settings.
let current = '';
function route() {
  const hash = location.hash.slice(1) || 'overview';
  if (/access_token|type=recovery/.test(hash)) return;
  const [name, id, extra] = hash.split('/');
  const view = $('#view');
  if (!view) return;
  current = location.hash;
  app.guard = null;
  app.discard = null;
  const section = name === 'car' ? 'cars' : name;
  $$('[data-route]').forEach(link => link.toggleAttribute('aria-current', link.dataset.route === section));
  if (name === 'car') renderEditor(view, app, id, { paste: extra === 'paste' });
  else if (name === 'overview') renderOverview(view, app);
  else if (name === 'enquiries') renderEnquiries(view, app);
  else if (name === 'deliveries') renderDeliveries(view, app);
  else if (name === 'home') renderHome(view, app);
  else if (name === 'collections') renderCollections(view, app);
  else if (name === 'settings') { renderSettings(view, app); if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })); }
  else renderCars(view, app);
  view.focus({ preventScroll: true });
  if (!(name === 'settings' && id)) scrollTo(0, 0);
}
addEventListener('hashchange', () => {
  if (!$('#view')) return;
  if (app.guard?.()) {
    if (!confirm('You have unsaved changes. Leave without saving?')) { history.replaceState(null, '', current); return; }
    app.discard?.();
  }
  route();
});
addEventListener('beforeunload', event => { if (app.guard?.()) event.preventDefault(); });
// Shortcuts: "/" searches the cars, "N" starts a new one.
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable || !$('#view')) return;
  if (event.key === '/') { const search = $('[data-query]'); if (search) { event.preventDefault(); search.focus(); } else if (location.hash !== '#cars') { event.preventDefault(); location.hash = '#cars'; requestAnimationFrame(() => $('[data-query]')?.focus()); } }
  if (event.key === 'n' || event.key === 'N') { event.preventDefault(); location.hash = '#car/new'; }
});
// An open "•••" menu closes when you click elsewhere.
document.addEventListener('click', event => { $$('.a-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
