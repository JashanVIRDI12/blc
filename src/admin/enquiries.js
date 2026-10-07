// Enquiries: every enquiry and valuation sent from the site, newest first.
// Call or WhatsApp in one tap (the message already names the car), mark each
// one Contacted or Closed, keep a note, export them all.
import { $, esc, toast, fail, confirmDialog, icon, timeAgo, downloadCSV } from './ui.js';
import { carTitle } from '../data.js';
import { thumbImage } from '../util.js';

const LABELS = { new: 'New', contacted: 'Contacted', closed: 'Closed' };
const DETAIL = { vehicle: 'Vehicle', registration: 'Registration', kilometres: 'Driven', exchange: 'Exchange', requests: 'Wants' };
const KINDS = { enquiry: ['Enquiry', 'enquiry'], valuation: ['Valuation', 'valuation'], concierge: ['Concierge', 'concierge'] };
let tab = 'new', query = '';
// "Land Rover Defender 110 — viewing (land-rover-defender-…)": the site adds
// the car's address for reference; the inbox shows the car itself instead.
const tidy = text => String(text || '').replace(/\s*\([a-z0-9-]{6,}\)\s*$/, '');

export function renderEnquiries(view, app) {
  const rows = () => app.enquiries || [];
  const counts = () => ({ all: rows().length, ...Object.fromEntries(Object.keys(LABELS).map(key => [key, rows().filter(row => row.status === key).length])) });
  view.innerHTML = `<header class="a-head"><div><h1>Enquiries</h1><p class="a-sub">Every enquiry and valuation request sent from the site lands here the moment it is sent. Reply by phone or WhatsApp, then mark it.</p></div><div class="a-head-actions"><button type="button" class="a-button" data-refresh>Refresh</button><button type="button" class="a-button" data-export>${icon.download}Export</button></div></header>
    <div class="a-toolbar"><div class="a-tabs" role="group" aria-label="Show" data-tabs></div><label class="a-search">${icon.search}<span class="sr-only">Search enquiries</span><input type="search" placeholder="Name, phone or car" value="${esc(query)}" data-query /></label></div>
    <div class="a-inbox" data-inbox></div>`;
  const inbox = $('[data-inbox]', view);
  const car = row => app.cars.find(entry => entry.slug === row.car || entry.id === row.car);
  const draw = () => {
    const n = counts();
    $('[data-tabs]', view).innerHTML = [['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed'], ['all', 'All']].map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${key === tab}">${label}<b>${n[key]}</b></button>`).join('');
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows().filter(row => (tab === 'all' || row.status === tab) && words.every(word => `${row.name} ${row.phone} ${row.email} ${row.subject} ${row.message} ${JSON.stringify(row.details)}`.toLowerCase().includes(word)));
    if (!rows().length) { inbox.innerHTML = `<div class="a-empty"><h2>No enquiries yet.</h2><p>When a visitor sends an enquiry or asks for a valuation on the site, it appears here at once, with their number ready to call.</p></div>`; return; }
    if (!list.length) { inbox.innerHTML = `<div class="a-empty"><p>${tab === 'new' && !query ? `${icon.check} All caught up: no new enquiries.` : 'Nothing matches.'}</p></div>`; return; }
    inbox.innerHTML = list.map(row => {
      const linked = car(row);
      const digits = String(row.phone || '').replace(/\D/g, '');
      const whatsapp = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(`Hello ${(row.name || '').split(' ')[0]}, this is Baba Luxury Cars, about your ${row.kind === 'valuation' ? 'valuation request' : row.kind === 'concierge' ? 'concierge request' : 'enquiry'}${linked ? ` for the ${carTitle(linked)}` : ''}.`)}` : '';
      const details = Object.entries(row.details || {}).filter(([, value]) => String(value).trim()).map(([key, value]) => `<span><b>${esc(DETAIL[key] || key)}</b>${esc(key === 'exchange' ? 'Yes' : value)}</span>`).join('');
      return `<article class="a-enquiry" data-id="${esc(row.id)}" data-state="${row.status}">
        <header><span class="a-avatar">${esc((row.name || '?').trim().charAt(0).toUpperCase())}</span><div><b>${esc(row.name || 'No name')}</b><small><i class="a-kind a-kind--${(KINDS[row.kind] || KINDS.enquiry)[1]}">${(KINDS[row.kind] || KINDS.enquiry)[0]}</i> ${esc(timeAgo(row.created_at))} · ${esc(new Date(row.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</small></div><span class="a-state" data-tone="${row.status}">${LABELS[row.status]}</span></header>
        ${row.subject ? `<p class="a-enquiry-subject">${esc(tidy(row.subject))}</p>` : ''}
        ${row.message ? `<p class="a-enquiry-message">${esc(row.message)}</p>` : ''}
        ${details ? `<p class="a-enquiry-details">${details}</p>` : ''}
        ${linked ? `<a class="a-enquiry-car" href="#car/${esc(linked.id)}"><span class="a-thumb a-thumb--small">${linked.photos[0] ? `<img src="${esc(thumbImage(linked.photos[0]))}" alt="" loading="lazy" />` : icon.car}</span><span>${esc(carTitle(linked))}</span></a>` : ''}
        <div class="a-enquiry-actions">${digits ? `<a class="a-button a-button--small" href="tel:${esc(row.phone.replace(/[^+\d]/g, ''))}">${icon.phone}${esc(row.phone)}</a><a class="a-button a-button--small a-button--whatsapp" href="${esc(whatsapp)}" target="_blank" rel="noopener">${icon.chat}WhatsApp</a>` : ''}${row.email ? `<a class="a-button a-button--small" href="mailto:${esc(row.email)}">${esc(row.email)}</a>` : ''}
          <span class="a-enquiry-mark">${row.status !== 'contacted' ? `<button type="button" class="a-button a-button--small" data-mark="contacted">${icon.check}Contacted</button>` : ''}${row.status !== 'closed' ? `<button type="button" class="a-button a-button--small a-button--ghost" data-mark="closed">Close</button>` : `<button type="button" class="a-button a-button--small a-button--ghost" data-mark="new">Reopen</button>`}<button type="button" class="a-icon-button" data-delete aria-label="Delete this enquiry" title="Delete">${icon.trash}</button></span></div>
        <label class="a-field a-enquiry-note"><span class="sr-only">Note</span><input data-note maxlength="500" placeholder="Add a note: called back, test drive on Saturday…" value="${esc(row.notes || '')}" /></label>
      </article>`;
    }).join('');
  };
  draw();

  $('[data-tabs]', view).addEventListener('click', event => { const button = event.target.closest('[data-tab]'); if (button) { tab = button.dataset.tab; draw(); } });
  $('[data-query]', view).addEventListener('input', event => { query = event.target.value; draw(); });
  $('[data-refresh]', view).addEventListener('click', async () => { try { app.enquiries = await app.store.listEnquiries(); app.refresh(); draw(); toast('Up to date'); } catch (error) { fail(error); } });
  $('[data-export]', view).addEventListener('click', () => {
    downloadCSV(`baba-enquiries-${new Date().toISOString().slice(0, 10)}.csv`, [['Received', 'Type', 'Status', 'Name', 'Phone', 'Email', 'About', 'Message', 'Details', 'Car', 'Note'], ...rows().map(row => [new Date(row.created_at).toLocaleString('en-IN'), row.kind, LABELS[row.status], row.name, row.phone, row.email, row.subject, row.message, Object.entries(row.details || {}).map(([key, value]) => `${DETAIL[key] || key}: ${value}`).join('; '), car(row) ? carTitle(car(row)) : row.car, row.notes])]);
  });
  const update = async (id, patch, message) => {
    try {
      const saved = await app.store.patchEnquiry(id, patch);
      app.enquiries = rows().map(row => row.id === id ? saved : row);
      app.refresh(); draw();
      if (message) toast(message);
    } catch (error) { fail(error); }
  };
  inbox.addEventListener('click', async event => {
    const article = event.target.closest('[data-id]');
    if (!article) return;
    const id = article.dataset.id;
    const mark = event.target.closest('[data-mark]');
    if (mark) await update(id, { status: mark.dataset.mark }, `Marked ${LABELS[mark.dataset.mark]}`);
    if (event.target.closest('[data-delete]')) {
      if (!(await confirmDialog({ title: 'Delete this enquiry?', body: 'It goes for good. To keep it on record, mark it Closed instead.', confirm: 'Delete', danger: true }))) return;
      try { await app.store.deleteEnquiry(id); app.enquiries = rows().filter(row => row.id !== id); app.refresh(); draw(); toast('Deleted'); } catch (error) { fail(error); }
    }
    // Calling or messaging someone new marks them Contacted.
    const reach = event.target.closest('a[href^="tel:"], a[href^="https://wa.me"]');
    if (reach && article.dataset.state === 'new') setTimeout(() => update(id, { status: 'contacted' }), 400);
  });
  inbox.addEventListener('change', event => {
    const note = event.target.closest('[data-note]');
    if (note) update(note.closest('[data-id]').dataset.id, { notes: note.value.trim() || null }, 'Note saved');
  });
}
