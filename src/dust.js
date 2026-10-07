// Dust in the studio air, either side of the cars: two light canvases, one
// between the title and the cars and one in front of them, so the motes
// pass behind and before the cars as real ones would. They drift on slow
// currents and rise a little in the warmth of the lights; nearer ones are
// larger, softer and quicker past the eye, and each brightens and dims as it
// turns through the light. Pale motes show against the cars and the ink of
// the title; warm ones against the white. Runs only while on screen.
const SPRITE = 64;
function sprite(rgb, softness) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext('2d'), r = SPRITE / 2;
  const gradient = g.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(softness, `rgba(${rgb},.55)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gradient; g.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

export function createDust(stage, { scene }) {
  const back = document.createElement('canvas'), front = document.createElement('canvas');
  back.className = 'fleet-dust fleet-dust--back'; front.className = 'fleet-dust fleet-dust--front';
  [back, front].forEach(canvas => canvas.setAttribute('aria-hidden', 'true'));
  scene.before(back); scene.after(front);
  const sprites = { light: sprite('255,248,234', .32), warm: sprite('122,94,60', .3), lightSoft: sprite('255,244,224', .12), warmSoft: sprite('150,118,80', .1) };
  const layers = [{ canvas: back, g: back.getContext('2d'), motes: [] }, { canvas: front, g: front.getContext('2d'), motes: [] }];
  const pointer = { x: 0, y: 0 };
  let width = 1, height = 1, ratio = 1, raf = 0, last = 0, visible = false, running = false;

  const random = (a, b) => a + Math.random() * (b - a);
  // Depth 0 is deep behind the cars, 1 at the lens.
  const mote = near => {
    const depth = near ? random(.72, 1) : random(0, .62);
    return {
      x: Math.random(), y: Math.random(), depth, seed: random(0, 1000),
      size: near ? random(3.2, 8.5) : random(1.1, 2.6) * (.7 + depth),
      tone: Math.random() < .45 ? 'light' : 'warm',
      strength: near ? random(.22, .42) : random(.4, .9),
      twinkle: random(.12, .35), phase: random(0, Math.PI * 2),
    };
  };
  function populate() {
    const area = width * height;
    layers[0].motes = Array.from({ length: Math.round(Math.min(220, area / 6200)) }, () => mote(false));
    layers[1].motes = Array.from({ length: Math.round(Math.min(30, area / 44000)) }, () => mote(true));
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    // Soft motes need no retina pixels: a quarter of the fill on a 2x screen.
    ratio = Math.min(devicePixelRatio || 1, 1.25);
    for (const { canvas, g } of layers) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); g.setTransform(ratio, 0, 0, ratio, 0, 0); }
    populate();
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    const t = now / 1000, dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    layers.forEach(({ g, motes }, index) => {
      g.clearRect(0, 0, width, height);
      for (const m of motes) {
        const pace = .35 + m.depth * 1.1;
        // Slow, wandering currents: two incommensurate swirls per mote.
        m.x += (Math.sin(t * .11 + m.seed) * .0045 + Math.sin(t * .29 + m.seed * 1.7) * .0028) * pace * dt;
        m.y += (-.0042 + Math.cos(t * .17 + m.seed * 2.3) * .0035) * pace * dt;
        if (m.y < -.04) { m.y = 1.04; m.x = Math.random(); }
        if (m.x < -.04) m.x = 1.04; else if (m.x > 1.04) m.x = -.04;
        const glint = .5 + .5 * Math.sin(t * m.twinkle + m.phase);
        // A slow, gentle shimmer: never a blink.
        const alpha = m.strength * (.72 + .28 * glint);
        const shift = (m.depth - .55) * 26;
        const x = m.x * width - pointer.x * shift, y = m.y * height - pointer.y * shift * .6;
        const size = m.size * (index ? 1 : .8 + .4 * glint);
        g.globalAlpha = alpha;
        g.drawImage(sprites[index ? `${m.tone}Soft` : m.tone], x - size, y - size, size * 2, size * 2);
      }
    });
    raf = requestAnimationFrame(frame);
  }
  const update = () => {
    const should = visible && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) { last = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
  observer.observe(stage);
  const resizer = new ResizeObserver(resize);
  resizer.observe(stage);
  document.addEventListener('visibilitychange', update);
  resize();

  return {
    // The pointer, -1..1 across the stage, sways the motes by their depth.
    point(x, y) { pointer.x = x; pointer.y = y; },
    dispose() {
      running = false; cancelAnimationFrame(raf);
      observer.disconnect(); resizer.disconnect();
      document.removeEventListener('visibilitychange', update);
      back.remove(); front.remove();
    },
  };
}
