// Overview: the day at a glance. What is on sale and what it is worth, new
// enquiries to answer, cars that still lack something, insurance about to
// turn to Expired, the stock by make and body, and the quick ways in.
import { esc, icon, rupees, timeAgo } from './ui.js';
import { siteURL, issues } from './cars.js';
import { FOR_SALE, STATUS, formatPrice, carTitle } from '../data.js';
import { insuranceDays, insuranceState } from '../listing-rules.js';
import { thumbImage } from '../util.js';

const thumb = car => car.photos[0] ? `<img src="${esc(thumbImage(car.photos[0]))}" alt="" loading="lazy" />` : icon.car;
const bars = (pairs, total) => pairs.map(([label, n]) => `<li><span>${esc(label)}</span><i style="--w:${Math.max(4, Math.round(n / total * 100))}%"></i><b>${n}</b></li>`).join('');

export function renderOverview(view, app) {
  const onSale = app.cars.filter(car => FOR_SALE.includes(car.status));
  const value = onSale.reduce((sum, car) => sum + (car.price || 0), 0);
  const sold = app.cars.filter(car => car.status === 'sold');
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const soldThisMonth = sold.filter(car => car.soldAt && new Date(car.soldAt) >= month).length;
  const fresh = (app.enquiries || []).filter(row => row.status === 'new');
  const attention = app.cars.filter(car => issues(car).length);
  const lapsing = onSale.filter(car => { const days = insuranceDays(car); return insuranceState(car) === 'valid' && days !== null && days <= 30; }).sort((a, b) => insuranceDays(a) - insuranceDays(b));
  const count = key => Object.entries(onSale.reduce((map, car) => { const name = car[key] || 'Other'; map[name] = (map[name] || 0) + 1; return map; }, {})).sort((a, b) => b[1] - a[1]);
  const makes = count('make'), bodies = count('body');
  const prices = onSale.map(car => car.price).filter(Boolean);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const recent = [...app.cars].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)).slice(0, 5);

  view.innerHTML = `<header class="a-head"><div><p class="a-eyebrow">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${greeting}.</h1><p class="a-sub">Here is the collection today.</p></div><div class="a-head-actions"><a class="a-button" href="${esc(siteURL(app, '/collection/'))}" target="_blank" rel="noopener">View the site ${icon.out}</a><a class="a-button" href="#car/new/paste">${icon.wand}Paste a WhatsApp ad</a><a class="a-button a-button--primary" href="#car/new">${icon.plus}Add a car</a></div></header>
    <section class="a-kpis">
      <a class="a-kpi" href="#cars"><small>On sale</small><b>${onSale.length}</b><span>${app.cars.filter(car => car.status === 'reserved').length} reserved · ${app.cars.filter(car => car.status === 'hidden').length} drafts</span></a>
      <a class="a-kpi" href="#cars"><small>Stock value</small><b>${rupees(value)}</b><span>${prices.length ? `${rupees(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length))} average` : 'Add prices to see this'}</span></a>
      <a class="a-kpi${fresh.length ? ' is-hot' : ''}" href="#enquiries"><small>New enquiries</small><b>${fresh.length}</b><span>${(app.enquiries || []).length} in all</span></a>
      <a class="a-kpi" href="#cars"><small>Sold</small><b>${sold.length}</b><span>${soldThisMonth} this month</span></a>
    </section>
    <div class="a-overview">
      <section class="a-card"><div class="a-card-head"><h2>New enquiries</h2><a class="a-link-small" href="#enquiries">All enquiries →</a></div>
        ${fresh.length ? `<ul class="a-feed">${fresh.slice(0, 5).map(row => `<li><a href="#enquiries"><span class="a-avatar">${esc((row.name || '?').trim().charAt(0).toUpperCase())}</span><span class="a-row-text"><b>${esc(row.name || 'Someone')}</b><small>${esc(String(row.subject || (row.kind === 'valuation' ? 'Valuation' : 'Enquiry')).replace(/\s*\([a-z0-9-]{6,}\)\s*$/, ''))}</small></span><time>${esc(timeAgo(row.created_at))}</time></a></li>`).join('')}</ul>` : `<p class="a-quiet">${icon.check}Nothing waiting. New enquiries from the site appear here the moment they’re sent.</p>`}</section>
      <section class="a-card"><div class="a-card-head"><h2>Needs attention</h2>${attention.length ? `<a class="a-link-small" href="#cars" data-attention>See all ${attention.length} →</a>` : ''}</div>
        ${attention.length ? `<ul class="a-feed">${attention.slice(0, 5).map(car => `<li><a href="#car/${esc(car.id)}"><span class="a-thumb a-thumb--small">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small class="is-warn">${esc(issues(car).join(' · '))}</small></span></a></li>`).join('')}</ul>` : `<p class="a-quiet">${icon.check}Every car on sale has photos, a price, a year and the distance driven.</p>`}</section>
      <section class="a-card"><h2>On sale, by make</h2>${makes.length ? `<ul class="a-bars">${bars(makes.slice(0, 8), makes[0][1])}</ul>` : '<p class="a-hint">No cars on sale yet.</p>'}</section>
      <section class="a-card"><h2>On sale, by body</h2>${bodies.length ? `<ul class="a-bars">${bars(bodies, bodies[0][1])}</ul>` : '<p class="a-hint">No cars on sale yet.</p>'}
        <p class="a-hint">${prices.length ? `Prices run from ${formatPrice(Math.min(...prices))} to ${formatPrice(Math.max(...prices))}.` : ''}</p></section>
      <section class="a-card"><h2>Insurance turning to Expired</h2>${lapsing.length ? `<ul class="a-feed">${lapsing.slice(0, 6).map(car => `<li><a href="#car/${esc(car.id)}"><span class="a-thumb a-thumb--small">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${insuranceDays(car) <= 0 ? 'Today' : `In ${insuranceDays(car)} ${insuranceDays(car) === 1 ? 'day' : 'days'}`}: the site will then show Expired</small></span></a></li>`).join('')}</ul>` : `<p class="a-quiet">${icon.check}No valid insurance lapses in the next 30 days.</p>`}</section>
      <section class="a-card"><div class="a-card-head"><h2>Recently edited</h2><a class="a-link-small" href="#cars">All cars →</a></div><ul class="a-feed">${recent.map(car => `<li><a href="#car/${esc(car.id)}"><span class="a-thumb a-thumb--small">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${esc(STATUS[car.status])} · ${esc(formatPrice(car.price) || (car.status === 'sold' ? 'Sold' : 'On request'))}</small></span><time>${esc(timeAgo(car.updatedAt))}</time></a></li>`).join('')}</ul></section>
    </div>`;
  view.querySelector('[data-attention]')?.addEventListener('click', () => { sessionStorage.setItem('baba:admin-filter', 'attention'); });
}
