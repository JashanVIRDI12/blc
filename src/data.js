// The dealership's stock, collections and settings. They come from Supabase
// once it is connected (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, see
// docs/ADMIN.md) and are edited in the admin portal; until then, and if it
// cannot be reached, from src/config.js. With nothing for sale, the three
// showcase models stand in as labelled previews, as they always have.
import { showcase, inventory, dealer, defaultCollections, currency } from './config.js';
import { numeric, present, stored } from './util.js';
import { LISTING_DEFAULTS, drivenText, formatDriven, insuranceState, insuranceText, plateLabel, normalizePlate } from './listing-rules.js';
export { drivenText, formatDriven, insuranceState, insuranceText, plateLabel };

export const supabase = {
  url: (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
  key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};
export const live = Boolean(supabase.url && supabase.key);

export const STATUS = {
  available: 'Available',
  reserved: 'Reserved',
  coming_soon: 'Coming soon',
  sold: 'Sold',
  hidden: 'Hidden',
};
// The cars a visitor can still buy or wait for.
export const FOR_SALE = ['available', 'reserved', 'coming_soon'];
export const BODIES = ['SUV', 'Sedan', 'Coupé', 'Convertible', 'Hatchback', 'Estate', 'MPV', 'Pickup'];
export const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Plug-in hybrid', 'Electric'];
export const TRANSMISSIONS = ['Automatic', 'Manual'];
export const PRICE_BANDS = [
  { id: 'under-50l', label: 'Under ₹50 lakh', min: 0, max: 50e5 },
  { id: '50l-1cr', label: '₹50 lakh – 1 crore', min: 50e5, max: 1e7 },
  { id: '1-2cr', label: '₹1 – 2 crore', min: 1e7, max: 2e7 },
  { id: 'above-2cr', label: 'Above ₹2 crore', min: 2e7, max: Infinity },
];
// Distance is never written with "km" (the dealership's rule).
export const KM_BANDS = [
  { id: '20k', label: 'Driven under 20,000', max: 20000 },
  { id: '50k', label: 'Driven under 50,000', max: 50000 },
  { id: '1l', label: 'Driven under 1,00,000', max: 100000 },
];

export const defaultSettings = {
  contact: { phone: '', whatsapp: '', email: '', address: '', hours: '', enquiryEndpoint: '' },
  // `choose`: 'priciest', the most expensive cars on sale, kept up to date by
  // themselves; or 'picks', the cars starred in the admin, in their order.
  home: { title: 'Featured collection.', intro: 'Distinctive cars. Carefully considered.\nEnquire for current availability.', limit: 3, choose: 'priciest' },
  collection: { intro: 'Every car here has been chosen, inspected and photographed by us. Filter by body, budget or make, or let us find the one you have in mind.' },
  listing: { showSold: true, newDays: 21, ...LISTING_DEFAULTS },
  // The home page's "Across India" map. `places`: the cities and states it
  // shows, comma or line separated (src/places.js); places on delivery
  // photos are added. `delivered`: a total to show (empty shows the cars
  // marked Sold).
  india: {
    intro: 'From our showroom in Paschim Vihar, cars come and go across the country: bought from owners from Gujarat to Odisha, delivered from Jammu & Kashmir to Andhra Pradesh.',
    places: 'Jammu & Kashmir, Himachal Pradesh, Chandigarh, Dehradun, Rudrapur, Rajasthan, Ahmedabad, Raipur, Jamshedpur, Bhubaneswar, Andhra Pradesh',
    delivered: '',
  },
  // Baba Concierge, on each car's page. `services`: one group per line,
  // "Group: item, item"; "Group [SUV, Pickup]: …" shows only for those bodies.
  concierge: {
    whatsapp: '+91 85108 30242',
    intro: 'Buying this car and want it your way? Choose what you’d like done before it’s yours. We arrange the work with specialists we trust and hand the car over finished.',
    services: [
      'Protection: Ceramic coating, Paint protection film (PPF), Colour-change wrap, Window film, Underbody coating',
      'Style: Alloy wheels and tyres, Body kit and styling, Chrome delete, Interior re-trim, Starlight headliner, Ambient lighting',
      'Tech and comfort: Sound system upgrade, Rear-seat screens, Dashcam and 360° camera, Wireless CarPlay or Android Auto, Seat ventilation or massage',
      'Off-road [SUV, Pickup]: Lift kit, All-terrain tyres, Roof rack and ladder, Snorkel, Winch and recovery kit, Underbody protection',
      'Paperwork and delivery: Registration transfer, Fancy or VIP number, Insurance, Finance, Detailing before delivery, Pan-India delivery',
    ].join('\n'),
  },
};
// The concierge's services, read from the admin's text.
export const conciergeGroups = (text, body = '') => String(text || '').split('\n').map(line => {
  const match = line.match(/^\s*([^:[\]]+?)\s*(?:\[([^\]]*)\])?\s*:\s*(.+)$/);
  if (!match) return null;
  const only = match[2] ? match[2].split(',').map(item => item.trim().toLowerCase()).filter(Boolean) : [];
  return { title: match[1].trim(), only, items: match[3].split(',').map(item => item.trim()).filter(Boolean) };
}).filter(group => group && group.items.length && (body === '*' || !group.only.length || group.only.includes(String(body).toLowerCase())));

// Database rows (snake_case) as the site uses them.
export function fromRow(row) {
  return {
    id: row.id,
    slug: row.slug || row.id,
    make: row.make || '',
    model: row.model || '',
    variant: row.variant || '',
    body: row.body || '',
    year: row.year ?? null,
    kilometres: row.kilometres ?? null,
    owners: row.owners ?? null,
    fuel: row.fuel || '',
    transmission: row.transmission || '',
    colour: row.colour || '',
    // Only the part of the registration the site may show (HR51); the full
    // number is kept in car_private, for the admin.
    registration: row.registration || '',
    ...normalizePlate({ plateTag: row.plate_tag, plateNumber: row.plate_number }),
    insurance: row.insurance === 'valid' || row.insurance === 'expired' ? row.insurance : '',
    insuranceUntil: row.insurance_until || null,
    location: row.location || '',
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    status: STATUS[row.status] ? row.status : 'available',
    note: row.note || '',
    featured: Boolean(row.featured),
    featuredRank: row.featured_rank ?? 0,
    sortOrder: row.sort_order ?? 0,
    collections: Array.isArray(row.collections) ? row.collections : [],
    photos: (Array.isArray(row.photos) ? row.photos : []).filter(Boolean),
    // The photograph a card turns to under the pointer (usually the cabin).
    hoverPhoto: row.hover_photo || '',
    highlights: (Array.isArray(row.highlights) ? row.highlights : []).filter(Boolean),
    description: row.description || '',
    specs: Array.isArray(row.specs) ? row.specs.filter(pair => Array.isArray(pair) && pair[0]) : [],
    inspection: row.inspection && typeof row.inspection === 'object' ? row.inspection : null,
    model3d: row.model3d || '',
    soldAt: row.sold_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    preview: false,
  };
}
export function toRow(car) {
  const { plateTag, plateNumber } = normalizePlate(car);
  return {
    id: car.id, slug: car.slug, make: car.make, model: car.model, variant: car.variant || null, body: car.body || null,
    year: car.year ?? null, kilometres: car.kilometres ?? null, owners: car.owners ?? null, fuel: car.fuel || null,
    transmission: car.transmission || null, colour: car.colour || null, registration: car.registration || null,
    plate_tag: plateTag || null, plate_number: plateNumber || null,
    insurance: car.insurance || null, insurance_until: car.insuranceUntil || null,
    location: car.location || null, price: car.price ?? null, status: car.status, note: car.note || null,
    featured: Boolean(car.featured), featured_rank: car.featuredRank ?? 0, sort_order: car.sortOrder ?? 0,
    collections: car.collections ?? [], photos: car.photos ?? [], hover_photo: car.hoverPhoto && (car.photos ?? []).includes(car.hoverPhoto) ? car.hoverPhoto : null, highlights: car.highlights ?? [],
    description: car.description || null, specs: car.specs ?? [], inspection: car.inspection ?? null, model3d: car.model3d || null,
  };
}
// A showcase model as a labelled preview: no invented year, price or history.
export const fromShowcase = (item, index) => ({
  ...fromRow({ id: item.id, slug: item.id, make: item.make, model: item.model, variant: item.trim?.startsWith(item.model) ? item.trim.slice(item.model.length).trim() : item.trim, body: item.body, colour: item.paint?.name, specs: item.specs, collections: item.collections, photos: [item.image], model3d: item.id, featured: true, featured_rank: index, sort_order: index }),
  preview: true,
});
// Records written straight into config.js (the older contract).
const fromConfig = item => fromRow({ ...item, slug: item.id, photos: item.photos?.length ? item.photos : [item.image], status: item.status ?? (item.available === false ? 'sold' : 'available') });

async function rest(path) {
  const response = await fetch(`${supabase.url}/rest/v1/${path}`, { headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Supabase ${response.status} on ${path.split('?')[0]}`);
  return response.json();
}
const merge = (base, extra) => Object.fromEntries(Object.entries(base).map(([key, value]) => [key, extra?.[key] && typeof extra[key] === 'object' ? { ...value, ...Object.fromEntries(Object.entries(extra[key]).filter(([, v]) => present(v))) } : value]));

// Before Supabase is connected, the admin portal keeps a preview in the
// browser; /?preview shows it on the site, in that browser and tab only.
function previewing() {
  if (live) return false;
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('preview')) sessionStorage.setItem('baba:preview', '1');
    if (params.has('end-preview')) sessionStorage.removeItem('baba:preview');
    return sessionStorage.getItem('baba:preview') === '1';
  } catch { return false; }
}

let pending;
export const loadSite = () => pending ??= fetchSite();
async function fetchSite() {
  let cars = inventory.map(fromConfig), collections = defaultCollections, saved = {}, source = 'config', deliveries = [];
  if (live) {
    try {
      const [rows, groups, settings] = await Promise.all([
        rest('cars?select=*&status=neq.hidden&order=sort_order.asc,created_at.desc'),
        rest('collections?select=*&visible=eq.true&order=sort_order.asc'),
        rest('settings?select=key,value'),
      ]);
      cars = rows.map(fromRow);
      collections = groups.map(({ slug, title, subtitle, cover }) => ({ slug, title, subtitle: subtitle || '', cover: cover || '' }));
      saved = Object.fromEntries(settings.map(({ key, value }) => [key, value]));
      source = 'supabase';
      // The deliveries gallery is optional: the site works without it.
      deliveries = await rest('deliveries?select=id,photo,caption,city&visible=eq.true&order=sort_order.asc,created_at.desc').catch(() => []);
    } catch (error) { console.error('Stock unavailable; showing the showcase models.', error); }
  } else if (previewing()) {
    const draft = stored.get('baba:admin-preview', null);
    if (draft) {
      cars = draft.cars.filter(row => row.status !== 'hidden').map(fromRow);
      collections = draft.collections.filter(row => row.visible).sort((a, b) => a.sort_order - b.sort_order).map(({ slug, title, subtitle, cover }) => ({ slug, title, subtitle: subtitle || '', cover: cover || '' }));
      saved = draft.settings || {};
      source = 'preview';
    }
  }
  const settings = merge(defaultSettings, saved);
  // Contact details set in the admin portal win over config.js.
  for (const [key, value] of Object.entries(settings.contact)) if (present(value) && key in dealer) dealer[key] = value;
  const previews = !cars.some(car => FOR_SALE.includes(car.status));
  if (previews) cars = [...showcase.map(fromShowcase), ...cars.filter(car => car.status === 'sold')];
  return { cars, collections, settings, previews, source, deliveries };
}

// Presentation.
const decimals = value => (Math.round(value * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const formatPrice = price => !numeric(price) ? '' : price >= 1e7 ? `₹${decimals(price / 1e7)} crore` : price >= 1e5 ? `₹${decimals(price / 1e5)} lakh` : currency.format(price);
export const formatPriceFull = price => numeric(price) ? currency.format(price) : '';
// The distance as the dealership writes it: "75,000", never with "km".
export const formatKm = km => formatDriven(km);
export const formatOwners = n => !numeric(n) ? '' : n === 0 ? 'Unregistered' : `${n}${['', 'st', 'nd', 'rd'][n] || 'th'} owner`;
export const carName = car => [car.make, car.model].filter(Boolean).join(' ');
export const carTitle = car => [car.make, car.model, car.variant].filter(Boolean).join(' ');
export const carURL = car => `/car/?id=${encodeURIComponent(car.slug)}`;
export const cover = car => car.photos[0] || '/vehicle-placeholder.svg';
export const priceBand = price => numeric(price) ? PRICE_BANDS.find(band => price >= band.min && price < band.max) : null;
export const isNew = (car, days) => car.status === 'available' && !car.preview && Boolean(car.createdAt) && Date.now() - Date.parse(car.createdAt) < days * 864e5;
// The facts on a card: "2021 · Driven 59,000 · Diesel · 1st owner". A sold
// car keeps only the basics.
export const facts = (car, listing = defaultSettings.listing) => car.status === 'sold'
  ? soldFacts(car, listing)
  : [car.year, drivenText(car.kilometres, listing), car.fuel, formatOwners(car.owners)].filter(present);
export const soldFacts = (car, listing = defaultSettings.listing) => (listing.soldFacts || LISTING_DEFAULTS.soldFacts).map(key => ({ year: car.year, fuel: car.fuel, body: car.body, driven: drivenText(car.kilometres, listing), owners: formatOwners(car.owners), colour: car.colour, transmission: car.transmission })[key]).filter(present);
// The badge a car wears on its card and page.
export function badge(car, settings) {
  if (car.preview) return { tone: 'preview', label: 'Collection preview' };
  if (car.status === 'available') return isNew(car, settings.listing.newDays) ? { tone: 'new', label: 'Just arrived' } : null;
  return { tone: car.status, label: STATUS[car.status] };
}
// Recommended order: the home page's picks first, then the dealer's order,
// then the newest.
export const recommended = (a, b) => (b.featured - a.featured) || (a.featured && b.featured ? a.featuredRank - b.featuredRank : 0) || (a.sortOrder - b.sortOrder) || (Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
