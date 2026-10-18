import test from 'node:test';
import assert from 'node:assert/strict';
import { pages, headTags, dealerSchema, SITE } from '../src/seo.js';
import { sitemap } from '../api/sitemap.js';
import { eventRow } from '../api/track.js';

const visitor = (headers = {}) => ({ headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', ...headers } });

test('every public page has its own title and a description search engines will show whole', () => {
  const titles = Object.values(pages).map(page => page.title);
  assert.equal(new Set(titles).size, titles.length, 'titles are unique');
  for (const [path, page] of Object.entries(pages)) {
    assert(page.title.length <= 65, `${path} title fits: ${page.title.length}`);
    assert(page.description.length >= 70 && page.description.length <= 180, `${path} description: ${page.description.length}`);
  }
});

test('a page’s head carries its canonical address, previews and structured data', () => {
  const head = headTags('/sell/', pages['/sell/'], '<details class="sl-q"><summary><span>Do you buy cars outside Delhi?</span><i></i></summary><div class="sl-q-body"><p>Yes. We buy across India.</p></div></details>');
  assert.match(head, /<link rel="canonical" href="https:\/\/www\.babaluxurycar\.com\/sell\/" \/>/);
  assert.match(head, /<meta property="og:image" content="https:\/\/www\.babaluxurycar\.com\/brand\/og-image\.jpg" \/>/);
  const data = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  assert.deepEqual(data.map(entry => entry['@type']), ['BreadcrumbList', 'FAQPage']);
  assert.equal(data[1].mainEntity[0].name, 'Do you buy cars outside Delhi?');
  // A car's page sets its own canonical address; the generic one would merge every car.
  assert.doesNotMatch(headTags('/car/', pages['/car/']), /rel="canonical"/);
  assert.match(headTags('/404.html', pages['/404.html']), /noindex/);
  // Every page links the icon search results show, and the app manifest;
  // verification codes appear only once they are given.
  assert.match(head, /<link rel="icon" href="\/favicon\.ico" sizes="48x48" \/>/);
  assert.match(head, /<link rel="manifest" href="\/site\.webmanifest" \/>/);
  assert.doesNotMatch(head, /google-site-verification|msvalidate/);
});

test('the dealership is described with its address, hours and every line', () => {
  const dealer = dealerSchema();
  assert.equal(dealer['@type'], 'AutoDealer');
  assert.equal(dealer.address.postalCode, '110063');
  assert.equal(dealer.contactPoint.length, 3);
  assert(dealer.contactPoint.every(point => /^\+91\d{10}$/.test(point.telephone)));
  assert(dealer.sameAs.every(url => url.startsWith('https://')));
  assert.deepEqual(dealer.founder.map(person => person.name), ['Vinod Ahuja', 'Pawan Ahuja']);
  // What has not been given yet is left out, not sent empty.
  assert(!('geo' in JSON.parse(JSON.stringify(dealer))));
});

test('the sitemap lists the pages and each car, escaped, with its photograph', () => {
  const xml = sitemap([{ slug: 'bmw-x7-2021', photos: ['https://cdn.example/x7.webp'], updated_at: '2026-10-01T10:00:00Z' }, { slug: 'a&b', photos: [], created_at: '2026-09-01T10:00:00Z' }], '2026-10-16');
  assert.match(xml, new RegExp(`<loc>${SITE}/</loc>`));
  assert.match(xml, /<loc>https:\/\/www\.babaluxurycar\.com\/car\/\?id=bmw-x7-2021<\/loc>\n {4}<lastmod>2026-10-01<\/lastmod>\n {4}<image:image><image:loc>https:\/\/cdn\.example\/x7\.webp<\/image:loc>/);
  assert.match(xml, /id=a%26b/);
  assert.doesNotMatch(xml, /\/admin\//);
});

test('a count is stored only for known kinds, from people, without anything that identifies them', () => {
  const row = eventRow({ kind: 'car_view', car: '3e205321-1b1f-4f70-831e-6f11a1abb4e7', path: '/car/?id=x7', device: 'mobile', source: 'Google.com', ip: '1.2.3.4' }, visitor({ 'x-vercel-ip-city': 'New%20Delhi', 'x-vercel-ip-country-region': 'DL', 'x-vercel-ip-country': 'IN' }));
  assert.deepEqual(row, { kind: 'car_view', car_id: '3e205321-1b1f-4f70-831e-6f11a1abb4e7', path: '/car/', source: 'google.com', device: 'mobile', city: 'New Delhi', region: 'DL', country: 'IN' });
  assert.equal(eventRow({ kind: 'drop table' }, visitor()), null);
  assert.equal(eventRow({ kind: 'view' }, visitor({ 'user-agent': 'Googlebot/2.1' })), null);
  assert.equal(eventRow({ kind: 'view' }, visitor({ 'user-agent': 'WhatsApp/2.23' })), null);
  assert.equal(eventRow('{"kind":"call","car":"not-a-uuid","device":"fridge"}', visitor()).car_id, null);
  assert.equal(eventRow('{"kind":"call","device":"fridge"}', visitor()).device, null);
  assert.equal(eventRow('{"kind":"view","source":"<script>"}', visitor()).source, null);
  assert.equal(eventRow('not json', visitor()), null);
});
