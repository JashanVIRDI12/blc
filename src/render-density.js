// How many pixels the 3D stages draw per CSS pixel. Clarity first:
// - never less than the screen's own density, up to 2x (MSAA stays on);
// - desktop screens below 2x are supersampled towards 2x, within a pixel
//   budget (a 1440 x 920 Retina frame), so a 1x monitor gets smooth edges
//   and fine detail rather than MSAA alone;
// - a device that cannot keep up steps down, one way and for good, so the
//   picture never pumps between sharp and soft. Only sustained slowness
//   counts: the warm-up frames, while textures upload, are skipped, and the
//   density never falls below 1.5x (or the screen's own, if lower). Windows
//   are short enough that a device which cannot keep up adapts within a
//   second or two of scrolling, not after twenty seconds of judder; a fast
//   one never steps at all.
const BUDGET = 2880 * 1840;
const WARM_UP = 40, WINDOW = 50, SLOW_MS = 26, STEP = .25;

export function createRenderDensity({ mobile }) {
  let stepped = 0, frames = 0, samples = 0, total = 0, last = 0;
  const native = () => Math.min(devicePixelRatio || 1, 2);
  const target = (width, height) => mobile ? native() : Math.max(native(), Math.min(2, Math.sqrt(BUDGET / Math.max(1, width * height))));
  const floor = (width, height) => Math.min(target(width, height), Math.max(native(), 1.5));
  return {
    // The density for a width x height (CSS pixels) canvas.
    ratio: (width, height) => Math.max(floor(width, height), target(width, height) - stepped),
    // Count a drawn frame. True once per window of continuous frames that
    // averaged too slow.
    slow(now) {
      const gap = last ? now - last : 0;
      last = now;
      if (++frames <= WARM_UP || !gap || gap >= 110) return false;
      samples++; total += gap;
      if (samples < WINDOW) return false;
      const slow = total / samples > SLOW_MS;
      samples = total = 0;
      return slow;
    },
    // Step down once; false if already at the floor.
    step(width, height) {
      const before = this.ratio(width, height);
      stepped += STEP;
      return this.ratio(width, height) < before;
    },
  };
}
