// A sideways drag that turns something inside a page that scrolls
// vertically. A touch decides on its first few pixels of movement: mostly
// sideways turns, anything else is left to the page. Once turning, the page
// is held still for the rest of the gesture, since iOS otherwise hands a
// sideways gesture over to scrolling as soon as it drifts vertically. This is
// the approach of Google's <model-viewer> (SmoothControls.touchModeRotate).
// A released flick keeps turning and slows to rest.
//
// enabled(): whether a gesture may start now.
// onStart(event): called once a gesture is decided as a turn; returns the
//   context handed to onTurn, or false to ignore the gesture.
// onTurn(dx, context): sideways movement in CSS pixels, during the drag and
//   the flick that follows it.
// onEnd(context): the drag and its flick are over.
const DECIDE = 6; // px before a touch is read as sideways or vertical
const FRICTION = .32; // seconds for a flick to lose two thirds of its speed

export function createTurnGesture(element, { enabled, onStart, onTurn, onEnd }) {
  let pointer = null, flick = 0, coasting = null;
  element.style.touchAction = 'pan-y';
  const holdPage = event => { if (pointer?.turning) event.preventDefault(); };
  element.addEventListener('touchmove', holdPage, { passive: false });

  function stopFlick() {
    if (!flick) return;
    cancelAnimationFrame(flick); flick = 0;
    const context = coasting; coasting = null; onEnd(context);
  }
  function down(event) {
    if (pointer || !event.isPrimary || event.button > 0 || !enabled()) return;
    stopFlick();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, turning: false, context: null, samples: [] };
  }
  function move(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.turning) {
      if (Math.hypot(dx, dy) < DECIDE) return;
      const context = Math.abs(dx) > Math.abs(dy) && enabled() ? onStart(event) : false;
      if (context === false) { pointer = null; return; }
      pointer.turning = true; pointer.context = context;
      element.setPointerCapture?.(event.pointerId);
      element.classList.add('is-turning');
    }
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.samples.push([performance.now(), dx]);
    if (pointer.samples.length > 6) pointer.samples.shift();
    onTurn(dx, pointer.context);
  }
  function up(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const { turning, context, samples } = pointer;
    pointer = null;
    element.classList.remove('is-turning');
    if (!turning) return;
    // Release speed over the last ~80 ms of movement.
    const now = performance.now(), recent = samples.filter(([t]) => now - t < 80);
    const span = recent.length > 1 ? (recent.at(-1)[0] - recent[0][0]) / 1000 : 0;
    let speed = span > 0 ? recent.slice(1).reduce((sum, [, d]) => sum + d, 0) / span : 0;
    if (event.type === 'pointercancel' || Math.abs(speed) < 40) { onEnd(context); return; }
    let last = now;
    const coast = time => {
      const dt = Math.min(.05, (time - last) / 1000); last = time;
      speed *= Math.exp(-dt / FRICTION);
      if (!enabled() || Math.abs(speed) < 12) { flick = 0; coasting = null; onEnd(context); return; }
      onTurn(speed * dt, context);
      flick = requestAnimationFrame(coast);
    };
    coasting = context;
    flick = requestAnimationFrame(coast);
  }
  element.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  return {
    get active() { return Boolean(pointer?.turning || flick); },
    stop() {
      const { turning, context } = pointer ?? {};
      pointer = null; element.classList.remove('is-turning');
      if (turning) onEnd(context);
      stopFlick();
    },
    dispose() {
      cancelAnimationFrame(flick); flick = 0; pointer = null;
      element.removeEventListener('touchmove', holdPage);
      element.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    },
  };
}
