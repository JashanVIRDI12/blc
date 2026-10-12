// Work for the stages further down the page (cars parsed and dressed, shaders
// compiled, textures and geometry sent to the GPU) is done in turns, so it is
// never felt in what the visitor is watching. It imports nothing.
//
// A stage calls stir() for every frame it draws because the visitor is
// scrolling it or its intro is playing; wheel, touch, key and scroll count as
// well. Background work then takes its steps through breath() and lull().
let stirred = 0;
export const stir = () => { stirred = performance.now(); };
// Nothing has moved for `ms`.
export const calm = (ms = 150) => performance.now() - stirred >= ms;
for (const type of ['wheel', 'touchmove', 'keydown', 'scroll']) addEventListener(type, stir, { passive: true, capture: true });

// After the next frame has been drawn, in the time it leaves over. A hidden
// tab draws no frames: there the step is taken regardless.
const afterFrame = () => new Promise(resolve => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => setTimeout(go));
  setTimeout(go, 250);
});

// Before a small step (a few milliseconds): one per frame, moving or still.
export const breath = afterFrame;

// Before a heavy step (a car dressed, a large texture sent, shaders built):
// once nothing has moved for `still` ms. A visitor who never stops scrolling
// is not kept waiting for the next stage: after `patience` ms it goes ahead.
export async function lull(patience = 400, still = 150) {
  const began = performance.now();
  while (!calm(still) && performance.now() - began < patience) await new Promise(resolve => setTimeout(resolve, 40));
  await afterFrame();
}
