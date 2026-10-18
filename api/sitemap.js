// The sitemap (/sitemap.xml, rewritten to this function in vercel.json): the
// site's pages and every car on it, read from the database when asked for,
// so a car added in the admin is listed without a new deploy. Each car
// carries its first photograph, for image search. Without the database it
// lists the pages alone.
const SITE = 'https://www.babaluxurycar.com';
const PAGES = ['/', '/collection/', '/sell/', '/concierge/', '/consultation/', '/about/', '/privacy/', '/terms/', '/booking-policy/', '/delivery-policy/', '/test-drive-policy/', '/rc-transfer-policy/'];

const xml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); };

export async function readCars(env = process.env, fetcher = fetch) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const response = await fetcher(`${url}/rest/v1/cars?select=slug,id,photos,updated_at,created_at&status=neq.hidden&order=sort_order.asc,created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    return response.ok ? await response.json() : [];
  } catch { return []; }
}

export function sitemap(cars, today = new Date().toISOString().slice(0, 10)) {
  const entry = (loc, lastmod, image) => `  <url>\n    <loc>${xml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}${image ? `    <image:image><image:loc>${xml(image)}</image:loc></image:image>\n` : ''}  </url>`;
  const newest = cars.map(car => day(car.updated_at || car.created_at)).filter(Boolean).sort().at(-1) || today;
  const pages = PAGES.map(path => entry(`${SITE}${path}`, path === '/' || path === '/collection/' ? newest : ''));
  const listed = cars.map(car => {
    const photo = Array.isArray(car.photos) ? car.photos.find(src => /^https?:\/\//.test(src) || src?.startsWith('/')) : '';
    return entry(`${SITE}/car/?id=${encodeURIComponent(car.slug || car.id)}`, day(car.updated_at || car.created_at), photo ? new URL(photo, SITE).href : '');
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...pages, ...listed].join('\n')}\n</urlset>\n`;
}

export default async function handler(request, response) {
  const body = sitemap(await readCars());
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Search engines read it a few times a day at most: an hour at the edge.
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  response.status(200).send(body);
}
