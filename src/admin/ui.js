// Small pieces the admin portal is built from: escaped templates, toasts
// with undo, a confirm dialog, and photo compression before upload.
export { escapeHTML as esc } from '../util.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// A toast says what just happened; "Undo" puts it back.
export function toast(message, { tone = 'ok', action, onAction, duration = 5200 } = {}) {
  const holder = $('#toasts');
  const item = document.createElement('div');
  item.className = `toast toast--${tone}`;
  item.innerHTML = `<span></span>`;
  item.firstChild.textContent = message;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action;
    button.addEventListener('click', () => { onAction?.(); close(); });
    item.append(button);
  }
  holder.append(item);
  const close = () => { item.classList.add('is-leaving'); setTimeout(() => item.remove(), 300); };
  setTimeout(close, tone === 'error' ? 9000 : duration);
}
export const fail = error => { console.error(error); toast(error?.message || 'Something went wrong. Please try again.', { tone: 'error' }); };

// A promise-returning confirm, in the portal's own dialog.
export function confirmDialog({ title, body = '', confirm = 'Confirm', cancel = 'Cancel', danger = false, extra }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'a-dialog a-confirm';
    dialog.innerHTML = `<h2></h2><p></p><div class="a-dialog-actions">${extra ? '<button type="button" class="a-button" data-extra></button>' : ''}<button type="button" class="a-button a-button--ghost" data-cancel></button><button type="button" class="a-button ${danger ? 'a-button--danger' : 'a-button--primary'}" data-ok></button></div>`;
    $('h2', dialog).textContent = title;
    $('p', dialog).textContent = body;
    $('[data-cancel]', dialog).textContent = cancel;
    $('[data-ok]', dialog).textContent = confirm;
    let answer = false;
    if (extra) { $('[data-extra]', dialog).textContent = extra; $('[data-extra]', dialog).addEventListener('click', () => { answer = 'extra'; dialog.close(); }); }
    $('[data-cancel]', dialog).addEventListener('click', () => dialog.close());
    $('[data-ok]', dialog).addEventListener('click', () => { answer = true; dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(answer); });
    document.body.append(dialog);
    dialog.showModal();
    $('[data-ok]', dialog).focus();
  });
}

// A button shows it is working while its task runs.
export async function busy(button, task) {
  const label = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-busy');
  try { return await task(); }
  finally { button.disabled = false; button.classList.remove('is-busy'); button.innerHTML = label; }
}

// Photos are resized and re-encoded in the browser before upload: a phone's
// 6 MB picture becomes a sharp ~300 KB WebP, so pages stay quick.
export async function compressImage(file, { max = 2000, quality = .85 } = {}) {
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`${file.name} couldn’t be read. Try a JPG or PNG.`); }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  // Safari before 17 cannot encode WebP and falls back to PNG; use JPEG there.
  if (blob?.type === 'image/webp') return blob;
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Indian prices typed the way people say them: "1.25 cr", "78 lakh", "7800000".
export function parsePrice(text) {
  const value = String(text ?? '').toLowerCase().replace(/[₹,\s]/g, '');
  if (!value) return null;
  const number = parseFloat(value);
  if (!Number.isFinite(number) || number < 0) return NaN;
  if (/(cr|crore)/.test(value)) return Math.round(number * 1e7);
  if (/(l|lakh|lac)/.test(value)) return Math.round(number * 1e5);
  if (/k$/.test(value)) return Math.round(number * 1e3);
  return Math.round(number);
}

export const icon = {
  car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15.5V12l2.2-4.6A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.1L21 12v3.5a1 1 0 0 1-1 1h-1.2M5.2 16.5H4a1 1 0 0 1-1-1M8.8 16.5h6.4M3.5 12h17"/><circle cx="7" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/></svg>',
  stack: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/></svg>',
  cog: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/><circle cx="12" cy="17" r="1.2"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 13.5 6 5.5h12l2.5 8V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13.5h5l1 2.5h5l1-2.5h5"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="13" height="13" rx="1.5"/><path d="M19.5 7.5V20H7"/><path d="m3.5 14 3.5-3.5 3 3 2-2 3.5 3.5"/></svg>',
  wand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 11-11"/><path d="m13.5 7.5 3 3"/><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M10 3v2M9 4h2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.2 6.2l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.6 18.5 5.5 13.4 5 5.1a1.5 1.5 0 0 1 1.5-1.6z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A7.8 7.8 0 1 1 8.4 18.6z"/><path d="M9 9.5c.3 2.4 2.6 4.8 5.2 5.2l1-1.2-1.6-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-1.6z"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>',
  rows: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="5" rx="1"/><rect x="4" y="14" width="16" height="5" rx="1"/></svg>',
  plate: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M6 10v4M9 10h3M9 12h2.5M9 14h3M15 10h3v4h-3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
};

// "just now", "5 min ago", "yesterday", "3 Oct".
export function timeAgo(value) {
  const then = new Date(value), seconds = (Date.now() - then) / 1000;
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 172800) return 'yesterday';
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: then.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

// Copies text, falling back to a prompt where the clipboard is refused.
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { window.prompt('Copy this:', text); return false; }
}

// Saves rows as a CSV file Excel and Google Sheets open directly.
export function downloadCSV(name, rows) {
  const cell = value => { const text = value === null || value === undefined ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Indian rupees, short: ₹68 lakh, ₹1.2 crore, ₹14.3 crore in stock.
export const rupees = value => !Number.isFinite(value) || value <= 0 ? '₹0' : value >= 1e7 ? `₹${(value / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} crore` : `₹${(value / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh`;
