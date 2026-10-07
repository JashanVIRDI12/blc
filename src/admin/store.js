// Where the admin portal reads and writes. Connected, it is Supabase (rows,
// photo storage and sign-in). Not yet connected, it is a preview kept in this
// browser, so the portal can be tried before launch; /?preview shows that
// preview on the site, in this browser only.
import { live, supabase as config, fromRow, toRow, defaultSettings, fromShowcase } from '../data.js';
import { showcase, defaultCollections } from '../config.js';
import { stored } from '../util.js';

export const PREVIEW_KEY = 'baba:admin-preview';
const BUCKET = 'car-photos';
// camelCase fields the portal changes one at a time, as their columns.
const COLUMNS = { featuredRank: 'featured_rank', sortOrder: 'sort_order', plateTag: 'plate_tag', plateNumber: 'plate_number', insuranceUntil: 'insurance_until', hoverPhoto: 'hover_photo' };
// A photo's small copy, beside it (name.t.webp), for cards and thumbnails.
const thumbPath = path => path.replace(/\.webp$/, '.t.webp');
const toPatch = patch => Object.fromEntries(Object.entries(patch).map(([key, value]) => [COLUMNS[key] || key, value]));
const mergeSettings = saved => Object.fromEntries(Object.entries(defaultSettings).map(([key, value]) => [key, { ...value, ...(saved[key] || {}) }]));

export const createStore = () => live ? supabaseStore() : previewStore();

async function supabaseStore() {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'baba-admin-auth' } });
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const pathOf = url => { const marker = `/storage/v1/object/public/${BUCKET}/`; const i = String(url).indexOf(marker); return i < 0 ? '' : decodeURIComponent(String(url).slice(i + marker.length)); };
  return {
    mode: 'supabase',
    async session() { return check(await client.auth.getSession()).session; },
    onAuth(handler) { client.auth.onAuthStateChange((event, session) => handler(event, session)); },
    async signIn(email, password) { check(await client.auth.signInWithPassword({ email, password })); },
    async signOut() { await client.auth.signOut(); },
    async resetPassword(email) { check(await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/` })); },
    async updatePassword(password) { check(await client.auth.updateUser({ password })); },
    async isAdmin() { return check(await client.rpc('is_admin')) === true; },
    async listCars() { return check(await client.from('cars').select('*').order('created_at', { ascending: false })).map(fromRow); },
    async saveCar(car) { return fromRow(check(await client.from('cars').upsert(toRow(car)).select().single())); },
    async patchCar(id, patch) { return fromRow(check(await client.from('cars').update(toPatch(patch)).eq('id', id).select().single())); },
    async deleteCar(car, others) {
      check(await client.from('cars').delete().eq('id', car.id));
      // Photos no other car uses go with it.
      const shared = new Set(others.flatMap(other => other.photos));
      const paths = car.photos.filter(url => !shared.has(url)).map(pathOf).filter(Boolean);
      if (paths.length) await client.storage.from(BUCKET).remove(paths);
    },
    async listCollections() { return check(await client.from('collections').select('*').order('sort_order')); },
    async saveCollection(row) { return check(await client.from('collections').upsert(row).select().single()); },
    async deleteCollection(slug) { check(await client.from('collections').delete().eq('slug', slug)); },
    async getSettings() { return mergeSettings(Object.fromEntries(check(await client.from('settings').select('key,value')).map(({ key, value }) => [key, value]))); },
    async saveSettings(key, value) { check(await client.from('settings').upsert({ key, value })); },
    async uploadPhoto(blob, carId, thumb = null, folder = 'cars') {
      const path = `${folder}/${carId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${blob.type === 'image/jpeg' ? 'jpg' : 'webp'}`;
      check(await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
      if (thumb && blob.type === 'image/webp') await client.storage.from(BUCKET).upload(thumbPath(path), thumb, { contentType: thumb.type, cacheControl: '31536000', upsert: false }).catch(() => {});
      return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async removePhotos(urls) { const paths = urls.map(pathOf).filter(Boolean).flatMap(path => /\.webp$/.test(path) ? [path, thumbPath(path)] : [path]); if (paths.length) await client.storage.from(BUCKET).remove(paths); },
    // What only the dealership sees: the full registration, the stock it
    // belongs to, notes.
    async listPrivate() { return Object.fromEntries(check(await client.from('car_private').select('*')).map(row => [row.car_id, row])); },
    async savePrivate(row) { return check(await client.from('car_private').upsert({ ...row, updated_at: new Date().toISOString() }).select().single()); },
    // The inbox.
    async listEnquiries() { return check(await client.from('enquiries').select('*').order('created_at', { ascending: false }).limit(1000)); },
    async countNewEnquiries() { const { count, error } = await client.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'); if (error) throw new Error(error.message); return count || 0; },
    async patchEnquiry(id, patch) { return check(await client.from('enquiries').update(patch).eq('id', id).select().single()); },
    async deleteEnquiry(id) { check(await client.from('enquiries').delete().eq('id', id)); },
    // The deliveries gallery.
    async listDeliveries() { return check(await client.from('deliveries').select('*').order('sort_order').order('created_at', { ascending: false })); },
    async saveDelivery(row) { return check(await client.from('deliveries').upsert(row).select().single()); },
    async deleteDelivery(row) { check(await client.from('deliveries').delete().eq('id', row.id)); await this.removePhotos([row.photo]).catch(() => {}); },
  };
}

// The preview: the same rows as the database, kept in this browser.
function previewStore() {
  const seed = () => ({
    cars: showcase.map(fromShowcase).map(car => ({ ...toRow({ ...car, status: 'available' }), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
    collections: defaultCollections.map((group, i) => ({ ...group, cover: null, sort_order: i + 1, visible: true })),
    settings: {}, private: {}, enquiries: [], deliveries: [],
  });
  let db = stored.get(PREVIEW_KEY, null) || seed();
  db.private ??= {}; db.enquiries ??= []; db.deliveries ??= [];
  const save = () => {
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(db)); }
    catch { throw new Error('This browser’s storage is full. In preview mode photos are kept in the browser; remove a few, or connect Supabase.'); }
  };
  save();
  const now = () => new Date().toISOString();
  const wait = () => new Promise(resolve => setTimeout(resolve, 120));
  return {
    mode: 'preview',
    async session() { return { user: { email: 'Preview mode' } }; },
    onAuth() {},
    async signIn() {}, async signOut() {}, async resetPassword() {}, async updatePassword() {},
    async isAdmin() { return true; },
    async listCars() { return db.cars.map(fromRow).sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)); },
    async saveCar(car) {
      await wait();
      const old = db.cars.find(row => row.id === car.id);
      const row = { ...toRow(car), created_at: old?.created_at || now(), updated_at: now(), sold_at: car.status === 'sold' ? (old?.sold_at || now()) : null };
      if (db.cars.some(other => other.slug === row.slug && other.id !== row.id)) throw new Error('Another car already uses this web address.');
      db.cars = old ? db.cars.map(other => other.id === car.id ? row : other) : [row, ...db.cars];
      save();
      return fromRow(row);
    },
    async patchCar(id, patch) {
      const old = db.cars.find(row => row.id === id);
      const row = { ...old, ...toPatch(patch), updated_at: now() };
      if (patch.status) row.sold_at = patch.status === 'sold' ? (old.sold_at || now()) : null;
      db.cars = db.cars.map(other => other.id === id ? row : other);
      save();
      return fromRow(row);
    },
    async deleteCar(car) { db.cars = db.cars.filter(row => row.id !== car.id); save(); },
    async listCollections() { return [...db.collections].sort((a, b) => a.sort_order - b.sort_order); },
    async saveCollection(row) { db.collections = [...db.collections.filter(other => other.slug !== row.slug), row]; save(); return row; },
    async deleteCollection(slug) { db.collections = db.collections.filter(row => row.slug !== slug); save(); },
    async getSettings() { return mergeSettings(db.settings); },
    async saveSettings(key, value) { db.settings[key] = value; save(); },
    async uploadPhoto(blob) {
      await wait();
      return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    },
    async removePhotos() {},
    async listPrivate() { return { ...db.private }; },
    async savePrivate(row) { db.private[row.car_id] = { ...row, updated_at: now() }; save(); return db.private[row.car_id]; },
    async listEnquiries() { return [...db.enquiries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)); },
    async countNewEnquiries() { return db.enquiries.filter(row => row.status === 'new').length; },
    async patchEnquiry(id, patch) { db.enquiries = db.enquiries.map(row => row.id === id ? { ...row, ...patch } : row); save(); return db.enquiries.find(row => row.id === id); },
    async deleteEnquiry(id) { db.enquiries = db.enquiries.filter(row => row.id !== id); save(); },
    async listDeliveries() { return [...db.deliveries].sort((a, b) => a.sort_order - b.sort_order); },
    async saveDelivery(row) { const next = { created_at: now(), ...row }; db.deliveries = [...db.deliveries.filter(other => other.id !== row.id), next]; save(); return next; },
    async deleteDelivery(row) { db.deliveries = db.deliveries.filter(other => other.id !== row.id); save(); },
    reset() { db = seed(); save(); },
  };
}
