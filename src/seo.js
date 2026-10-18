// How the site presents itself to search engines and to link previews
// (WhatsApp, Instagram, Facebook, X). Each page's title and description are
// written here, once; vite.config.js sets them into the page's head with its
// canonical address, Open Graph and Twitter tags and its structured data, so
// they are in the HTML that crawlers read, before any script runs. A car's
// own page (/car/?id=…) sets its tags when the car is known (setMeta and
// jsonLd below, from vehicle-page.js).
import { dealer, dealerLines, social } from './config.js';

export const SITE = 'https://babaluxurycar.com';
export const NAME = 'Baba Luxury Cars';
export const OG_IMAGE = `${SITE}/brand/og-image.jpg`;
const OG_ALT = 'Baba Luxury Car: pre-owned luxury cars, New Delhi';

// path → { title, description, crumb (its name in the breadcrumb trail),
// canonical: false where the page sets its own, robots, faq: questions read
// from the page, dealer: the dealership's own description on the page }.
export const pages = {
  '/': {
    title: 'Used Luxury Cars in Delhi | Baba Luxury Cars',
    description: 'Hand-picked, inspected used luxury cars in New Delhi: Mercedes-Benz, BMW, Land Rover and more. Visit our Paschim Vihar showroom, or buy from anywhere in India.',
    dealer: true, website: true,
  },
  '/collection/': {
    title: 'Used Luxury Cars for Sale in Delhi | Baba Luxury Cars',
    description: 'Browse our collection of second-hand luxury SUVs and saloons in New Delhi, each inspected, photographed and priced. Filter by body, budget and make.',
    crumb: 'Collection',
  },
  '/car/': {
    title: 'Used Luxury Car for Sale in Delhi | Baba Luxury Cars',
    description: 'A car from the Baba Luxury Cars collection: photographs, specification and history, and a viewing whenever you are ready.',
    canonical: false,
  },
  '/concierge/': {
    title: 'Luxury Car Sourcing Across India | Baba Luxury Cars Concierge',
    description: 'Tell us the car: a Rolls-Royce, a Bentley, a Range Rover in one exact specification. We source it across India, check every document and hand it over ready.',
    crumb: 'Concierge',
  },
  '/about/': {
    title: 'About Baba Luxury Cars | Luxury Car Dealer in New Delhi',
    description: 'For over 18 years, Baba Luxury Cars has bought and sold pre-owned luxury cars from Paschim Vihar, New Delhi: carefully selected, professionally evaluated, honestly presented.',
    crumb: 'About', dealer: true,
  },
  '/sell/': {
    title: 'Sell or Exchange Your Luxury Car in Delhi | Baba Luxury Cars',
    description: 'Sell or exchange your luxury car with Baba Luxury Cars. Share its details for a personal appraisal by our team; we buy across India and handle the RC transfer with you.',
    crumb: 'Sell your car', faq: true,
  },
  '/consultation/': {
    title: 'Book a 1:1 Car Consultation | Baba Luxury Cars',
    description: 'Book a private one-to-one call by phone or WhatsApp with Baba Luxury Cars, and find the luxury car that fits you, from our collection or found for you across India.',
    crumb: '1:1 Consultation',
  },
  '/privacy/': {
    title: 'Privacy Policy | Baba Luxury Cars',
    description: 'How Baba Luxury Cars collects, uses and protects your personal data when you browse our site, enquire about a car or ask us to value yours, under India’s DPDP Act, 2023.',
    crumb: 'Privacy policy',
  },
  '/terms/': {
    title: 'Terms and Conditions | Baba Luxury Cars',
    description: 'The terms for using babaluxurycar.com, and for enquiries, valuations, purchases, sales and concierge services with Baba Luxury Cars, New Delhi.',
    crumb: 'Terms and conditions',
  },
  '/booking-policy/': {
    title: 'Booking and Cancellation Policy | Baba Luxury Cars',
    description: 'How an advance reserves a car with Baba Luxury Cars, the 45 days to take delivery, and the 50% refund of the advance if you cancel after 45 days.',
    crumb: 'Booking policy',
  },
  '/delivery-policy/': {
    title: 'Car Delivery Across India: Policy | Baba Luxury Cars',
    description: 'Baba Luxury Cars delivers across India. How delivery works, what it costs on top of the price of the car, and collecting from our New Delhi showroom.',
    crumb: 'Delivery policy',
  },
  '/test-drive-policy/': {
    title: 'Test Drive Policy | Baba Luxury Cars',
    description: 'Taking a test drive with Baba Luxury Cars, New Delhi: what to bring, and who pays for the repair if the car is damaged while you are driving it.',
    crumb: 'Test drive policy',
  },
  '/rc-transfer-policy/': {
    title: 'RC Transfer and Papers Policy | Baba Luxury Cars',
    description: 'Baba Luxury Cars transfers the RC of every car it sells through the RTO. What we need from you, the charges, and registering the car in another state.',
    crumb: 'RC transfer policy',
  },
  '/404.html': {
    title: 'Page not found | Baba Luxury Cars',
    description: 'This page has moved or no longer exists. Explore the Baba Luxury Cars collection, or talk to us.',
    canonical: false, robots: 'noindex, follow',
  },
};

const digits = number => `+${String(number).replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1')}`;

// The dealership, as search engines describe a business: what it is, where,
// when it is open, how to reach each line, and where else it posts.
export const dealerSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'AutoDealer',
  '@id': `${SITE}/#dealer`,
  name: NAME,
  alternateName: 'Baba Luxury Car',
  url: `${SITE}/`,
  logo: `${SITE}/brand/baba-luxury-car.png`,
  image: OG_IMAGE,
  description: pages['/about/'].description,
  telephone: digits(dealer.phone),
  priceRange: '₹₹₹₹',
  currenciesAccepted: 'INR',
  address: { '@type': 'PostalAddress', streetAddress: 'B-2, Emaya Mall, Paschim Vihar', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110063', addressCountry: 'IN' },
  hasMap: 'https://www.google.com/maps/search/?api=1&query=Baba%20Luxury%20Car%2C%20B-2%2C%20Emaya%20Mall%2C%20Paschim%20Vihar%2C%20New%20Delhi%20110063',
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '11:00', closes: '20:00' }],
  areaServed: { '@type': 'Country', name: 'India' },
  contactPoint: [
    { '@type': 'ContactPoint', telephone: digits(dealer.phone), contactType: 'sales', areaServed: 'IN', description: 'Sales and WhatsApp' },
    ...dealerLines.map(line => ({ '@type': 'ContactPoint', telephone: digits(line.phone), contactType: /support/i.test(line.label) ? 'customer support' : 'sales', areaServed: 'IN', description: line.label })),
  ],
  sameAs: social.map(link => link.url),
});

const websiteSchema = () => ({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, name: NAME, url: `${SITE}/`, inLanguage: 'en-IN', publisher: { '@id': `${SITE}/#dealer` } });
export const breadcrumbSchema = trail => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
});

const esc = text => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const script = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// The head of a page, for vite.config.js: everything above, as tags. `html`
// is the page itself, for what is read from it (its questions).
export function headTags(path, page, html = '') {
  const url = `${SITE}${path === '/404.html' ? '/' : path}`;
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="robots" content="${page.robots || 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
    page.canonical === false ? '' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    page.canonical === false ? '' : `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(OG_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<meta name="geo.region" content="IN-DL" />`,
    `<meta name="geo.placename" content="New Delhi" />`,
  ];
  if (page.dealer) tags.push(script(dealerSchema()));
  if (page.website) tags.push(script(websiteSchema()));
  if (page.crumb) tags.push(script(breadcrumbSchema([['Home', `${SITE}/`], [page.crumb, url]])));
  if (page.faq) {
    const questions = [...html.matchAll(/<summary><span>([\s\S]*?)<\/span>[\s\S]*?<div class="sl-q-body"><p>([\s\S]*?)<\/p>/g)];
    if (questions.length) tags.push(script({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(([, q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } })) }));
  }
  return tags.filter(Boolean).map(tag => `  ${tag}\n`).join('');
}

// In the browser: a page that learns what it shows (a car) sets its own
// title, description, address and preview.
export function setMeta({ title, description, url, image, type, robots }) {
  const set = (selector, make, value) => {
    if (value === undefined) return;
    let element = document.head.querySelector(selector);
    if (!element) { element = make(); document.head.append(element); }
    element.setAttribute(element.tagName === 'LINK' ? 'href' : 'content', value);
  };
  const byProperty = key => () => { const element = document.createElement('meta'); element.setAttribute('property', key); return element; };
  const byName = key => () => { const element = document.createElement('meta'); element.setAttribute('name', key); return element; };
  if (title) document.title = title;
  set('meta[name="description"]', byName('description'), description);
  set('meta[name="robots"]', byName('robots'), robots);
  set('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), url);
  set('meta[property="og:title"]', byProperty('og:title'), title);
  set('meta[property="og:description"]', byProperty('og:description'), description);
  set('meta[property="og:url"]', byProperty('og:url'), url);
  set('meta[property="og:image"]', byProperty('og:image'), image);
  set('meta[property="og:type"]', byProperty('og:type'), type);
  set('meta[name="twitter:title"]', byName('twitter:title'), title);
  set('meta[name="twitter:description"]', byName('twitter:description'), description);
  set('meta[name="twitter:image"]', byName('twitter:image'), image);
}

// Structured data set by a page's script, replacing any it set before.
export function jsonLd(id, data) {
  let element = document.getElementById(id);
  if (!element) { element = Object.assign(document.createElement('script'), { id, type: 'application/ld+json' }); document.head.append(element); }
  element.textContent = JSON.stringify(data);
}
