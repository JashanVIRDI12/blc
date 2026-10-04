import * as THREE from 'three';

// Film headlines drawn inside the WebGL frame, between the showroom and the
// cars, so a car that drives across a headline passes in front of it.
//
// The DOM headings remain the layout and the accessible text. Each one is
// rasterised exactly as the browser set it (glyph by glyph, from its own
// ranges), once per layout, into a two-channel texture: the glyphs, and a
// soft dark halo around them (a text shadow) that keeps the ivory legible
// where it crosses the lit ceiling or a bright reflection. Lines rise in and
// out of their own line boxes on the GPU; nothing is redrawn while scrolling.
const MAX_LINES = 4;

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Line boxes can overlap on screen (tight leading), so each line is drawn
// into its own band of the texture: a line rising through its box samples
// only its own glyphs, never a neighbour's ascenders or descenders.
const typeFragment = /* glsl */`
  uniform sampler2D map; uniform vec3 color; uniform vec3 shade; uniform float opacity; uniform float halo;
  uniform vec2 lines[${MAX_LINES}]; uniform float bands[${MAX_LINES}]; uniform float scale;
  uniform float progress[${MAX_LINES}]; uniform int count;
  varying vec2 vUv;
  void main() {
    float ink = 0.0, glow = 0.0;
    // The halo is clipped to each line's band in the texture; let it fade
    // out before any edge so it never shows a seam.
    float across = smoothstep(0.0, 0.025, vUv.x) * smoothstep(0.0, 0.025, 1.0 - vUv.x);
    for (int i = 0; i < ${MAX_LINES}; i++) {
      if (i >= count) break;
      vec2 box = lines[i];
      if (vUv.y < box.x || vUv.y > box.y) continue;
      float p = progress[i], h = box.y - box.x;
      // Below 1 the line rises from under its box; above 1 it leaves upwards.
      float local = vUv.y - box.x - (1.0 - p) * h * 0.65;
      if (local < 0.0 || local > h) continue;
      float fade = smoothstep(0.0, 0.85, p) * (1.0 - smoothstep(1.15, 2.0, p));
      vec2 texel = texture2D(map, vec2(vUv.x, bands[i] + local * scale)).rg;
      float edge = smoothstep(0.0, h * 0.14, local) * smoothstep(0.0, h * 0.14, h - local);
      ink = max(ink, texel.r * fade);
      glow = max(glow, texel.g * fade * edge * across);
    }
    // Ink over its halo.
    float under = glow * halo * (1.0 - ink), alpha = ink + under;
    gl_FragColor = vec4((color * ink + shade * under) / max(alpha, 1e-4), alpha * opacity);
    #include <colorspace_fragment>
  }
`;
// A soft scrim under the headline: density only where the text sits. An
// ellipse beside a corner-anchored headline, or on phones, where the copy
// spans the width, a band from the top edge that fades out below the text.
const scrimFragment = /* glsl */`
  uniform float opacity; uniform float band; varying vec2 vUv;
  void main() {
    float r = length((vUv - 0.5) * 2.0);
    float ellipse = 1.0 - smoothstep(0.2, 1.0, r);
    float a = mix(ellipse * ellipse, 1.0 - smoothstep(0.5, 1.0, vUv.y), band);
    // Dither the falloff: a dark gradient this broad would otherwise band.
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
    gl_FragColor = vec4(0.035, 0.04, 0.043, clamp(a * opacity + noise / 96.0, 0.0, 1.0));
  }
`;

export function createTypePlane(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const planes = new Map();
  let offset = { x: 0, y: 0 };
  function position(entry) {
    const ratio = renderer.getPixelRatio();
    const snap = value => Math.round(value * ratio) / ratio;
    // Keep settled letterforms on the device-pixel grid, including after
    // parallax, instead of softening every glyph through a second resample.
    entry.text.position.set(snap(entry.home.x + offset.x + entry.drift[0]), snap(entry.home.y - offset.y - entry.drift[1]), 0);
  }

  function glyphs(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange(), out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const style = getComputedStyle(node.parentElement);
      if (style.display === 'none') continue;
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      for (let i = 0; i < node.data.length; i++) {
        if (/\s/.test(node.data[i])) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (rect?.width) out.push({ char: node.data[i], rect, font, spacing: style.letterSpacing });
      }
    }
    return out;
  }

  // Rasterise one heading at its laid-out position relative to `frame`.
  function rasterise(element, frame, ratio) {
    const chars = glyphs(element);
    if (!chars.length) return null;
    const lines = [];
    for (const g of chars) {
      let line = lines.find(l => Math.abs(l.top - g.rect.top) < g.rect.height * .4);
      if (!line) lines.push(line = { top: g.rect.top, bottom: g.rect.bottom, chars: [] });
      line.top = Math.min(line.top, g.rect.top); line.bottom = Math.max(line.bottom, g.rect.bottom);
      line.chars.push(g);
    }
    lines.sort((a, b) => a.top - b.top);
    const size = parseFloat(getComputedStyle(element).fontSize), pad = size * .22;
    const left = Math.min(...chars.map(g => g.rect.left)) - pad, right = Math.max(...chars.map(g => g.rect.right)) + pad;
    const top = lines[0].top - pad, bottom = lines.at(-1).bottom + pad;
    // Work in device pixels and snap the plane to the canvas's pixel grid,
    // so each texel lands on exactly one screen pixel: no resampling blur.
    const dx = v => (v - frame.left) * ratio, dy = v => (v - frame.top) * ratio;
    const x0 = Math.floor(dx(left)), y0 = Math.floor(dy(top));
    const texW = Math.ceil(dx(right)) - x0, quadH = Math.ceil(dy(bottom)) - y0;
    // Each line's box (device rows from the plane's top), and its own band
    // in the texture below the last.
    const boxes = lines.slice(0, MAX_LINES).map(l => ({
      top: Math.max(0, Math.floor(dy(l.top - size * .1)) - y0),
      bottom: Math.min(quadH, Math.ceil(dy(l.bottom + size * .1)) - y0),
      chars: l.chars,
    }));
    let depth = 0;
    for (const box of boxes) { box.band = depth; depth += box.bottom - box.top + 2; }
    const canvas = document.createElement('canvas');
    canvas.width = texW; canvas.height = depth;
    const c = canvas.getContext('2d', { alpha: false });
    c.fillStyle = '#000'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.textBaseline = 'alphabetic';
    // Red: the glyphs. Green: their halo, the glyphs thickened a little and
    // blurred (a canvas shadow cast from glyphs drawn off to the side, so
    // only the shadow lands). Shadow blur and offsets are in device pixels.
    const away = texW + 64;
    for (const halo of [false, true]) {
      for (const box of boxes) {
        c.save(); c.beginPath(); c.rect(0, box.band, texW, box.bottom - box.top); c.clip();
        // CSS pixels relative to the frame, mapped onto this line's band.
        c.setTransform(ratio, 0, 0, ratio, -x0 - (halo ? away : 0), box.band - box.top - y0);
        if (halo) {
          c.globalCompositeOperation = 'lighter';
          c.shadowColor = '#0f0'; c.shadowBlur = size * .16 * ratio; c.shadowOffsetX = away;
          c.lineWidth = size * .05; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = '#000';
        } else c.fillStyle = '#f00';
        for (const g of box.chars) {
          c.font = g.font;
          const ascent = c.measureText(g.char).fontBoundingBoxAscent;
          const x = g.rect.left - frame.left, y = g.rect.top - frame.top + ascent;
          c.fillText(g.char, x, y);
          if (halo) c.strokeText(g.char, x, y);
        }
        c.restore();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.format = THREE.RGFormat; texture.flipY = false;
    texture.generateMipmaps = false; texture.minFilter = texture.magFilter = THREE.LinearFilter;
    return {
      texture,
      rect: { x: x0 / ratio, y: y0 / ratio, width: texW / ratio, height: quadH / ratio },
      lines: boxes.map(b => new THREE.Vector2(b.top / quadH, b.bottom / quadH)),
      bands: boxes.map(b => b.band / depth),
      scale: quadH / depth,
    };
  }

  function dispose(entry) {
    entry.text.geometry.dispose(); entry.text.material.dispose(); entry.map?.dispose();
    entry.scrim.geometry.dispose(); entry.scrim.material.dispose();
    scene.remove(entry.text, entry.scrim);
  }

  return {
    // `headings`: [{ id, element, color, front }]. `front` draws over the cars
    // instead of behind them. `frame`: the canvas's client rect.
    layout(headings, frame) {
      camera.right = frame.width; camera.bottom = -frame.height; camera.updateProjectionMatrix();
      // Rasterise at the canvas's own density, texel for pixel.
      const narrow = frame.width <= 760, ratio = renderer.getPixelRatio();
      for (const { id, element, color, front = false } of headings) {
        const previous = planes.get(id);
        if (previous) dispose(previous);
        const raster = rasterise(element, element.closest('.cinema').getBoundingClientRect(), ratio);
        if (!raster) { planes.delete(id); continue; }
        const lines = Array.from({ length: MAX_LINES }, (_, i) => raster.lines[i] ?? new THREE.Vector2(2, 2));
        const bands = Array.from({ length: MAX_LINES }, (_, i) => raster.bands[i] ?? 0);
        const text = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
          vertexShader, fragmentShader: typeFragment, transparent: true, depthTest: false, depthWrite: false,
          uniforms: {
            map: { value: raster.texture }, color: { value: new THREE.Color(color) }, opacity: { value: 1 },
            shade: { value: new THREE.Color('#050607') }, halo: { value: .08 },
            lines: { value: lines }, bands: { value: bands }, scale: { value: raster.scale },
            progress: { value: new Array(MAX_LINES).fill(0) }, count: { value: raster.lines.length },
          },
        }));
        const bleed = Math.max(raster.rect.height * .5, 110);
        const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
          vertexShader, fragmentShader: scrimFragment, transparent: true, depthTest: false, depthWrite: false,
          uniforms: { opacity: { value: 0 }, band: { value: narrow ? 1 : 0 } },
        }));
        const { x, y, width, height } = raster.rect;
        text.scale.set(width, height, 1); text.position.set(x + width / 2, -(y + height / 2), 0); text.renderOrder = 2;
        if (narrow) {
          const reach = y + height + Math.max(bleed, 150) * 1.6;
          scrim.scale.set(frame.width, reach, 1); scrim.position.set(frame.width / 2, -reach / 2, 0);
        } else {
          scrim.scale.set((width + bleed * 2) * 1.25, (height + bleed * 2) * 1.3, 1); scrim.position.copy(text.position);
        }
        scrim.renderOrder = 1;
        text.visible = scrim.visible = false;
        scene.add(scrim, text);
        planes.set(id, { text, scrim, front, narrow, drift: [0, 0], shown: false, scrimShown: false, map: raster.texture, home: text.position.clone(), scrimHome: scrim.position.clone(), lineCount: raster.lines.length });
      }
    },
    // `states`: { [id]: { lines: [0..2 per line], scrim: 0..1 } }.
    update(states) {
      for (const [id, entry] of planes) {
        const state = states[id];
        const lines = state?.lines ?? [];
        const shown = lines.some(p => p > 0 && p < 2);
        entry.shown = shown; entry.scrimShown = shown && (state?.scrim ?? 0) > 0;
        if (!shown) continue;
        const progress = entry.text.material.uniforms.progress.value;
        for (let i = 0; i < MAX_LINES; i++) progress[i] = lines[Math.min(i, lines.length - 1)] ?? 0;
        entry.scrim.material.uniforms.opacity.value = state.scrim * (entry.narrow ? .64 : .42);
        entry.drift = state.drift ?? [0, 0];
        position(entry);
      }
    },
    // Screen-space shift for pointer depth (px); the type sits behind the cars.
    setOffset(x, y) {
      offset = { x, y };
      for (const entry of planes.values()) {
        position(entry);
        entry.scrim.position.set(entry.scrimHome.x + x, entry.scrimHome.y - y, 0);
      }
    },
    lineCount: id => planes.get(id)?.lineCount ?? 0,
    get ready() { return planes.size > 0; },
    // Draw the headlines that sit behind the cars (front = false) or over them.
    render(front = false) {
      let any = false;
      for (const entry of planes.values()) {
        entry.text.visible = entry.shown && entry.front === front;
        // Shade the room, never the bodywork. A legible title should not
        // paint a dark patch over the car during a close-up.
        entry.scrim.visible = entry.scrimShown && !front;
        any ||= entry.text.visible || entry.scrim.visible;
      }
      if (any) renderer.render(scene, camera);
    },
    snapshot: () => ({ planes: [...planes].map(([id, e]) => ({ id, shown: e.shown, front: e.front, lines: e.lineCount })), offset }),
    dispose() { for (const entry of planes.values()) dispose(entry); planes.clear(); },
  };
}
