export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const safeURL = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
// Image sources may also be inline pictures, which the admin's preview mode
// stores in place of uploads.
export const safeImage = value => /^data:image\/(webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(value ?? '') ? value : safeURL(value);
// Photos in the car-photos bucket have a small copy beside them
// (name.t.webp) for cards and thumbnails; anything else is used as it is.
export const thumbImage = value => {
  const url = safeImage(value);
  return /\/storage\/v1\/object\/public\/car-photos\/.+(?<!\.t)\.webp$/.test(url || '') ? url.replace(/\.webp$/, '.t.webp') : url;
};
export const present = value => value !== null && value !== undefined && value !== '';
export const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const slugify = value => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Browser storage can be missing or refuse (private windows, blocked site
// data); it only ever holds conveniences such as the shortlist.
export const stored = {
  get(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};
