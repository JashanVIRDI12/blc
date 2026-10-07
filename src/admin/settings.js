// Settings: contact details, the collection page, the account, and how to
// connect Supabase while in preview mode.
import { $, $$, esc, toast, fail, busy, confirmDialog, icon } from './ui.js';
import { LISTING_DEFAULTS, shownRegistration, drivenText, plateLabel } from '../listing-rules.js';
import { conciergeGroups } from '../data.js';

const SOLD_FACTS = [['year', 'Year'], ['fuel', 'Fuel'], ['body', 'Body'], ['transmission', 'Gearbox'], ['colour', 'Colour'], ['driven', 'Driven'], ['owners', 'Ownership']];

export function renderSettings(view, app) {
  const { contact, collection } = app.settings;
  const listing = { ...LISTING_DEFAULTS, ...app.settings.listing };
  const preview = app.store.mode === 'preview';
  view.innerHTML = `<header class="a-head"><div><h1>Settings</h1><p class="a-sub">Contact details, your ad rules and how the collection page behaves. Each card saves on its own.</p></div></header>
  <form class="a-card a-rules" data-rules><div class="a-card-head"><h2>Your ad rules</h2><span class="a-hint">How every car reads, on the site and in the WhatsApp ads made here.</span></div>
    <div class="a-rules-grid">
      <fieldset class="a-fieldset"><legend>Registration</legend>
        <label class="a-check"><input type="radio" name="regShow" value="rto"${listing.regShow !== 'chars' ? ' checked' : ''} /><span>The state and RTO code only: <b>HR51</b>, <b>DL3</b></span></label>
        <label class="a-check"><input type="radio" name="regShow" value="chars"${listing.regShow === 'chars' ? ' checked' : ''} /><span>The first <input class="a-inline-number" name="regChars" type="number" min="2" max="8" value="${Number(listing.regChars) || 4}" /> characters</span></label>
        <p class="a-hint">The full number is kept privately on each car. Example: <code>HR51CM9909</code> shows as <b data-reg-example></b>.</p></fieldset>
      <fieldset class="a-fieldset"><legend>Distance</legend><label class="a-field">Label<input name="drivenLabel" maxlength="20" value="${esc(listing.drivenLabel)}" /></label><p class="a-hint">Shown as <b data-driven-example></b>. Never with “km”.</p></fieldset>
      <fieldset class="a-fieldset"><legend>Number plate tags</legend><div class="a-grid"><label class="a-field">Fancy<input name="fancyLabel" maxlength="20" value="${esc(listing.fancyLabel)}" /></label><label class="a-field">VIP<input name="vipLabel" maxlength="20" value="${esc(listing.vipLabel)}" /></label></div><p class="a-hint" data-plate-example></p></fieldset>
      <fieldset class="a-fieldset"><legend>Insurance</legend><label class="a-switch"><input type="checkbox" name="showInsurance"${listing.showInsurance !== false ? ' checked' : ''} /><span>Show it, as Valid or Expired (never the date)</span></label><p class="a-hint">A car with a date turns to Expired by itself when the date passes.</p></fieldset>
      <fieldset class="a-fieldset a-span-2"><legend>Sold cars show no price, and only</legend><div class="a-checks a-checks--tight">${SOLD_FACTS.map(([key, label]) => `<label class="a-check"><input type="checkbox" name="soldFacts" value="${key}"${(listing.soldFacts || []).includes(key) ? ' checked' : ''} /><span>${label}</span></label>`).join('')}</div></fieldset>
    </div>
    <div class="a-inline-actions"><button type="submit" class="a-button a-button--primary">Save the rules</button><button type="button" class="a-button a-button--ghost" data-reset-rules>Back to the defaults</button></div></form>
  <form class="a-card a-concierge" data-concierge><div class="a-card-head"><h2>Baba Concierge</h2><span class="a-hint">On every car’s page: buyers choose what they’d like done to the car and send it to you.</span></div>
    <div class="a-grid">
      <label class="a-field">WhatsApp number<input name="whatsapp" type="tel" maxlength="22" value="${esc(app.settings.concierge.whatsapp)}" placeholder="+91 85108 30242" /><small>Requests open a WhatsApp chat with this number. Call-back requests arrive in Enquiries.</small></label>
      <label class="a-field">Introduction<textarea name="intro" rows="3" maxlength="320">${esc(app.settings.concierge.intro)}</textarea></label>
      <label class="a-field a-span-2">Services<textarea name="services" rows="7" maxlength="3000" spellcheck="false" class="a-mono">${esc(app.settings.concierge.services)}</textarea><small>One group per line: <code>Group: item, item, item</code>. Add body types in brackets to show a group only for them: <code>Off-road [SUV, Pickup]: Lift kit, Snorkel</code>.</small></label>
    </div>
    <p class="a-hint" data-concierge-preview></p>
    <div class="a-inline-actions"><button type="submit" class="a-button a-button--primary">Save the concierge</button></div></form>
  <div class="a-two">
    <form class="a-card" data-group="contact"><h2>Contact details</h2><p class="a-hint">Shown in the footer and used by every enquiry button. Leave a field empty to hide it.</p>
      <div class="a-grid">
        <label class="a-field">Phone<input name="phone" type="tel" maxlength="22" placeholder="+91 98765 43210" value="${esc(contact.phone)}" /></label>
        <label class="a-field">WhatsApp number<input name="whatsapp" type="tel" maxlength="22" placeholder="+91 98765 43210" value="${esc(contact.whatsapp)}" /><small>With the country code. Adds “WhatsApp” buttons.</small></label>
        <label class="a-field a-span-2">Email<input name="email" type="email" maxlength="120" placeholder="hello@babaluxurycar.com" value="${esc(contact.email)}" /></label>
        <label class="a-field a-span-2">Address<input name="address" maxlength="160" placeholder="Showroom address" value="${esc(contact.address)}" /></label>
        <label class="a-field a-span-2">Opening hours<input name="hours" maxlength="80" placeholder="Mon–Sat, 10am–8pm" value="${esc(contact.hours)}" /></label>
      </div>
      <details class="a-advanced"><summary>Advanced: send enquiries to a web address</summary><label class="a-field">Enquiry endpoint<input name="enquiryEndpoint" type="url" placeholder="https://…" value="${esc(contact.enquiryEndpoint)}" /><small>Forms post their details here as JSON. Leave empty to let visitors send them by WhatsApp or email.</small></label></details>
      <button type="submit" class="a-button a-button--primary">Save contact details</button></form>
    <div class="a-stack">
      <form class="a-card" data-group="collection"><h2>Collection page</h2>
        <label class="a-field">Introduction<textarea name="intro" rows="3" maxlength="260">${esc(collection.intro)}</textarea></label>
        <label class="a-switch"><input type="checkbox" name="showSold"${listing.showSold ? ' checked' : ''} /><span>Show sold cars as “Recently delivered”</span></label>
        <button type="submit" class="a-button a-button--primary">Save</button></form>
      <section class="a-card"><h2>Account</h2>${preview ? `<p class="a-hint">Preview mode has no sign-in. Once Supabase is connected, this portal asks for an email and password.</p><button type="button" class="a-button a-button--danger" data-reset>Reset the preview</button>` : `<p class="a-hint">Signed in as <b>${esc(app.user?.email || '')}</b>.</p><form class="a-inline-form" data-password><label class="a-field">New password<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label><button type="submit" class="a-button a-button--small">Change password</button></form><p class="a-hint">To add another admin, they create an account under Supabase → Authentication → Users, then run, in the SQL editor:<br><code>insert into public.admins (user_id, email) select id, email from auth.users where email = 'their@email.com';</code></p>`}</section>
    </div>
  </div>
  ${preview ? `<section class="a-card a-connect" id="connect"><h2>Connect Supabase to publish</h2><ol>
    <li>Create a free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com ${icon.out}</a>.</li>
    <li>Open <b>SQL Editor → New query</b>, paste the schema and press <b>Run</b>. <button type="button" class="a-button a-button--small" data-copy-sql>${icon.copy}Copy the schema</button></li>
    <li>In <b>Authentication → Users → Add user</b>, add your email and a password, with <b>Auto confirm</b> ticked. Then run:<br><code>insert into public.admins (user_id, email) select id, email from auth.users where email = 'you@example.com';</code></li>
    <li>Under <b>Authentication → Sign In / Providers</b>, turn off <b>Allow new users to sign up</b>.</li>
    <li>From <b>Project Settings → API</b>, copy the Project URL and the <b>anon public</b> key into a file named <code>.env.local</code> in the project folder:<br><code>VITE_SUPABASE_URL=https://xxxx.supabase.co<br>VITE_SUPABASE_ANON_KEY=eyJ…</code><br>Add the same two values to your host’s environment variables, then rebuild.</li>
  </ol></section>` : ''}`;

  // The ad rules, with live examples.
  const rulesForm = $('[data-rules]', view);
  const readRules = () => ({ ...listing, regShow: rulesForm.querySelector('[name=regShow]:checked').value, regChars: Math.min(8, Math.max(2, Number(rulesForm.elements.regChars.value) || 4)), drivenLabel: rulesForm.elements.drivenLabel.value.trim() || 'Driven', fancyLabel: rulesForm.elements.fancyLabel.value.trim() || 'Fancy No.', vipLabel: rulesForm.elements.vipLabel.value.trim() || 'VIP No.', showInsurance: rulesForm.elements.showInsurance.checked, soldFacts: $$('[name=soldFacts]:checked', rulesForm).map(input => input.value) });
  const examples = () => {
    const next = readRules();
    $('[data-reg-example]', view).textContent = shownRegistration('HR51CM9909', next);
    $('[data-driven-example]', view).textContent = drivenText(75000, next);
    $('[data-plate-example]', view).innerHTML = `Shown as <span class="a-plate-chip" data-tone="fancy">${icon.plate}${esc(plateLabel({ plateTag: 'fancy', plateNumber: '7272' }, next))}</span> <span class="a-plate-chip" data-tone="vip">${icon.plate}${esc(plateLabel({ plateTag: 'vip', plateNumber: '0006' }, next))}</span>`;
  };
  examples();
  rulesForm.addEventListener('input', examples);
  rulesForm.addEventListener('change', examples);
  $('[data-reset-rules]', view).addEventListener('click', () => {
    const d = LISTING_DEFAULTS, el = rulesForm.elements;
    rulesForm.querySelector(`[name=regShow][value=${d.regShow}]`).checked = true;
    el.regChars.value = d.regChars; el.drivenLabel.value = d.drivenLabel; el.fancyLabel.value = d.fancyLabel; el.vipLabel.value = d.vipLabel; el.showInsurance.checked = d.showInsurance;
    $$('[name=soldFacts]', rulesForm).forEach(input => { input.checked = d.soldFacts.includes(input.value); });
    examples();
    toast('Defaults filled in. Press Save the rules to keep them.');
  });
  rulesForm.addEventListener('submit', async event => {
    event.preventDefault();
    const next = readRules();
    const changedReg = next.regShow !== listing.regShow || next.regChars !== listing.regChars;
    await busy(rulesForm.querySelector('[type=submit]'), async () => {
      try {
        await app.store.saveSettings('listing', { ...app.settings.listing, ...next });
        app.settings.listing = { ...app.settings.listing, ...next };
        // The registration shown on each car follows the new rule.
        if (changedReg) {
          const updates = app.cars.map(car => [car, app.private?.[car.id]?.registration]).filter(([car, full]) => full && shownRegistration(full, next) !== car.registration);
          const saved = await Promise.all(updates.map(([car, full]) => app.store.patchCar(car.id, { registration: shownRegistration(full, next) })));
          app.cars = app.cars.map(car => saved.find(other => other.id === car.id) || car);
          toast(`Rules saved; ${saved.length} ${saved.length === 1 ? 'registration' : 'registrations'} updated`);
        } else toast('Rules saved');
      } catch (error) { fail(error); }
    });
  });

  // The concierge, with a count of what each kind of car will show.
  const conciergeForm = $('[data-concierge]', view);
  const conciergePreview = () => {
    const text = conciergeForm.elements.services.value;
    const count = body => { const groups = conciergeGroups(text, body); return `${groups.reduce((n, group) => n + group.items.length, 0)} services in ${groups.length} groups`; };
    $('[data-concierge-preview]', view).textContent = `An SUV’s page shows ${count('SUV')}; a saloon’s, ${count('Sedan')}.`;
  };
  conciergePreview();
  conciergeForm.elements.services.addEventListener('input', conciergePreview);
  conciergeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const value = { whatsapp: conciergeForm.elements.whatsapp.value.trim(), intro: conciergeForm.elements.intro.value.trim(), services: conciergeForm.elements.services.value.split('\n').map(line => line.trim()).filter(Boolean).join('\n') };
    await busy(conciergeForm.querySelector('[type=submit]'), async () => {
      try { await app.store.saveSettings('concierge', value); app.settings.concierge = { ...app.settings.concierge, ...value }; toast('Concierge saved'); }
      catch (error) { fail(error); }
    });
  });

  view.querySelectorAll('[data-group]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    const read = name => form.elements[name]?.value.trim() ?? '';
    await busy(button, async () => {
      try {
        if (form.dataset.group === 'contact') {
          const value = { phone: read('phone'), whatsapp: read('whatsapp'), email: read('email'), address: read('address'), hours: read('hours'), enquiryEndpoint: read('enquiryEndpoint') };
          if (value.email && !form.elements.email.checkValidity()) throw new Error('Check the email address.');
          if (value.enquiryEndpoint && !/^https:\/\//.test(value.enquiryEndpoint)) throw new Error('The enquiry endpoint must start with https://');
          await app.store.saveSettings('contact', value);
          app.settings.contact = value;
        } else {
          const intro = read('intro');
          const showSold = form.elements.showSold.checked;
          await app.store.saveSettings('collection', { ...app.settings.collection, intro });
          await app.store.saveSettings('listing', { ...app.settings.listing, showSold });
          app.settings.collection = { ...app.settings.collection, intro };
          app.settings.listing = { ...app.settings.listing, showSold };
        }
        toast('Saved');
      } catch (error) { fail(error); }
    });
  }));
  $('[data-password]', view)?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    await busy(form.querySelector('button'), async () => {
      try { await app.store.updatePassword(form.elements.password.value); form.reset(); toast('Password changed'); }
      catch (error) { fail(error); }
    });
  });
  $('[data-reset]', view)?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Reset the preview?', body: 'Every change made in preview mode, in this browser, goes back to the three showcase cars.', confirm: 'Reset', danger: true }))) return;
    app.store.reset();
    location.reload();
  });
  $('[data-copy-sql]', view)?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const { default: sql } = await import('../../supabase/schema.sql?raw');
    try { await navigator.clipboard.writeText(sql); button.textContent = 'Copied'; }
    catch { const blob = new Blob([sql], { type: 'text/plain' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'schema.sql' }); a.click(); button.textContent = 'Downloaded schema.sql'; }
  });
}
