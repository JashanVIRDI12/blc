// Counts for the admin's Insights (src/track.js sends them here): one row
// in public.events per page seen, car looked at, or tap to call, WhatsApp,
// get directions or shortlist. What the browser sends is checked against a
// short list; the host adds the city, region and country it reads for the
// request. Nothing that identifies the visitor is stored: not the IP
// address, not the browser. Search engines' and link previews' visits are
// not counted.
const KINDS = new Set(['view', 'car_view', 'whatsapp', 'call', 'directions', 'shortlist']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse|headless|pingdom|uptime/i;

const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const header = (request, name) => { const value = request.headers[name]; if (!value) return null; try { return decodeURIComponent(value); } catch { return value; } };

// The row to store, or null if the request is not one to count.
export function eventRow(body, request) {
  if (BOTS.test(request.headers['user-agent'] || '')) return null;
  let data = body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return null; } }
  if (!data || !KINDS.has(data.kind)) return null;
  const source = text(data.source, 80);
  return {
    kind: data.kind,
    car_id: UUID.test(data.car || '') ? data.car : null,
    path: text(data.path, 200)?.split('?')[0] || null,
    source: source && /^[a-z0-9.-]+$/i.test(source) ? source.toLowerCase() : null,
    device: DEVICES.has(data.device) ? data.device : null,
    city: text(header(request, 'x-vercel-ip-city'), 80),
    region: text(header(request, 'x-vercel-ip-country-region'), 80),
    country: text(header(request, 'x-vercel-ip-country'), 2),
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.status(405).end(); return; }
  const row = eventRow(request.body, request);
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (row && url && key) {
    await fetch(`${url}/rest/v1/events`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    }).catch(() => {});
  }
  // The visitor's page never waits on, or hears about, the count.
  response.status(204).end();
}
