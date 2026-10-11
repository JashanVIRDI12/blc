// The pointer, as a jeweller's loupe: a gold point with a ring that trails it
// a beat behind. Over a link or button the ring opens around it; over
// anything that can be handled ([data-cursor], the 3D stages, the keys, the
// photographs) it fills with gold and names the gesture: Drag, Hold, Open.
// Buttons marked as actions are magnetic (after React Bits' Magnet): they
// lean towards the pointer as it nears and spring back when it leaves.
//
// Fine pointers only. The browser's own cursor returns over text fields, in
// dialogs and in the photo lightbox (both drawn above the page, where the
// loupe cannot follow), and with reduced motion the loupe is never made.
import gsap from 'gsap';

const MAGNETIC = '.solid-button, .outline-button, .enquire-link, .consult-cta, .fleet-button, [data-magnetic]';
const NATIVE = 'input, textarea, select, [contenteditable], dialog, .pswp';

export function setupCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'loupe';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i class="loupe-ring"><b class="loupe-label"></b></i><i class="loupe-dot"></i>';
  document.body.append(cursor);
  const ring = cursor.querySelector('.loupe-ring'), dot = cursor.querySelector('.loupe-dot'), label = cursor.querySelector('.loupe-label');

  // The point follows at once; the ring a beat behind, like a lens on a chain.
  const dotX = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3.out' }), dotY = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: .5, ease: 'power3.out' }), ringY = gsap.quickTo(ring, 'y', { duration: .5, ease: 'power3.out' });
  let shown = false, mode = '', word = '';

  const setMode = (next, text = '') => {
    if (next === mode && text === word) return;
    mode = next; word = text;
    cursor.dataset.mode = next;
    if (text) label.textContent = text;
  };
  const onMove = event => {
    const { clientX: x, clientY: y, target } = event;
    if (!shown) { shown = true; gsap.set([dot, ring], { x, y }); cursor.classList.add('is-on'); }
    dotX(x); dotY(y); ringX(x); ringY(y);
    const native = target.closest?.(NATIVE);
    root.classList.toggle('loupe-native', !!native);
    if (native) { setMode('native'); return; }
    const handle = target.closest?.('[data-cursor]');
    if (handle && handle.dataset.cursor) { setMode('label', handle.dataset.cursor); return; }
    if (target.closest?.('a[href], button, summary, label, [role="button"], [role="tab"]')) { setMode('link'); return; }
    setMode('');
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', () => cursor.classList.add('is-down'), { passive: true });
  addEventListener('pointerup', () => cursor.classList.remove('is-down'), { passive: true });
  document.addEventListener('pointerleave', () => { cursor.classList.remove('is-on'); shown = false; });
  // A stage can name its gesture as it changes (the keys only while the
  // pointer is over them).
  document.addEventListener('loupe:refresh', event => { if (event.detail) onMove(event.detail); });
  root.classList.add('has-loupe');
}

// Magnetic actions, on their own: they lean towards the pointer whichever
// cursor is showing.
export function setupMagnetic() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Magnetic actions: the button follows the pointer by a third of the way
  // from its centre, its label by a little more, so it seems to have depth.
  const innerOf = element => element.querySelector(':scope > span, :scope > i');
  let current = null;
  const release = element => {
    const spring = { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, .32)', overwrite: true };
    gsap.to(element, spring);
    const inner = innerOf(element);
    if (inner) gsap.to(inner, spring);
  };
  addEventListener('pointermove', event => {
    const element = event.target.closest?.(MAGNETIC);
    if (current && current !== element) { release(current); current = null; }
    if (!element || element.disabled) return;
    current = element;
    const box = element.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2), dy = event.clientY - (box.top + box.height / 2);
    const follow = { duration: .6, ease: 'power3.out', overwrite: true };
    gsap.to(element, { x: dx * .32, y: dy * .42, ...follow });
    const inner = innerOf(element);
    if (inner) gsap.to(inner, { x: dx * .14, y: dy * .18, ...follow });
  }, { passive: true });
}
