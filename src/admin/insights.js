// Insights: how the site is working for the dealership, from the counts it
// keeps without cookies (src/track.js, public.insights()). Visits, car views
// and the taps that lead to a sale (WhatsApp, calls, directions) against the
// period before, with the inbox's enquiries; every day of the period; the
// cars people look at most and how many of those looks turn into contact;
// cars on sale that no one is looking at; and where visitors come from,
// where they are, what they use and what they read.
import { $, $$, esc, icon, timeAgo } from './ui.js';
import { FOR_SALE, carTitle, formatPrice } from '../data.js';
import { thumbImage } from '../util.js';

const PERIODS = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
const PAGES = { '/': 'Home', '/collection/': 'Collection', '/car/': 'A car’s page', '/sell/': 'Sell your car', '/concierge/': 'Concierge', '/consultation/': '1:1 Consultation', '/about/': 'About', '/privacy/': 'Privacy policy', '/terms/': 'Terms' };
const STATES = { DL: 'Delhi', HR: 'Haryana', UP: 'Uttar Pradesh', PB: 'Punjab', RJ: 'Rajasthan', CH: 'Chandigarh', HP: 'Himachal Pradesh', UK: 'Uttarakhand', UT: 'Uttarakhand', JK: 'Jammu & Kashmir', LA: 'Ladakh', MH: 'Maharashtra', GJ: 'Gujarat', MP: 'Madhya Pradesh', CT: 'Chhattisgarh', CG: 'Chhattisgarh', KA: 'Karnataka', TN: 'Tamil Nadu', KL: 'Kerala', TG: 'Telangana', TS: 'Telangana', AP: 'Andhra Pradesh', WB: 'West Bengal', OR: 'Odisha', OD: 'Odisha', BR: 'Bihar', JH: 'Jharkhand', AS: 'Assam', GA: 'Goa', NL: 'Nagaland', ML: 'Meghalaya', MN: 'Manipur', TR: 'Tripura', MZ: 'Mizoram', AR: 'Arunachal Pradesh', SK: 'Sikkim' };
// Where a visit came from, as a person would say it. A link opened from
// WhatsApp usually arrives with no referrer, so it reads as "Direct".
const sourceName = host => {
  const name = String(host || '');
  if (name === 'direct') return 'Direct, WhatsApp or typed';
  if (/(^|\.)google\./.test(name) || name === 'google') return 'Google';
  if (/instagram/.test(name)) return 'Instagram';
  if (/facebook|fb\.com/.test(name)) return 'Facebook';
  if (/youtube|youtu\.be/.test(name)) return 'YouTube';
  if (/whatsapp|wa\.me/.test(name)) return 'WhatsApp';
  if (/bing\./.test(name)) return 'Bing';
  if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(name)) return 'X (Twitter)';
  if (/linkedin/.test(name)) return 'LinkedIn';
  return name;
};
const deviceName = { mobile: 'Phones', tablet: 'Tablets', desktop: 'Computers' };
const number = n => Number(n || 0).toLocaleString('en-IN');
const thumb = car => car?.photos[0] ? `<img src="${esc(thumbImage(car.photos[0]))}" alt="" loading="lazy" />` : icon.car;
const bars = (pairs, labelled = name => esc(name)) => {
  if (!pairs.length) return '<p class="a-hint">Nothing counted in this period yet.</p>';
  const top = Math.max(...pairs.map(pair => pair[1]));
  return `<ul class="a-bars">${pairs.map(([name, n]) => `<li><span>${labelled(name)}</span><i style="--w:${Math.max(4, Math.round(n / top * 100))}%"></i><b>${number(n)}</b></li>`).join('')}</ul>`;
};
// A change against the period before, in words.
const change = (now, before, days) => {
  if (!before) return now ? `None in the ${days} days before` : 'Nothing yet';
  const percent = Math.round((now - before) / before * 100);
  return `<em class="${percent >= 0 ? 'is-up' : 'is-down'}">${percent >= 0 ? '+' : '−'}${Math.abs(percent)}%</em> on the ${days} days before`;
};
// The enquiries a car brought in: those sent from its page, or naming it.
const enquiriesFor = (car, rows) => rows.filter(row => String(row.page || '').includes(`id=${encodeURIComponent(car.slug)}`) || (row.car && row.car === carTitle(car))).length;
const enquiryKind = row => row.kind === 'valuation' ? 'Sell or exchange (valuation)' : row.kind === 'concierge' ? 'Concierge brief' : row.details?.callVia ? '1:1 call booked' : 'Enquiry';

// The Cars list and a car's editor show each car's views; they share one
// fetch, kept a minute.
export async function carViews(app) {
  const fresh = app.insights?.days === 30 && Date.now() - app.insights.at < 60_000;
  if (!fresh) {
    try { app.insights = { days: 30, at: Date.now(), data: await app.store.insights(30) }; }
    catch { app.insights = { days: 30, at: Date.now(), data: null }; }
  }
  return new Map((app.insights.data?.cars || []).map(entry => [entry.car_id, entry]));
}

let period = 30;
export async function renderInsights(view, app) {
  view.innerHTML = `<header class="a-head"><div><h1>Insights</h1><p class="a-sub">Who visits the site, which cars they look at, and how many get in touch. Counted anonymously, without cookies.</p></div>
    <div class="a-head-actions"><div class="a-segment a-segment--text" role="group" aria-label="Period">${PERIODS.map(([days, label]) => `<button type="button" data-days="${days}" aria-pressed="${days === period}">${label}</button>`).join('')}</div></div></header>
    <div data-insights><div class="a-loading"><i class="a-spinner"></i>Counting…</div></div>`;
  $$('[data-days]', view).forEach(button => button.addEventListener('click', () => { period = Number(button.dataset.days); renderInsights(view, app); }));
  const holder = $('[data-insights]', view);
  let data;
  try { data = await app.store.insights(period); }
  catch (error) {
    holder.innerHTML = `<section class="a-card"><h2>Insights aren’t switched on yet.</h2><p class="a-hint">The database needs its counting table first: run the updated <code>supabase/schema.sql</code> once (<code>npm run db:schema</code>). The site starts counting from then on.</p><p class="a-hint">${esc(error.message)}</p></section>`;
    return;
  }
  if (!view.isConnected) return;
  if (period === 30) app.insights = { days: 30, at: Date.now(), data };
  const days = period, since = Date.parse(data.since);
  const totals = data.totals || {}, before = data.previous || {};
  const enquiries = (app.enquiries || []).filter(row => Date.parse(row.created_at) >= since);
  const enquiriesBefore = (app.enquiries || []).filter(row => { const at = Date.parse(row.created_at); return at >= since - days * 864e5 && at < since; });
  const byId = new Map(app.cars.map(car => [car.id, car]));
  const counted = (data.cars || []).filter(entry => byId.has(entry.car_id));
  const top = counted.filter(entry => entry.views).sort((a, b) => b.views - a.views).slice(0, 10);
  const viewsOf = new Map(counted.map(entry => [entry.car_id, entry]));
  const quiet = app.cars.filter(car => FOR_SALE.includes(car.status) && car.createdAt && Date.now() - Date.parse(car.createdAt) > 7 * 864e5)
    .map(car => ({ car, views: viewsOf.get(car.id)?.views || 0, listed: Math.floor((Date.now() - Date.parse(car.createdAt)) / 864e5) }))
    .filter(entry => entry.views <= 2).sort((a, b) => a.views - b.views || b.listed - a.listed).slice(0, 8);
  const empty = !Object.values(totals).some(Boolean);

  // Every day of the period, quiet days too, in Indian time.
  const series = [];
  const byDay = new Map((data.daily || []).map(entry => [entry.day, entry]));
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() + 330 * 6e4 - i * 864e5).toISOString().slice(0, 10);
    series.push(byDay.get(day) || { day, visits: 0, car_views: 0, contacts: 0 });
  }
  const peak = Math.max(1, ...series.map(entry => Math.max(entry.visits, entry.car_views)));
  const label = day => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const contacts = (totals.whatsapp || 0) + (totals.call || 0);

  holder.innerHTML = `${empty ? `<p class="a-quiet a-insights-note">${icon.info}No visits counted in this period yet. Counting runs on the live site only: every page, car and tap from now on appears here.</p>` : ''}
    <section class="a-kpis a-kpis--six">
      <div class="a-kpi"><small>Visits</small><b>${number(data.visits)}</b><span>${change(data.visits, data.visits_before, days)}</span></div>
      <div class="a-kpi"><small>Car views</small><b>${number(totals.car_view)}</b><span>${change(totals.car_view || 0, before.car_view || 0, days)}</span></div>
      <div class="a-kpi${totals.whatsapp ? ' is-hot' : ''}"><small>WhatsApp taps</small><b>${number(totals.whatsapp)}</b><span>${change(totals.whatsapp || 0, before.whatsapp || 0, days)}</span></div>
      <div class="a-kpi"><small>Calls</small><b>${number(totals.call)}</b><span>${change(totals.call || 0, before.call || 0, days)}</span></div>
      <a class="a-kpi" href="#enquiries"><small>Enquiries</small><b>${number(enquiries.length)}</b><span>${change(enquiries.length, enquiriesBefore.length, days)}</span></a>
      <div class="a-kpi"><small>Directions</small><b>${number(totals.directions)}</b><span>${totals.shortlist ? `${number(totals.shortlist)} cars shortlisted` : change(totals.directions || 0, before.directions || 0, days)}</span></div>
    </section>
    <section class="a-card a-chart-card"><div class="a-card-head"><h2>Every day</h2><p class="a-legend"><span class="is-visits">Visits</span><span class="is-views">Car views</span></p></div>
      <div class="a-chart" style="--days:${series.length}" role="img" aria-label="Visits and car views on each of the last ${days} days">${series.map(entry => `<div class="a-chart-day" title="${esc(label(entry.day))}: ${entry.visits} visits, ${entry.car_views} car views, ${entry.contacts} WhatsApp taps and calls"><i class="is-visits" style="--h:${(entry.visits / peak * 100).toFixed(1)}%"></i><i class="is-views" style="--h:${(entry.car_views / peak * 100).toFixed(1)}%"></i></div>`).join('')}</div>
      <p class="a-chart-axis"><span>${esc(label(series[0].day))}</span><span>${esc(label(series.at(-1).day))}</span></p>
      <p class="a-hint">${contacts ? `${number(contacts)} WhatsApp taps and calls in all: ${data.visits ? `about one for every ${Math.max(1, Math.round(data.visits / contacts))} visits` : ''}.` : 'WhatsApp taps and calls appear here as they come in.'}</p></section>
    <div class="a-overview">
      <section class="a-card a-span-2"><div class="a-card-head"><h2>Most viewed cars</h2><a class="a-link-small" href="#cars">All cars →</a></div>
        ${top.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th scope="col">Car</th><th scope="col">Views</th><th scope="col">All time</th><th scope="col">WhatsApp</th><th scope="col">Calls</th><th scope="col">Enquiries</th><th scope="col">Interest</th></tr></thead><tbody>${top.map(entry => {
          const car = byId.get(entry.car_id), sent = enquiriesFor(car, enquiries), reached = entry.whatsapp + entry.calls + sent;
          return `<tr><td><a class="a-table-car" href="#car/${esc(car.id)}"><span class="a-thumb a-thumb--small">${thumb(car)}</span><span><b>${esc(carTitle(car))}</b><small>${esc([car.year, car.status === 'sold' ? 'Sold' : formatPrice(car.price) || 'On request'].filter(Boolean).join(' · '))}</small></span></a></td><td><b>${number(entry.views)}</b></td><td>${number(entry.views_all)}</td><td>${number(entry.whatsapp)}</td><td>${number(entry.calls)}</td><td>${number(sent)}</td><td><span class="a-interest" style="--w:${Math.min(100, Math.round(reached / entry.views * 100))}%">${Math.round(reached / entry.views * 100)}%</span></td></tr>`;
        }).join('')}</tbody></table></div><p class="a-hint">Interest: WhatsApp taps, calls and enquiries for each hundred views. A car with many views and little interest may need a price check; one with few views, better photos or a post.</p>` : '<p class="a-quiet">No car has been viewed in this period yet.</p>'}</section>
      <section class="a-card a-span-2"><div class="a-card-head"><h2>On sale, but few are looking</h2></div>
        ${quiet.length ? `<ul class="a-feed">${quiet.map(({ car, views, listed }) => `<li><a href="#car/${esc(car.id)}"><span class="a-thumb a-thumb--small">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small class="is-warn">${views ? `${views} ${views === 1 ? 'view' : 'views'}` : 'No views'} in ${days} days · listed ${listed} days ago${viewsOf.get(car.id)?.last_view ? ` · last seen ${esc(timeAgo(viewsOf.get(car.id).last_view))}` : ''}</small></span></a></li>`).join('')}</ul><p class="a-hint">New photographs, a price check, or sharing it on Instagram and WhatsApp can bring a car back into view.</p>` : `<p class="a-quiet">${icon.check}Every car on sale for more than a week is being looked at.</p>`}</section>
      <section class="a-card"><h2>Where visits come from</h2>${bars((data.sources || []).map(entry => [entry.name, entry.n]), name => esc(sourceName(name)))}</section>
      <section class="a-card"><h2>Where visitors are</h2>${bars((data.cities || []).map(entry => [[entry.name, STATES[entry.region] || entry.region].filter(Boolean).join(', '), entry.n]))}</section>
      <section class="a-card"><h2>What they use</h2>${bars((data.devices || []).map(entry => [deviceName[entry.name] || entry.name, entry.n]))}
        ${data.visits ? `<p class="a-hint">${Math.round(((data.devices || []).find(entry => entry.name === 'mobile')?.n || 0) / data.visits * 100)}% of visits are on a phone.</p>` : ''}</section>
      <section class="a-card"><h2>What they read</h2>${bars((data.pages || []).map(entry => [PAGES[entry.name] || entry.name, entry.n]))}</section>
      <section class="a-card"><h2>What people ask for</h2>${bars(Object.entries(enquiries.reduce((map, row) => { const kind = enquiryKind(row); map[kind] = (map[kind] || 0) + 1; return map; }, {})).sort((a, b) => b[1] - a[1]))}</section>
      <section class="a-card"><h2>Taps</h2>${bars([['WhatsApp', totals.whatsapp || 0], ['Calls', totals.call || 0], ['Directions', totals.directions || 0], ['Shortlisted', totals.shortlist || 0]].filter(pair => pair[1]))}</section>
    </div>`;
}
