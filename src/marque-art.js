// Drawing the marques (src/marques.js): a vector mark or an ink mask, and
// each sized to the same visual weight.

export const marqueArt = marque => marque.path
  ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${marque.path}"/></svg>`
  : `<i class="marque-mask" style="--mask:url('${marque.mask}')" data-ratio="${marque.ratio}" aria-hidden="true"></i>`;

// Each mark at the same visual weight: a wide wordmark gets more width and
// less height than a round badge, so all hold about the same area of ink.
// Vector marks are first cropped to their own drawing. `base` is the height
// of a square mark, in pixels; elements carry `data-scale` to enlarge the
// delicate marks.
export function sizeMarques(root, base, selector = '.marque') {
  root.querySelectorAll(selector).forEach(element => {
    let ratio = Number(element.querySelector('[data-ratio]')?.dataset.ratio) || 1;
    const svg = element.querySelector('svg');
    if (svg) {
      const box = svg.querySelector('path').getBBox();
      if (box.width && box.height) { svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`); ratio = box.width / box.height; }
    }
    // Height falls off gently with width, so wings and wordmarks stay legible.
    const scale = Number(element.dataset.scale) || 1;
    const height = Math.min(base * 1.04, base * ratio ** -.3) * scale, width = Math.min(base * 3.8 * scale, height * ratio);
    element.style.setProperty('--w', `${width.toFixed(1)}px`);
    element.style.setProperty('--h', `${(width / ratio).toFixed(1)}px`);
  });
}
