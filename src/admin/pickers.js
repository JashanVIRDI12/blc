// The portal's own controls in place of the browser's: the list a <select>
// opens, a calendar for dates, suggestions for typed fields, tooltips, and
// the messages a form shows when something is missing. The native elements
// stay in the page and keep their values, so the forms read them as before;
// only what the visitor sees and touches is the portal's. Installed once
// (main.js) and applied to every view as it is drawn.
import { icon } from './ui.js';

const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, className, html = '') => { const node = document.createElement(tag); node.className = className; node.innerHTML = html; return node; };
const fire = target => { target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); };

// ------------------------------------------------------------ the popover
// One floating panel at a time, under its control (or above it, if there is
// more room there), following it as the page scrolls.
let popover = null;
function float(anchor, panel, { onClose, focus } = {}) {
  closeFloat();
  panel.classList.add('a-pop');
  document.body.append(panel);
  const place = () => {
    if (!anchor.isConnected) { closeFloat(); return; }
    const box = anchor.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) { closeFloat(); return; }
    panel.style.minWidth = `${Math.round(box.width)}px`;
    const below = innerHeight - box.bottom - 16, above = box.top - 16;
    const up = panel.scrollHeight > below && above > below;
    panel.style.maxHeight = `${Math.max(150, Math.min(380, up ? above : below))}px`;
    panel.dataset.side = up ? 'top' : 'bottom';
    const left = Math.min(Math.max(8, box.left), innerWidth - panel.offsetWidth - 8);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(up ? box.top - 6 - panel.offsetHeight : box.bottom + 6)}px`;
  };
  place();
  requestAnimationFrame(() => panel.classList.add('is-open'));
  let frame = 0;
  const follow = event => { if (event.type === 'scroll' && panel.contains(event.target)) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
  const outside = event => { if (!panel.contains(event.target) && !anchor.contains(event.target)) closeFloat(); };
  addEventListener('scroll', follow, true); addEventListener('resize', follow);
  document.addEventListener('pointerdown', outside, true);
  popover = { panel, anchor, place, close() {
    removeEventListener('scroll', follow, true); removeEventListener('resize', follow);
    document.removeEventListener('pointerdown', outside, true);
    panel.classList.remove('is-open');
    setTimeout(() => panel.remove(), reduced() ? 0 : 160);
    onClose?.();
  } };
  focus?.();
  return popover;
}
export function closeFloat() { const open = popover; popover = null; open?.close(); }

// ------------------------------------------------------------- the select
// A <select> opens the portal's list rather than the browser's, on a
// computer; phones keep their own wheel, which is easier with a thumb. The
// list follows the keyboard: arrows, Home and End, Enter or Space to choose,
// Escape to close, and letters to jump.
function openSelect(select) {
  if (popover?.anchor === select) { closeFloat(); return; }
  const options = [...select.options];
  const toned = select.closest('.a-status');
  const panel = el('div', 'a-pop-list');
  panel.setAttribute('role', 'listbox');
  panel.innerHTML = options.map((option, i) => `<button type="button" role="option" class="a-pop-item" data-i="${i}" tabindex="-1"${option.disabled ? ' disabled' : ''} aria-selected="${i === select.selectedIndex}">${toned ? `<i class="a-pop-dot" style="--tone:var(--${option.value || 'hidden'})"></i>` : ''}<span></span>${icon.check}</button>`).join('');
  panel.querySelectorAll('span').forEach((span, i) => { span.textContent = options[i].textContent; });
  const items = [...panel.children];
  let active = Math.max(0, select.selectedIndex);
  const mark = (i, scroll = true) => {
    active = i;
    items.forEach((item, k) => item.classList.toggle('is-active', k === i));
    if (scroll) items[i]?.scrollIntoView({ block: 'nearest' });
  };
  const choose = i => {
    if (options[i]?.disabled) return;
    closeFloat();
    select.focus({ preventScroll: true });
    if (select.selectedIndex !== i) { select.selectedIndex = i; fire(select); }
  };
  panel.addEventListener('click', event => { const item = event.target.closest('[data-i]'); if (item) choose(Number(item.dataset.i)); });
  panel.addEventListener('pointermove', event => { const item = event.target.closest('[data-i]'); if (item && Number(item.dataset.i) !== active) mark(Number(item.dataset.i), false); });
  let typed = '', typing = 0;
  const keys = event => {
    const step = k => { let i = active; do { i += k; } while (options[i]?.disabled); if (options[i]) mark(i); };
    if (event.key === 'ArrowDown') step(1);
    else if (event.key === 'ArrowUp') step(-1);
    else if (event.key === 'Home') mark(options.findIndex(o => !o.disabled));
    else if (event.key === 'End') mark(options.findLastIndex(o => !o.disabled));
    else if (event.key === 'Enter' || event.key === ' ') choose(active);
    else if (event.key === 'Escape') closeFloat();
    else if (event.key === 'Tab') { closeFloat(); return; }
    else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      clearTimeout(typing); typed += event.key.toLowerCase(); typing = setTimeout(() => { typed = ''; }, 700);
      const i = options.findIndex(o => o.textContent.trim().toLowerCase().startsWith(typed));
      if (i > -1) mark(i);
    } else return;
    event.preventDefault(); event.stopPropagation();
  };
  select.setAttribute('aria-expanded', 'true');
  select.addEventListener('keydown', keys, true);
  float(select, panel, { onClose: () => { select.removeAttribute('aria-expanded'); select.removeEventListener('keydown', keys, true); } });
  mark(active);
}
const pickable = select => select instanceof HTMLSelectElement && !select.multiple && !select.disabled && !select.hasAttribute('data-native') && FINE.matches;

// --------------------------------------------------------------- the date
// A date field becomes a button that shows the date in words and opens a
// calendar; the field itself (hidden) keeps the value as the form reads it,
// YYYY-MM-DD, and the button follows it when code sets it.
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseISO = text => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const words = date => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

function enhanceDate(input) {
  if (input.dataset.picker) return;
  input.dataset.picker = 'date';
  const button = el('button', 'a-date');
  button.type = 'button';
  input.type = 'hidden';
  input.after(button);
  const show = () => {
    const date = parseISO(VALUE.get.call(input));
    button.innerHTML = `${icon.calendar}<span>${date ? words(date) : 'Choose a date'}</span>`;
    button.classList.toggle('is-empty', !date);
  };
  Object.defineProperty(input, 'value', { configurable: true, get() { return VALUE.get.call(this); }, set(value) { VALUE.set.call(this, value); show(); } });
  show();
  button.addEventListener('click', () => (popover?.anchor === button ? closeFloat() : openCalendar(input, button)));
  button.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); openCalendar(input, button); } });
}

function openCalendar(input, button) {
  const chosen = parseISO(input.value), today = new Date();
  let focus = chosen || new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const panel = el('div', 'a-pop-calendar');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Choose a date');
  const draw = (move = true) => {
    const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, k) => { const day = new Date(start); day.setDate(start.getDate() + k); return day; });
    panel.innerHTML = `<div class="a-cal-head"><button type="button" class="a-cal-step a-cal-step--year" data-shift="-12" aria-label="Previous year">${icon.left}${icon.left}</button><button type="button" class="a-cal-step" data-shift="-1" aria-label="Previous month">${icon.left}</button>
        <b>${focus.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
        <button type="button" class="a-cal-step" data-shift="1" aria-label="Next month">${icon.right}</button><button type="button" class="a-cal-step a-cal-step--year" data-shift="12" aria-label="Next year">${icon.right}${icon.right}</button></div>
      <div class="a-cal-grid" role="grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span class="a-cal-dow">${d}</span>`).join('')}${days.map(day => {
        const key = iso(day);
        return `<button type="button" class="a-cal-day${day.getMonth() !== focus.getMonth() ? ' is-out' : ''}${key === iso(today) ? ' is-today' : ''}${chosen && key === iso(chosen) ? ' is-chosen' : ''}" data-day="${key}" tabindex="${key === iso(focus) ? 0 : -1}" aria-label="${words(day)}">${day.getDate()}</button>`;
      }).join('')}</div>
      <div class="a-cal-foot"><button type="button" data-clear>Clear</button><button type="button" data-today>Today</button></div>`;
    if (move) panel.querySelector(`[data-day="${iso(focus)}"]`)?.focus({ preventScroll: true });
  };
  const choose = value => { closeFloat(); button.focus({ preventScroll: true }); if (input.value !== value) { input.value = value; fire(input); } };
  const shiftMonths = n => { const day = focus.getDate(); focus = new Date(focus.getFullYear(), focus.getMonth() + n, 1); focus.setDate(Math.min(day, new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate())); draw(false); popover?.place(); };
  panel.addEventListener('click', event => {
    const day = event.target.closest('[data-day]'), shift = event.target.closest('[data-shift]');
    if (day) choose(day.dataset.day);
    else if (shift) shiftMonths(Number(shift.dataset.shift));
    else if (event.target.closest('[data-clear]')) choose('');
    else if (event.target.closest('[data-today]')) choose(iso(today));
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeFloat(); button.focus(); return; }
    if (!event.target.matches('[data-day]')) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[event.key]) { focus = new Date(focus.getFullYear(), focus.getMonth(), focus.getDate() + moves[event.key]); draw(); }
    else if (event.key === 'PageUp' || event.key === 'PageDown') { shiftMonths(event.key === 'PageUp' ? -1 : 1); draw(); }
    else if (event.key === 'Enter' || event.key === ' ') choose(event.target.dataset.day);
    else return;
    event.preventDefault();
  });
  draw(false);
  button.setAttribute('aria-expanded', 'true');
  float(button, panel, { onClose: () => button.removeAttribute('aria-expanded'), focus: () => requestAnimationFrame(() => panel.querySelector('[tabindex="0"]')?.focus({ preventScroll: true })) });
}

// --------------------------------------------------------- the suggestions
// A field with a list of usual values (the makes, the stocks) offers them as
// you type, the ones that start with what you typed first.
function enhanceSuggest(input) {
  const list = document.getElementById(input.getAttribute('list'));
  if (!list) return;
  const values = [...list.options].map(option => option.value).filter(Boolean);
  input.removeAttribute('list');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-autocomplete', 'list');
  let items = [], active = -1;
  const show = () => {
    const query = input.value.trim().toLowerCase();
    const matches = values.filter(value => value.toLowerCase() !== query && value.toLowerCase().includes(query))
      .sort((a, b) => b.toLowerCase().startsWith(query) - a.toLowerCase().startsWith(query)).slice(0, 8);
    if (!matches.length) { if (popover?.anchor === input) closeFloat(); return; }
    const panel = popover?.anchor === input ? popover.panel : el('div', 'a-pop-list a-pop-list--suggest');
    panel.setAttribute('role', 'listbox');
    panel.innerHTML = matches.map((value, i) => `<button type="button" role="option" class="a-pop-item" data-i="${i}" tabindex="-1"><span></span></button>`).join('');
    panel.querySelectorAll('span').forEach((span, i) => {
      const at = matches[i].toLowerCase().indexOf(query);
      span.append(matches[i].slice(0, at)); const b = document.createElement('b'); b.textContent = matches[i].slice(at, at + query.length); span.append(b, matches[i].slice(at + query.length));
    });
    items = [...panel.children]; active = -1;
    panel.onpointerdown = event => event.preventDefault();
    panel.onclick = event => { const item = event.target.closest('[data-i]'); if (item) choose(matches[Number(item.dataset.i)]); };
    if (popover?.anchor === input) popover.place();
    else { input.setAttribute('aria-expanded', 'true'); float(input, panel, { onClose: () => input.removeAttribute('aria-expanded') }); }
    choose.matches = matches;
  };
  const choose = value => { input.value = value; closeFloat(); fire(input); };
  const mark = i => { active = i; items.forEach((item, k) => item.classList.toggle('is-active', k === i)); items[i]?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('focus', show);
  input.addEventListener('input', event => { if (event.isTrusted) show(); });
  input.addEventListener('blur', () => { if (popover?.anchor === input) closeFloat(); });
  input.addEventListener('keydown', event => {
    const open = popover?.anchor === input;
    if (event.key === 'ArrowDown') { if (!open) show(); else mark(Math.min(items.length - 1, active + 1)); }
    else if (event.key === 'ArrowUp' && open) mark(Math.max(0, active - 1));
    else if (event.key === 'Enter' && open && active > -1) choose(choose.matches[active]);
    else if (event.key === 'Escape' && open) closeFloat();
    else return;
    event.preventDefault();
  });
}

// ----------------------------------------------------------------- tooltips
// What an icon button does, in the portal's own label, shown when the
// pointer rests on it or the keyboard reaches it. A `title` moves here (and
// stays the button's name for screen readers).
const TIPPED = '[title], [data-tip], .a-icon-button[aria-label], .a-delivery-tool[aria-label]';
let tip = null, tipFor = null, tipTimer = 0;
function showTip(target) {
  if (target.hasAttribute('title')) {
    if (!target.getAttribute('aria-label') && !target.textContent.trim()) target.setAttribute('aria-label', target.title);
    target.dataset.tip = target.title; target.removeAttribute('title');
  }
  const text = target.dataset.tip || target.getAttribute('aria-label');
  if (!text || target.disabled) return;
  tip ??= el('div', 'a-tip');
  tip.setAttribute('role', 'tooltip');
  tip.textContent = text;
  document.body.append(tip);
  const box = target.getBoundingClientRect();
  const up = box.top > 44;
  tip.dataset.side = up ? 'top' : 'bottom';
  tip.style.left = `${Math.round(Math.min(Math.max(8, box.left + box.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8))}px`;
  tip.style.top = `${Math.round(up ? box.top - tip.offsetHeight - 8 : box.bottom + 8)}px`;
  requestAnimationFrame(() => tip?.classList.add('is-shown'));
  tipFor = target;
}
function hideTip() { clearTimeout(tipTimer); tipFor = null; if (tip) { tip.classList.remove('is-shown'); tip.remove(); } }

// --------------------------------------------------------------- the forms
// A field that is missing or wrong says so beneath itself, in the portal's
// words, instead of the browser's bubble; the first one is brought into view.
function messageFor(input) {
  const v = input.validity;
  if (v.valueMissing) return input.type === 'email' ? 'Enter your email address.' : input.type === 'password' ? 'Enter your password.' : 'This is needed.';
  if (v.typeMismatch && input.type === 'email') return 'That doesn’t look like an email address.';
  if (v.typeMismatch && input.type === 'url') return 'Enter a full web address, starting with https://';
  if (v.tooShort) return `Use at least ${input.minLength} characters.`;
  if (v.rangeUnderflow || v.rangeOverflow) return `Use a number from ${input.min || 0} to ${input.max}.`;
  return 'Check this.';
}
let focusing = false;
function showInvalid(input) {
  const field = input.closest('.a-field') || input.parentElement;
  let note = field.querySelector(':scope > .a-error');
  if (!note) { note = el('small', 'a-error'); note.setAttribute('role', 'alert'); field.append(note); }
  note.innerHTML = `${icon.alert}<span></span>`;
  note.lastChild.textContent = messageFor(input);
  input.setAttribute('aria-invalid', 'true');
  field.classList.add('is-invalid');
  if (!focusing) { focusing = true; queueMicrotask(() => { focusing = false; input.focus(); input.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }); }
}
function clearInvalid(input) {
  const field = input.closest('.is-invalid');
  if (!field || !input.validity?.valid) return;
  input.removeAttribute('aria-invalid');
  field.classList.remove('is-invalid');
  field.querySelector(':scope > .a-error')?.remove();
}

// ------------------------------------------------------------- installing
function enhance(root) {
  root.querySelectorAll?.('input[type=date]').forEach(enhanceDate);
  root.querySelectorAll?.('input[list]').forEach(enhanceSuggest);
}
export function installPickers() {
  document.addEventListener('mousedown', event => {
    const select = event.target.closest?.('select');
    if (!pickable(select) || event.button !== 0) return;
    event.preventDefault();
    select.focus({ preventScroll: true });
    openSelect(select);
  }, true);
  document.addEventListener('keydown', event => {
    const select = event.target;
    if (!pickable(select) || popover?.anchor === select) return;
    if ([' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(event.key) && !event.metaKey && !event.ctrlKey) { event.preventDefault(); openSelect(select); }
  }, true);
  document.addEventListener('invalid', event => { event.preventDefault(); showInvalid(event.target); }, true);
  document.addEventListener('input', event => clearInvalid(event.target), true);
  document.addEventListener('pointerover', event => {
    if (!FINE.matches) return;
    const target = event.target.closest?.(TIPPED);
    if (target === tipFor) return;
    hideTip();
    if (target) tipTimer = setTimeout(() => showTip(target), 380);
  });
  document.addEventListener('focusin', event => { const target = event.target.closest?.(TIPPED); hideTip(); if (target?.matches(':focus-visible')) showTip(target); });
  ['pointerdown', 'scroll', 'focusout'].forEach(type => addEventListener(type, hideTip, true));
  addEventListener('hashchange', closeFloat);
  enhance(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) { enhance(node); if (node.matches?.('input[type=date], input[list]')) enhance(node.parentElement); } }))).observe(document.body, { childList: true, subtree: true });
}
