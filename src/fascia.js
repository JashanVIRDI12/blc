// The figures, on a rotating display of the kind the finest cars set into
// their dashboards: a three-sided prism behind a piano-black fascia that
// turns to show one face at a time (after the rotating display in Bentley's
// Continental GT and Flying Spur). Each turn is the mechanism's own three
// linked motions: back into the dash for clearance, round, and forward into
// place, where it settles with a small detent.
//
//   Walnut         book-matched veneer, the Baba crest inlaid in gold
//   Dials          the figures, on three dials: a black sunburst face, gold
//                  applied indices with the scale's numerals outside them
//                  (the needle never crosses one), a knurled chrome bezel,
//                  a domed lens. On arrival they go through a car's
//                  ignition: the dials light, the needles sweep to the stop
//                  and back, then rise to the figures as the readouts count
//   Destinations   the handovers, on a navigation screen of the kind the
//                  display's third face is in the car: a status bar keeping
//                  New Delhi time, a night map in perspective with the
//                  route lit ahead, and beside it each place a car has gone
//                  to in turn, with its distance from the showroom and the
//                  part of the country it is in (the map is streets, never
//                  a country: no border is drawn)
//
// The scroll turns the display, pinned; the display follows it on a spring,
// so it moves with weight and comes to rest. The cabin's ambient light
// traces round the opening as the section arrives. A fine pointer leans the
// view a little. Rendered on demand, multisampled, with a soft bloom on what
// glows and contrast-adaptive sharpening on large screens; resting, it draws
// nothing. Reduced motion and WebGL failure keep the figures as type
// (about-page.js).
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SHARPEN } from './sharpen.js';
import { glassFinish } from './glass.js';
import { createRenderDensity } from './render-density.js';
import { compileAhead } from './compile.js';
gsap.registerPlugin(ScrollTrigger);

const TURN = Math.PI * 2 / 3;
// A dial's scale: 270 degrees, from the lower left, clockwise (radians from
// straight up).
const SWEEP = Math.PI * 1.5, START = -Math.PI * .75;
// The scroll: a hold on each face, a turn between.
const HOLDS = [[0, .14], [.4, .6], [.86, 1]];
const RETRACT = .24; // metres back into the dash while it turns
const STACKED = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
const LOGO = '/brand/baba-luxury-car-800.webp';
const DELHI = [28.6139, 77.209];

// Where Baba's handovers have gone: each state and union territory near its
// geographic centre, and the cities a caption is likely to name, so a new
// handover in the admin finds its place on the screen.
const PLACES = {
  'jammu and kashmir': [33.5, 75], ladakh: [34.2, 77.6], 'himachal pradesh': [31.9, 77.2], punjab: [30.9, 75.4], haryana: [29.2, 76.3],
  uttarakhand: [30.1, 79.2], 'uttar pradesh': [26.9, 80.9], rajasthan: [26.6, 73.8], gujarat: [22.7, 71.6], 'madhya pradesh': [23.5, 78.5],
  maharashtra: [19.4, 76.1], goa: [15.4, 74], karnataka: [14.7, 75.7], kerala: [10.4, 76.4], 'tamil nadu': [11.1, 78.6],
  'andhra pradesh': [15.9, 79.7], telangana: [17.9, 79], chhattisgarh: [21.3, 81.9], odisha: [20.5, 84.4], jharkhand: [23.6, 85.3],
  bihar: [25.6, 85.7], 'west bengal': [23, 87.9], sikkim: [27.5, 88.5], assam: [26.2, 92.8], meghalaya: [25.5, 91.3],
  'arunachal pradesh': [28, 94.5], nagaland: [26.1, 94.5], manipur: [24.7, 93.9], mizoram: [23.3, 92.8], tripura: [23.8, 91.6],
  delhi: [28.61, 77.21], chandigarh: [30.73, 76.78], puducherry: [11.94, 79.81], 'andaman and nicobar islands': [11.7, 92.7], lakshadweep: [10.6, 72.6],
  srinagar: [34.08, 74.8], jammu: [32.73, 74.86], leh: [34.15, 77.58], shimla: [31.1, 77.17], manali: [32.24, 77.19], amritsar: [31.63, 74.87],
  ludhiana: [30.9, 75.85], jalandhar: [31.33, 75.58], dehradun: [30.32, 78.03], haridwar: [29.95, 78.16], rishikesh: [30.09, 78.27], nainital: [29.38, 79.46],
  gurugram: [28.46, 77.03], gurgaon: [28.46, 77.03], noida: [28.54, 77.39], faridabad: [28.41, 77.32], ghaziabad: [28.67, 77.45], meerut: [28.98, 77.71],
  agra: [27.18, 78.01], lucknow: [26.85, 80.95], kanpur: [26.45, 80.33], varanasi: [25.32, 82.97], jaipur: [26.91, 75.79], jodhpur: [26.24, 73.02],
  udaipur: [24.59, 73.71], ahmedabad: [23.03, 72.58], surat: [21.17, 72.83], indore: [22.72, 75.86], bhopal: [23.26, 77.41], nagpur: [21.15, 79.09],
  mumbai: [19.08, 72.88], pune: [18.52, 73.86], panaji: [15.49, 73.83], bengaluru: [12.97, 77.59], bangalore: [12.97, 77.59], mysuru: [12.3, 76.64],
  hyderabad: [17.39, 78.49], chennai: [13.08, 80.27], coimbatore: [11.02, 76.96], kochi: [9.93, 76.27], thiruvananthapuram: [8.52, 76.94],
  visakhapatnam: [17.69, 83.22], vijayawada: [16.51, 80.65], kolkata: [22.57, 88.36], bhubaneswar: [20.3, 85.82], raipur: [21.25, 81.63],
  ranchi: [23.34, 85.31], patna: [25.59, 85.14], guwahati: [26.14, 91.74], shillong: [25.58, 91.89], gangtok: [27.33, 88.61], kohima: [25.67, 94.11],
  imphal: [24.82, 93.94], aizawl: [23.73, 92.72], agartala: [23.83, 91.29], itanagar: [27.08, 93.61],
};
const placeKey = name => String(name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
// Distance (km) and initial bearing (radians from north) from New Delhi.
function fromDelhi([lat, lon]) {
  const r = Math.PI / 180, p1 = DELHI[0] * r, p2 = lat * r, dl = (lon - DELHI[1]) * r;
  const d = 2 * 6371 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
  const bearing = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  return { d, bearing };
}

// Which part of the country a place is in, as it is said in India. States by
// name; a city takes the part of the state whose centre is nearest it.
const REGIONS = {
  'North India': ['jammu and kashmir', 'ladakh', 'himachal pradesh', 'punjab', 'haryana', 'uttarakhand', 'uttar pradesh', 'rajasthan', 'delhi', 'chandigarh'],
  'South India': ['karnataka', 'kerala', 'tamil nadu', 'andhra pradesh', 'telangana', 'puducherry', 'visakhapatnam'],
  'Western India': ['gujarat', 'maharashtra', 'goa'],
  'Central India': ['madhya pradesh', 'chhattisgarh'],
  'Eastern India': ['odisha', 'jharkhand', 'bihar', 'west bengal'],
  'The North-East': ['sikkim', 'assam', 'meghalaya', 'arunachal pradesh', 'nagaland', 'manipur', 'mizoram', 'tripura'],
  'The Islands': ['andaman and nicobar islands', 'lakshadweep'],
};
const REGION_OF = Object.fromEntries(Object.entries(REGIONS).flatMap(([region, keys]) => keys.map(key => [key, region])));
function regionOf(key) {
  if (REGION_OF[key]) return REGION_OF[key];
  const [lat, lon] = PLACES[key], narrow = Math.cos(lat * Math.PI / 180);
  let nearest = null, least = Infinity;
  for (const state of Object.keys(REGION_OF)) {
    const d = (PLACES[state][0] - lat) ** 2 + ((PLACES[state][1] - lon) * narrow) ** 2;
    if (d < least) { least = d; nearest = state; }
  }
  return REGION_OF[nearest];
}

// A dial's scale for its figure: a percentage reads to 100; anything else to
// the round number a little above it, in five major divisions.
function scaleFor({ value, suffix }) {
  if (suffix.includes('%')) return { max: 100, major: 20, minor: 5 };
  const max = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 250, 300, 400, 500].find(m => m >= value * 1.2) ?? Math.ceil(value * 1.25);
  const major = max / 5;
  return { max, major, minor: major / (Number.isInteger(major / 5) ? 5 : major % 3 === 0 ? 6 : 4) };
}

// ---------------------------------------------------------------- drawing
// A long drawing runs as a generator: all at once, or a band at a time
// between frames so the page keeps scrolling.
const runNow = job => { let step; do step = job.next(); while (!step.done); return step.value; };
async function runSoon(job) { let step; while (!(step = job.next()).done) await new Promise(resolve => setTimeout(resolve)); return step.value; }
const sheet = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));

function makeNoise(seed) {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512).map((_, i) => p[i & 255]), value = Float32Array.from({ length: 256 }, random);
  const fade = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi), X = xi & 255, Y = yi & 255;
    const a = value[perm[perm[X] + Y]], b = value[perm[perm[X + 1] + Y]], c = value[perm[perm[X] + Y + 1]], d = value[perm[perm[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, octaves) => { let sum = 0, amp = .5, f = 1, norm = 0; for (let i = 0; i < octaves; i++) { sum += amp * n2(x * f, y * f); norm += amp; amp *= .5; f *= 2.03; } return sum / norm; };
  return { n2, fbm };
}

// Book-matched walnut, its figure flowing along the grain and mirrored about
// the seam, open pores and all; the crest inlaid at the centre in gold, a gold
// stringing line round the edge. `finish` carries roughness (green) and
// metal (blue): the inlay is metal, polished.
function* walnut(widthM, heightM, alongX, logo) {
  const px = 452; // texels per metre
  const w = Math.round(widthM * px), h = Math.round(heightM * px);
  const color = sheet(w, h), finish = sheet(w, h);
  const c = color.getContext('2d'), f = finish.getContext('2d');
  const image = c.createImageData(w, h), data = image.data;
  const { n2, fbm } = makeNoise(11);
  const mid = [66, 40, 20], light = [124, 79, 43];
  const along = alongX ? widthM : heightM;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // s along the grain, mirrored at the seam; t across it (metres).
    const s = Math.abs((alongX ? x / px : y / px) - along / 2), t = alongX ? y / px : x / px;
    // The cathedral figure: growth rings bent into broad arches.
    const g = t * 28 + fbm(s * .8, t * 1.1, 4) * 6.5 + Math.sin(s * 1.7 + t * .8) * .9;
    const ring = Math.pow(1 - Math.abs(Math.sin(g * Math.PI)), 10);
    const band = .5 + .5 * Math.sin(g * Math.PI * .23 + fbm(s * .5, t * .8, 2) * 4);
    const tone = smooth(clamp01(band * .85 + (fbm(s * 2, t * 4, 3) - .5) * .6));
    // Open pores, long along the grain.
    const pore = n2(s * 38, t * 420) > .8 ? .22 : 0;
    const shade = 1 - ring * .42 - pore;
    const i = (y * w + x) * 4;
    data[i] = (mid[0] + (light[0] - mid[0]) * tone) * shade;
    data[i + 1] = (mid[1] + (light[1] - mid[1]) * tone) * shade;
    data[i + 2] = (mid[2] + (light[2] - mid[2]) * tone) * shade;
    data[i + 3] = 255;
    if (x === w - 1 && y % 24 === 23) yield;
  }
  c.putImageData(image, 0, 0);
  f.fillStyle = 'rgb(0,150,0)'; f.fillRect(0, 0, w, h);
  // The stringing: a gold line inset from the edge.
  const inset = Math.min(w, h) * .07, line = Math.max(2, px * .004);
  c.strokeStyle = '#c8954c'; c.lineWidth = line; c.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  f.strokeStyle = 'rgb(0,70,255)'; f.lineWidth = line; f.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  if (logo) {
    const lw = Math.min(w * (alongX ? .3 : .72), h * 1.1), lh = lw * logo.height / logo.width;
    const x = (w - lw) / 2, y = (h - lh) / 2;
    c.drawImage(logo, x, y, lw, lh);
    const ink = sheet(lw, lh), ictx = ink.getContext('2d');
    ictx.drawImage(logo, 0, 0, lw, lh); ictx.globalCompositeOperation = 'source-in'; ictx.fillStyle = 'rgb(0,60,255)'; ictx.fillRect(0, 0, lw, lh);
    f.drawImage(ink, x, y);
  }
  return { color, finish };
}

// A dial's face: black, brushed in a sunburst. The gold indices (applied, in
// buildDisplay) are its marks; printed with them are a hairline for the
// needle's whole sweep, which the lit arc then runs along, and the scale's
// numerals, one outside each index, where the needle never crosses them. No
// minor marks, and no crest: the figure in the opening is what is read.
// `glow` is the same print, lit from behind.
function dialFace(scale) {
  const size = 1024, c = size / 2, plate = .96; // the canvas spans the plate, .96 of the dial's radius
  const px = r => r / plate * c; // dial radii to pixels
  const base = sheet(size, size), glow = sheet(size, size);
  const b = base.getContext('2d'), g = glow.getContext('2d');
  const face = b.createRadialGradient(c, c * .82, 0, c, c, c);
  face.addColorStop(0, '#121214'); face.addColorStop(.62, '#09090a'); face.addColorStop(1, '#030303');
  b.fillStyle = face; b.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    const a = Math.random() * Math.PI * 2;
    b.strokeStyle = `rgba(255,246,230,${(Math.random() * .03).toFixed(3)})`; b.lineWidth = 1;
    b.beginPath(); b.moveTo(c + Math.cos(a) * px(.1), c + Math.sin(a) * px(.1)); b.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); b.stroke();
  }
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const at = v => START + SWEEP * v / scale.max;
  const point = (r, a) => [c + Math.sin(a) * px(r), c - Math.cos(a) * px(r)];
  for (const [ctx, track, ink] of [[b, 'rgba(239,233,222,.13)', 'rgba(239,233,222,.8)'], [g, 'rgba(255,255,255,.3)', '#fff']]) {
    // The sweep (a canvas measures its angles from three o'clock).
    ctx.strokeStyle = track; ctx.lineWidth = px(.008); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(c, c, px(.665), START - Math.PI / 2, START + SWEEP - Math.PI / 2); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = `300 ${Math.round(px(.108))}px Newsreader`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= scale.max + 1e-6; v += scale.major) {
      const [x, y] = point(.868, at(v));
      ctx.fillText(String(Math.round(v * 10) / 10), x, y);
    }
  }
  return { base, glow };
}

// The sunburst's grain for the face's anisotropy: every texel brushed
// radially (direction in red and green, strength in blue).
let sunburstMap = null;
function sunburst() {
  if (sunburstMap) return sunburstMap;
  const size = 256, c = sheet(size, size), ctx = c.getContext('2d'), image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5) / size * 2 - 1, dy = 1 - (y + .5) / size * 2, l = Math.hypot(dx, dy) || 1, i = (y * size + x) * 4;
    image.data[i] = (dx / l * .5 + .5) * 255; image.data[i + 1] = (dy / l * .5 + .5) * 255; image.data[i + 2] = 255; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  sunburstMap = new THREE.CanvasTexture(c);
  sunburstMap.colorSpace = THREE.NoColorSpace;
  return sunburstMap;
}

// Fine straight knurling round a bezel's outer band, as a bump map. The
// lathe's v runs from the inner edge (0) to the outer (1); the canvas is
// flipped, so the outer band is its top rows.
let knurlMap = null;
function knurl() {
  if (knurlMap) return knurlMap;
  const c = sheet(1024, 64), ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1024, 64);
  for (let x = 0; x < 1024; x += 4) { ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x, 0, 2, 20); ctx.fillStyle = '#404040'; ctx.fillRect(x + 2, 0, 2, 20); }
  knurlMap = new THREE.CanvasTexture(c);
  knurlMap.colorSpace = THREE.NoColorSpace;
  knurlMap.wrapS = THREE.RepeatWrapping;
  return knurlMap;
}

// A reading in the dial's lower opening: the figure, its unit in gold
// italic, the label beneath.
function drawReadout(ctx, text, unit, label) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `300 ${Math.round(h * .58)}px Newsreader`;
  const figure = ctx.measureText(text).width;
  ctx.font = `italic 300 ${Math.round(h * .24)}px Newsreader`;
  const small = ctx.measureText(unit).width;
  const x = (w - figure - small - h * .02) / 2, base = h * .6;
  ctx.fillStyle = '#f4efe6'; ctx.font = `300 ${Math.round(h * .58)}px Newsreader`; ctx.textAlign = 'left';
  ctx.fillText(text, x, base);
  ctx.fillStyle = '#e2b56c'; ctx.font = `italic 300 ${Math.round(h * .24)}px Newsreader`;
  ctx.fillText(unit, x + figure + h * .02, base - h * .31);
  ctx.fillStyle = 'rgba(213,178,123,.85)'; ctx.font = `600 ${Math.round(h * .1)}px Manrope`; ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(h * .03)}px`;
  ctx.fillText(label.toUpperCase(), w / 2, h * .86);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// The navigation screen, as a car's own: a status bar (the marque, the
// place, New Delhi's time), the map (drawMap: a city at night seen from
// behind the car, the route lit ahead, the car's mark on the road, the turn
// coming and a compass that turns with the map), and beside the map (or
// beneath it, on a tall screen) where the cars have gone, one place at a
// time: its name, how far it is from the showroom and which part of the
// country it is in (North India, the North-East…), a hairline lit as far as
// that is, and what they add up to, said as it is said here: from Kashmir
// to Kanyakumari. Distances are aerial (straight, to the centre of the state
// or to the city named), to the nearest ten kilometres, and the screen says
// so. The clock is the twelve-hour one India keeps. The map is a city's
// streets, made up, not a country: nothing on it is a border or a real road.
// `t` runs the screen in, 0 to 1; `clock` is the seconds it has been on.
const REACH = 2400; // km a fully lit line stands for: a little past the farthest state
const SLOT = 4.2, TURN_IN = .8; // seconds each destination is shown, and takes to arrive
const DRIVE = 4; // street units (5 m each) a second under the car: about 70 km/h
const IST = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
const lerp = (a, b, k) => a + (b - a) * k;
const chance = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------------------------------------------------------- the map
// A city to drive through, as a car's navigation draws one: seen from behind
// and above the car, heading up, so the road under the car always runs up
// the screen and the map turns as the car does.
//
// The city is a grid of streets that repeats, PX across and PZ along (in
// street units of five metres); one street in each direction, and one more
// between, is an avenue. In each block stands a park, or a building or two.
const PX = 64, PZ = 72, CORNER = 4.5;
const XS = [0, 9, 18, 27, 36, 46, 55], ZS = [0, 10, 20, 31, 41, 52, 62];
const AVENUE = 1.05, STREET = .46; // half-widths
const isAvenue = i => i % XS.length === 0 || i % XS.length === 4;
// Three versions of the city alternate along its diagonal, so no street is
// lined with its own repeat.
const CITY = [0, 1, 2].map(g => XS.map((x, i) => ZS.map((z, j) => {
  const seed = g * 97 + i * 13 + j * 7 + 1, edge = n => (isAvenue(n) ? AVENUE : STREET) + 1.25;
  const lot = { x0: x + edge(i), x1: (XS[i + 1] ?? PX) - edge(i + 1), z0: z + edge(j), z1: (ZS[j + 1] ?? PZ) - edge(j + 1) };
  if (chance(seed) < .15) return { park: lot, boxes: [] };
  const part = (fx0, fx1, fz0, fz1, n) => ({ x0: lerp(lot.x0, lot.x1, fx0), x1: lerp(lot.x0, lot.x1, fx1), z0: lerp(lot.z0, lot.z1, fz0), z1: lerp(lot.z0, lot.z1, fz1), h: .8 + chance(seed + n) ** 2 * 2.2 });
  const pick = chance(seed + 3), long = lot.x1 - lot.x0 > lot.z1 - lot.z0;
  const boxes = pick < .1 ? [] : pick < .5 ? [part(.05, .95, .05, .95, 11)] : long ? [part(0, .45, .04, .96, 11), part(.57, 1, .1, .9, 12)] : [part(.04, .96, 0, .45, 11), part(.1, .9, .57, 1, 12)];
  return { park: null, boxes };
})));
// The route keeps to the avenues: north for a block of the city, right onto
// the cross avenue, left onto the next, and so on, its corners rounded. One
// lap of it is a step of (PX, PZ), after which the city is the same again.
const LEG_N = PZ - 2 * CORNER, LEG_E = PX - 2 * CORNER, ARC = Math.PI * CORNER / 2, LAP = LEG_N + LEG_E + 2 * ARC;
function routeAt(s, out) {
  const lap = Math.floor(s / LAP);
  let d = s - lap * LAP, x, z, heading;
  if (d < LEG_N) { x = 0; z = CORNER + d; heading = 0; }
  else if ((d -= LEG_N) < ARC) { heading = d / CORNER; x = CORNER - CORNER * Math.cos(heading); z = PZ - CORNER + CORNER * Math.sin(heading); }
  else if ((d -= ARC) < LEG_E) { x = CORNER + d; z = PZ; heading = Math.PI / 2; }
  else { heading = Math.PI / 2 - (d - LEG_E) / CORNER; x = PX - CORNER + CORNER * Math.cos(heading); z = PZ + CORNER - CORNER * Math.sin(heading); }
  out.x = x + lap * PX; out.z = z + lap * PZ; out.heading = heading;
  return out;
}
// The turn coming, and how far off it is (street units).
function turnAhead(s) {
  const d = s - Math.floor(s / LAP) * LAP;
  return d < LEG_N ? { right: true, after: LEG_N - d } : d < LEG_N + ARC + LEG_E ? { right: false, after: LEG_N + ARC + LEG_E - d } : { right: true, after: LAP - d + LEG_N };
}
// The eye: above and behind the car, looking down the road.
const EYE = 7.5, BACK = 9, PITCH = 28 * Math.PI / 180, SIN = Math.sin(PITCH), COS = Math.cos(PITCH), NEAR = 1.2;
const car = { x: 0, z: 0, heading: 0 }, behind = { x: 0, z: 0, heading: 0 }, ahead = { x: 0, z: 0, heading: 0 }, spot = { x: 0, z: 0, heading: 0 };
const P = new Float64Array(3 * 700), Q = new Float64Array(3 * 720);
const ARROW = [[0, 1.75], [1.2, -1.3], [0, -.62], [-1.2, -1.3]]; // the car's mark: tip, right, notch, left
const FLOW = [[-.44, -.3], [0, .32], [.44, -.3], [.44, -.64], [0, -.02], [-.44, -.64]];

function drawMap(ctx, map, { u, side, t, clock, portrait, name, fadeIn, tracked }) {
  ctx.save();
  ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip();
  // Where the car is, and which way is up: the map follows the road a
  // little ahead of the car, so it begins to turn before the car does.
  const s = 24 + clock * DRIVE;
  routeAt(s, car); routeAt(s - 4, behind); routeAt(s + 10, ahead);
  const H = Math.atan2(ahead.x - behind.x, ahead.z - behind.z), sinH = Math.sin(H), cosH = Math.cos(H);
  const F = map.h * .823, vx = map.x + map.w * (portrait ? .5 : .46), vy = map.y + map.h * .598, horizon = vy - F * SIN / COS;
  let count = 0;
  // A point of the city (x across, h up, z along), as the eye sees it.
  const put = (x, h, z) => {
    const dx = x - car.x, dz = z - car.z, zr = dx * sinH + dz * cosH + BACK, y = h - EYE;
    P[count * 3] = dx * cosH - dz * sinH; P[count * 3 + 1] = y * COS + zr * SIN; P[count * 3 + 2] = zr * COS - y * SIN; count++;
  };
  // Draw what has been put, cut off where it comes too near the eye.
  const shape = (fill, stroke) => {
    let m = 0;
    for (let i = 0; i < count; i++) {
      const a = i * 3, b = ((i + 1) % count) * 3, da = P[a + 2], db = P[b + 2];
      if (da >= NEAR) { Q[m * 3] = P[a]; Q[m * 3 + 1] = P[a + 1]; Q[m * 3 + 2] = da; m++; }
      if ((da >= NEAR) !== (db >= NEAR)) { const k = (NEAR - da) / (db - da); Q[m * 3] = P[a] + (P[b] - P[a]) * k; Q[m * 3 + 1] = P[a + 1] + (P[b + 1] - P[a + 1]) * k; Q[m * 3 + 2] = NEAR; m++; }
    }
    count = 0;
    if (m < 3) return;
    ctx.beginPath();
    for (let i = 0; i < m; i++) { const d = Q[i * 3 + 2], sx = vx + F * Q[i * 3] / d, sy = vy - F * Q[i * 3 + 1] / d; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const flat = (x0, z0, x1, z1, h, fill, stroke) => { put(x0, h, z0); put(x1, h, z0); put(x1, h, z1); put(x0, h, z1); shape(fill, stroke); };
  const seen = (x, h, z) => { const dx = x - car.x, dz = z - car.z, zr = dx * sinH + dz * cosH + BACK, y = h - EYE, d = zr * COS - y * SIN; return [vx + F * (dx * cosH - dz * sinH) / d, vy - F * (y * COS + zr * SIN) / d, d]; };

  ctx.globalAlpha = fadeIn(0);
  ctx.fillStyle = '#050506'; ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.fillStyle = '#0f1013'; ctx.fillRect(map.x, horizon, map.w, map.y + map.h - horizon);
  // The blocks in sight: their parks drawn now, their buildings kept for later.
  const REACH_X = 130, wide = map.w / F * .5 + .25, standing = [];
  const kx0 = Math.floor((car.x - REACH_X) / PX), kx1 = Math.floor((car.x + REACH_X) / PX), kz0 = Math.floor((car.z - REACH_X) / PZ), kz1 = Math.floor((car.z + REACH_X) / PZ);
  const inSight = (x, z, far) => { const dx = x - car.x, dz = z - car.z, zr = dx * sinH + dz * cosH + BACK, d = zr * COS + EYE * SIN; return d > 2.5 && d < far && Math.abs(dx * cosH - dz * sinH) < d * wide + 12 ? d : 0; };
  for (let kx = kx0; kx <= kx1; kx++) for (let kz = kz0; kz <= kz1; kz++) {
    const city = CITY[(((kx - kz) % 3) + 3) % 3], ox = kx * PX, oz = kz * PZ;
    for (const row of city) for (const block of row) {
      if (block.park) { const g = block.park; if (inSight(ox + (g.x0 + g.x1) / 2, oz + (g.z0 + g.z1) / 2, 110)) flat(ox + g.x0, oz + g.z0, ox + g.x1, oz + g.z1, 0, '#11211a'); continue; }
      for (const box of block.boxes) { const d = inSight(ox + (box.x0 + box.x1) / 2, oz + (box.z0 + box.z1) / 2, 96); if (d) standing.push({ box, ox, oz, d }); }
    }
  }
  // The streets, and over them the avenues, each with its kerbs.
  const along = (x, half, fill) => flat(x - half, car.z - 170, x + half, car.z + 170, 0, fill), across = (z, half, fill) => flat(car.x - 170, z - half, car.x + 170, z + half, 0, fill);
  for (const avenues of [false, true]) {
    const half = avenues ? AVENUE : STREET, fill = avenues ? '#585c6b' : '#3a3d48';
    for (let kx = kx0; kx <= kx1; kx++) XS.forEach((x, i) => { if (isAvenue(i) === avenues) along(kx * PX + x, half, fill); });
    for (let kz = kz0; kz <= kz1; kz++) ZS.forEach((z, j) => { if (isAvenue(j) === avenues) across(kz * PZ + z, half, fill); });
  }
  for (const side of [-1, 1]) {
    for (let kx = kx0; kx <= kx1; kx++) XS.forEach((x, i) => { if (isAvenue(i)) along(kx * PX + x + side * (AVENUE - .09), .05, 'rgba(255,255,255,.16)'); });
    for (let kz = kz0; kz <= kz1; kz++) ZS.forEach((z, j) => { if (isAvenue(j)) across(kz * PZ + z + side * (AVENUE - .09), .05, 'rgba(255,255,255,.16)'); });
  }
  // The route: a band along the way, from a little behind the car to as far
  // as it has been drawn.
  const reach = lerp(4, 112, smooth(clamp01((t - .12) / .6)));
  const band = (from, to, half, fill) => {
    for (let d = from; d < to + 1; d++) { routeAt(s + Math.min(d, to), spot); put(spot.x - Math.cos(spot.heading) * half, .02, spot.z + Math.sin(spot.heading) * half); }
    for (let d = to; d > from - 1; d--) { routeAt(s + Math.max(d, from), spot); put(spot.x + Math.cos(spot.heading) * half, .02, spot.z - Math.sin(spot.heading) * half); }
    shape(fill);
  };
  const [, carY] = seen(car.x, 0, car.z);
  const lit = ctx.createLinearGradient(0, carY, 0, horizon);
  lit.addColorStop(0, '#ffd88a'); lit.addColorStop(.6, '#eab659'); lit.addColorStop(1, '#b98636');
  band(-7, 0, .5, 'rgba(213,178,123,.34)');
  band(0, reach, 2.1, 'rgba(242,191,94,.07)');
  band(0, reach, 1.3, 'rgba(242,191,94,.13)');
  band(0, reach, .8, '#6b4718');
  band(0, reach, .6, lit);
  // Marks flowing along it, the way it is to be driven.
  for (let d = 5 + (clock * 3) % 7; d < reach - 3; d += 7) {
    routeAt(s + d, spot);
    const sin = Math.sin(spot.heading), cos = Math.cos(spot.heading);
    for (const [lx, lz] of FLOW) put(spot.x + cos * lx + sin * lz, .04, spot.z - sin * lx + cos * lz);
    shape(`rgba(255,250,235,${(.82 * (1 - d / 118)).toFixed(3)})`);
  }
  // The buildings, the far ones first: the sides the eye is on, then the roof.
  const eyeX = car.x - sinH * BACK, eyeZ = car.z - cosH * BACK;
  standing.sort((a, b) => b.d - a.d);
  ctx.lineWidth = Math.max(1, u * .0016);
  for (const { box, ox, oz, d } of standing) {
    const x0 = ox + box.x0, x1 = ox + box.x1, z0 = oz + box.z0, z1 = oz + box.z1, h = box.h;
    ctx.globalAlpha = fadeIn(0) * clamp01((96 - d) / 40);
    const wall = (ax, az, bx, bz, fill) => { put(ax, 0, az); put(bx, 0, bz); put(bx, h, bz); put(ax, h, az); shape(fill); };
    if (eyeZ < z0) wall(x0, z0, x1, z0, '#1b1c23'); else if (eyeZ > z1) wall(x0, z1, x1, z1, '#1b1c23');
    if (eyeX < x0) wall(x0, z0, x0, z1, '#14151a'); else if (eyeX > x1) wall(x1, z0, x1, z1, '#14151a');
    flat(x0, z0, x1, z1, h, '#24252e', 'rgba(226,190,128,.34)');
  }
  ctx.globalAlpha = fadeIn(0);
  // Distance takes the city into the dark; the horizon glows where the way goes.
  const haze = ctx.createLinearGradient(0, horizon, 0, horizon + (map.y + map.h - horizon) * .4);
  haze.addColorStop(0, 'rgba(5,5,6,1)'); haze.addColorStop(.3, 'rgba(5,5,6,.62)'); haze.addColorStop(1, 'rgba(5,5,6,0)');
  ctx.fillStyle = haze; ctx.fillRect(map.x, map.y, map.w, map.h);
  routeAt(s + 90, spot);
  const glowX = Math.min(map.x + map.w * .8, Math.max(map.x + map.w * .12, seen(spot.x, 0, spot.z)[0]));
  const dawn = ctx.createRadialGradient(glowX, horizon, 0, glowX, horizon, map.w * .3);
  dawn.addColorStop(0, 'rgba(242,191,94,.22)'); dawn.addColorStop(.45, 'rgba(196,136,58,.07)'); dawn.addColorStop(1, 'rgba(196,136,58,0)');
  ctx.save(); ctx.translate(0, horizon); ctx.scale(1, .4); ctx.translate(0, -horizon); ctx.fillStyle = dawn; ctx.fillRect(map.x, horizon - map.w * .3, map.w, map.w * .6); ctx.restore();

  // The car: its mark lying on the road and pointing the way it is going,
  // lifted a little so it throws a shadow, inside the ring a position has.
  ctx.globalAlpha = fadeIn(.05);
  const beat = (clock * .45) % 1, sinC = Math.sin(car.heading), cosC = Math.cos(car.heading);
  const ring = (radius, fill, stroke) => { for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; put(car.x + Math.cos(a) * radius, .03, car.z + Math.sin(a) * radius); } shape(fill, stroke); };
  ctx.lineWidth = Math.max(1.5, u * .0035);
  ring(2.1 + beat * 2.2, null, `rgba(242,191,94,${(.5 * (1 - beat)).toFixed(3)})`);
  ring(2.1, 'rgba(242,191,94,.14)', 'rgba(255,214,140,.65)');
  const mark = (points, lift, shift, fill) => { for (const [lx, lz] of points) put(car.x + cosC * lx + sinC * lz + shift, lift, car.z - sinC * lx + cosC * lz - shift); shape(fill); };
  mark(ARROW, .03, .28, 'rgba(0,0,0,.55)');
  // Two faces, as a folded arrowhead has: one in the light, one in its shade.
  mark([ARROW[0], ARROW[1], ARROW[2]], .5, 0, '#dcb672');
  mark([ARROW[0], ARROW[2], ARROW[3]], .5, 0, '#fff7e4');

  // What a navigation says of the way: the turn coming and how far off it
  // is, and where all this is headed.
  ctx.globalAlpha = fadeIn(.3);
  const turn = turnAhead(s), metres = Math.max(10, Math.round(turn.after * 5 / 10) * 10);
  const bh = u * .2, bx = map.x + side, by = map.y + u * .06, icon = bh * .9;
  ctx.font = `300 ${Math.round(u * .1)}px Newsreader`;
  const distance = `${metres} m`, towards = name ? `TOWARDS ${name.toUpperCase()}` : '';
  let bw = ctx.measureText('000 m').width;
  ctx.font = `600 ${Math.round(u * .028)}px Manrope`; tracked(u * .007);
  bw = icon + Math.max(bw, ctx.measureText(towards).width) + u * .07;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, u * .022); else ctx.rect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(10,10,12,.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(213,178,123,.3)'; ctx.lineWidth = Math.max(1, u * .0022); ctx.stroke();
  ctx.fillStyle = 'rgba(239,233,222,.72)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(towards, bx + icon, by + bh * .8);
  tracked(0);
  ctx.font = `300 ${Math.round(u * .1)}px Newsreader`; ctx.fillStyle = '#f4efe6';
  ctx.fillText(distance, bx + icon, by + bh * .56);
  // The turn, as a road sign draws it.
  const ix = bx + icon * .5, iy = by + bh * .5, a = bh * .2, way = turn.right ? 1 : -1;
  ctx.strokeStyle = '#f2bf5e'; ctx.lineWidth = Math.max(2, u * .014); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ix - way * a * .55, iy + a * 1.15); ctx.lineTo(ix - way * a * .55, iy - a * .1); ctx.quadraticCurveTo(ix - way * a * .55, iy - a * .75, ix + way * a * .1, iy - a * .75); ctx.lineTo(ix + way * a * .8, iy - a * .75); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ix + way * a * .32, iy - a * 1.25); ctx.lineTo(ix + way * a * .85, iy - a * .75); ctx.lineTo(ix + way * a * .32, iy - a * .25); ctx.stroke();
  // North, which turns as the map does.
  const cr = u * .058, cx = map.x + side + cr, cy = map.y + map.h - u * .15, nx = -sinH, ny = -cosH;
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,10,12,.86)'; ctx.fill(); ctx.strokeStyle = 'rgba(213,178,123,.3)'; ctx.lineWidth = Math.max(1, u * .0022); ctx.stroke();
  const needle = (sign, fill) => { ctx.beginPath(); ctx.moveTo(cx + nx * cr * .7 * sign, cy + ny * cr * .7 * sign); ctx.lineTo(cx - ny * cr * .2, cy + nx * cr * .2); ctx.lineTo(cx + ny * cr * .2, cy - nx * cr * .2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  needle(1, '#f2bf5e'); needle(-1, 'rgba(239,233,222,.3)');
  ctx.font = `700 ${Math.round(u * .03)}px Manrope`; ctx.fillStyle = '#f4efe6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', cx + nx * cr * 1.42, cy + ny * cr * 1.42);
  // The map gives way to the words.
  const fade = portrait ? ctx.createLinearGradient(0, map.y + map.h * .72, 0, map.y + map.h) : ctx.createLinearGradient(map.x + map.w * .7, 0, map.x + map.w, 0);
  fade.addColorStop(0, 'rgba(4,4,5,0)'); fade.addColorStop(1, '#040405');
  ctx.globalAlpha = 1; ctx.fillStyle = fade; ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.restore();
}

function drawScreen(ctx, destinations, t, portrait, clock = 0) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#040405'; ctx.fillRect(0, 0, w, h);
  const u = portrait ? w : h; // the layout's unit
  const fadeIn = a => clamp01((t - a) / .18);
  const tracked = px => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(px)}px`; };
  const bar = u * .145, side = portrait ? w * .09 : h * .3;
  const map = portrait ? { x: 0, y: bar, w, h: h * .46 } : { x: 0, y: bar, w: w * .6, h: h - bar };
  // The destination being shown, and the one it follows.
  const reached = destinations.filter(d => d.at);
  const slot = Math.floor(clock / SLOT), phase = clock - slot * SLOT;
  const at = reached.length ? slot % reached.length : 0, place = reached[at], before = reached[(at - 1 + reached.length) % reached.length];
  const k = !slot ? smooth(fadeIn(.22)) : smooth(clamp01(phase / TURN_IN)); // how far it has arrived

  drawMap(ctx, map, { u, side, t, clock, portrait, name: place?.name, fadeIn, tracked });

  // ----------------------------------------------------- the status bar
  ctx.globalAlpha = fadeIn(0);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e2b56c';
  ctx.beginPath(); ctx.moveTo(side, bar * .5 - u * .03); ctx.lineTo(side + u * .024, bar * .5 + u * .025); ctx.lineTo(side, bar * .5 + u * .01); ctx.lineTo(side - u * .024, bar * .5 + u * .025); ctx.closePath(); ctx.fill();
  ctx.font = `600 ${Math.round(u * .036)}px Manrope`; ctx.fillStyle = 'rgba(239,233,222,.74)'; ctx.textAlign = 'left';
  tracked(u * .011);
  ctx.fillText('NAVIGATION', side + u * .058, bar * .5 + u * .002);
  ctx.textAlign = 'right';
  ctx.font = `500 ${Math.round(u * .05)}px Manrope`; ctx.fillStyle = '#f4efe6';
  tracked(u * .003);
  const time = IST.format(new Date()).toUpperCase(), timeWidth = ctx.measureText(time).width;
  ctx.fillText(time, w - side, bar * .5 + u * .002);
  ctx.font = `600 ${Math.round(u * .036)}px Manrope`; ctx.fillStyle = 'rgba(167,156,141,.9)';
  tracked(u * .011);
  // A tall screen has room for the zone only.
  ctx.fillText(portrait ? 'IST' : 'NEW DELHI \u00b7 IST', w - side - timeWidth - u * .05, bar * .5 + u * .002);
  tracked(0);
  ctx.fillStyle = 'rgba(239,233,222,.1)'; ctx.fillRect(0, bar, w, Math.max(1, u * .002));

  // ----------------------------------------------------------- the words
  const left = portrait ? side : w * .635, right = w - side, room = right - left;
  const top = portrait ? map.y + map.h + u * .05 : bar, foot = h - (portrait ? u * .16 : u * .13);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = top + u * (portrait ? .1 : .155);
  ctx.globalAlpha = fadeIn(.1);
  ctx.font = `600 ${Math.round(u * .036)}px Manrope`; ctx.fillStyle = '#d5b27b';
  tracked(u * .011);
  ctx.fillText('DELIVERED TO', left, y);
  if (reached.length) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(167,156,141,.9)'; ctx.fillText(`${String(at + 1).padStart(2, '0')} / ${String(reached.length).padStart(2, '0')}`, right, y); }
  tracked(0);
  if (place) {
    // The name, as large as the longest of them allows; the one before it
    // leaves upwards as this one arrives from below.
    ctx.font = '300 100px Newsreader';
    const widest = Math.max(...reached.map(d => ctx.measureText(d.name).width));
    const size = Math.min(u * (portrait ? .2 : .215), room / widest * 100), rise = size * .22;
    y += size * 1.12;
    ctx.font = `300 ${Math.round(size)}px Newsreader`; ctx.textAlign = 'left'; ctx.fillStyle = '#f4efe6';
    if (slot && k < 1) { ctx.globalAlpha = (1 - k) * (1 - k); ctx.fillText(before.name, left, y - k * rise); }
    ctx.globalAlpha = k * fadeIn(.16);
    ctx.fillText(place.name, left, y + (1 - k) * rise);
    // How far, and in which part of the country.
    const from = slot ? before.at : { d: 0, bearing: place.at.bearing }, km = Math.round(lerp(from.d, place.at.d, k) / 10) * 10;
    const figure = u * (portrait ? .12 : .125);
    y += figure * 1.32;
    ctx.globalAlpha = fadeIn(.24);
    ctx.font = `300 ${Math.round(figure)}px Newsreader`; ctx.fillStyle = '#e2b56c';
    const text = km.toLocaleString('en-IN'), wide = ctx.measureText(text).width;
    ctx.fillText(text, left, y);
    ctx.font = `italic 300 ${Math.round(figure * .5)}px Newsreader`;
    ctx.fillText('km', left + wide + figure * .12, y);
    ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(u * .036)}px Manrope`; ctx.fillStyle = 'rgba(239,233,222,.74)';
    tracked(u * .009);
    ctx.fillText(((slot && k <= .5 ? before : place).region ?? '').toUpperCase(), right, y - figure * .08);
    tracked(0);
    // The line: lit as far as that is.
    y += u * .075;
    const hair = Math.max(1, u * .0028), reach = left + room * Math.min(1, lerp(from.d, place.at.d, k) / REACH);
    ctx.fillStyle = 'rgba(213,178,123,.2)'; ctx.fillRect(left, y, room, hair);
    const glow = ctx.createLinearGradient(left, 0, reach, 0);
    glow.addColorStop(0, 'rgba(242,191,94,.15)'); glow.addColorStop(1, 'rgba(255,214,140,.95)');
    ctx.fillStyle = glow; ctx.fillRect(left, y - hair * .4, reach - left, hair * 1.8);
    ctx.save(); ctx.shadowColor = 'rgba(255,214,140,.9)'; ctx.shadowBlur = u * .03;
    ctx.fillStyle = '#fff1d2'; ctx.beginPath(); ctx.arc(reach, y + hair / 2, u * .009, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = `500 ${Math.round(u * .034)}px Manrope`; ctx.fillStyle = 'rgba(167,156,141,.9)';
    tracked(u * .004);
    ctx.fillText('Aerial distance from our Delhi showroom', left, y + u * .07);
    tracked(0);
  }
  // What they add up to.
  ctx.globalAlpha = fadeIn(.4);
  ctx.textAlign = 'left';
  ctx.font = 'italic 300 100px Newsreader';
  const sentence = 'From Kashmir to Kanyakumari.', fit = Math.min(u * (portrait ? .105 : .092), room / ctx.measureText(sentence).width * 100);
  ctx.font = `italic 300 ${Math.round(fit)}px Newsreader`; ctx.fillStyle = '#e9dcc6';
  ctx.fillText(sentence, left, foot);
  ctx.globalAlpha = 1;
}

// The value arc inside a dial's indices: lit from zero to the reading.
function arcMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uValue: { value: 0 }, uLit: { value: 0 }, uColor: { value: new THREE.Color('#f2bf5e') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uValue; uniform float uLit; uniform vec3 uColor; varying vec2 vP;
      void main() {
        float f = (atan(vP.x, vP.y) - (${START.toFixed(6)})) / ${SWEEP.toFixed(6)};
        if (f < 0.0 || f > uValue) discard;
        float head = 0.5 + 0.5 * smoothstep(uValue - 0.2, uValue, f);
        gl_FragColor = vec4(uColor * uLit * head, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// A flat line of light along a path in the plane `z`, `width` wide: its
// segments in order, so drawing part of it draws the line part-way along.
// u runs along it, v across.
function ribbon(points, width, segments, z) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lengths.at(-1), at = d => {
    let i = 1; while (i < lengths.length - 1 && lengths[i] < d) i++;
    const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    return points[i - 1].clone().lerp(points[i], t);
  };
  const samples = Array.from({ length: segments + 1 }, (_, i) => at(total * i / segments));
  const position = [], uv = [], index = [];
  samples.forEach((p, i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(segments, i + 1)];
    const t = b.clone().sub(a).normalize(), n = new THREE.Vector2(-t.y, t.x).multiplyScalar(width / 2);
    position.push(p.x + n.x, p.y + n.y, z, p.x - n.x, p.y - n.y, z);
    uv.push(i / segments, 0, i / segments, 1);
    if (i) { const k = i * 2; index.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}
// The spill's falloff across its width: bright at the line, gone at the edges.
function spillGradient() {
  const c = sheet(4, 128), ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#000'); g.addColorStop(.42, '#2a2a2a'); g.addColorStop(.5, '#fff'); g.addColorStop(.58, '#2a2a2a'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// What the lacquer, chrome and glass reflect: a black studio with long strip
// softboxes overhead and to either side, and a dim wash low behind, all
// placed outside the flat lacquer's mirror (which looks back past the
// viewer), so the dash stays black while every curve, bevel and lens draws a
// clean line of light, and the faces catch the overhead strip as they turn.
// The metals and the walnut see the same studio with one more light: a soft
// warm bounce card behind the viewer, as a jeweller's photograph has, so gold
// and chrome facing out read as gold and chrome, not as the dark they face.
function studioLights(jewel = false) {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#000000');
  const strip = (w, h, power, color, at) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    panel.position.set(...at); panel.lookAt(0, 0, 0); room.add(panel);
  };
  strip(16, .9, 1.1, '#fff1dc', [0, 6, .6]);
  strip(.9, 9, 1.7, '#e6ecff', [-7, 1.2, 1.4]);
  strip(.9, 9, 1.3, '#ffe0b8', [7, .6, .8]);
  strip(14, 3, .22, '#ffffff', [0, -3.5, -6]);
  if (jewel) strip(12, 5, 1.6, '#ffe6c4', [0, 2.2, 8]);
  return room;
}

// ------------------------------------------------------------------ scene
export function createFascia(section, { readings: figures, destinations = [] }) {
  const readings = figures.map(reading => ({ ...reading, scale: scaleFor(reading) }));
  const stage = section.querySelector('[data-fascia-stage]');
  const canvas = stage.querySelector('canvas');
  const slot = section.querySelector('[data-fascia-slot]');
  const phone = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: phone, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor('#050506', 1);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050506');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const bake = jewel => { const room = studioLights(jewel), target = pmrem.fromScene(room, .02); room.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); return target; };
  const environment = bake(false), jewelled = bake(true);
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 1;
  // A warm light from high above, raking down across the display, and a key
  // from the upper left for the dials' sunburst. Both are distant lights:
  // their mirror images in the flat lacquer fall far outside any frame, so
  // the dash stays black on every screen.
  const above = new THREE.DirectionalLight('#fff0dc', 1.3);
  above.position.set(0, 5, .9); scene.add(above);
  const key = new THREE.DirectionalLight('#ffe8c6', 1.7);
  key.position.set(-3, 4, 5); scene.add(key);

  const camera = new THREE.PerspectiveCamera(24, 1, .1, 60);
  let composer = null, sharpen = null, bloom = null;
  if (!phone) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .32, .3, 1.02);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    sharpen = new ShaderPass(SHARPEN);
    sharpen.uniforms.uSharpness.value = .45;
    composer.addPass(sharpen);
  }
  const render = () => composer ? composer.render() : renderer.render(scene, camera);

  const density = createRenderDensity({ mobile: phone });
  const state = { progress: 0, turn: 0, depth: 0, vTurn: 0, vDepth: 0, face: 0, ready: false, active: false, disposed: false, light: 0, lean: [0, 0], leanTarget: [0, 0] };
  let size = { w: 1, h: 1 }, display = null, portrait = STACKED.matches, raf = 0, last = performance.now(), dirty = true;
  let logo = null, places = [];
  const woods = {};
  // Running tweens draw as they update (each wakes the loop).
  const timelines = new Set();
  const track = tl => { timelines.add(tl); return tl; };
  const changed = () => { dirty = true; wake(); };

  // ------------------------------------------------------------ the dash
  // Piano-black lacquer round an opening a hair larger than a face; the
  // ambient light runs round the opening and across the dash beneath it.
  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: .6 });
  // The line's core stays under the bloom's threshold (a hairline would
  // bloom only where it happens to cover a pixel fully, in beads); its glow
  // is the spill's.
  const ambient = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd08a').multiplyScalar(.98) });
  const spill = new THREE.MeshBasicMaterial({ map: spillGradient(), color: new THREE.Color('#ff9f3a').multiplyScalar(.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dash = new THREE.Group();
  scene.add(dash);
  const lights = [];
  function buildDash(W, H) {
    dash.children.slice().forEach(child => { child.geometry.dispose(); dash.remove(child); });
    lights.length = 0;
    const gap = .022, bevel = .018, depth = .32;
    const outer = new THREE.Shape();
    outer.moveTo(-9, -6); outer.lineTo(9, -6); outer.lineTo(9, 6); outer.lineTo(-9, 6); outer.closePath();
    const hw = W / 2 + gap + bevel, hh = H / 2 + gap + bevel, r = .045;
    const hole = new THREE.Path();
    hole.moveTo(-hw + r, -hh); hole.lineTo(hw - r, -hh); hole.quadraticCurveTo(hw, -hh, hw, -hh + r); hole.lineTo(hw, hh - r); hole.quadraticCurveTo(hw, hh, hw - r, hh);
    hole.lineTo(-hw + r, hh); hole.quadraticCurveTo(-hw, hh, -hw, hh - r); hole.lineTo(-hw, -hh + r); hole.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    outer.holes.push(hole);
    const panel = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 10 });
    panel.translate(0, 0, .014 - depth - bevel);
    dash.add(new THREE.Mesh(panel, lacquer));
    // The light: two halves from the top centre round to the bottom centre,
    // and the strip beneath, from the centre outwards. Each is a fine line
    // lying on the lacquer and a soft spill of its light either side.
    const lw = W / 2 + .1, lh = H / 2 + .1, lr = .07, z = .0145;
    const half = sign => {
      const points = [new THREE.Vector2(0, lh)];
      for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 - i / 10 * Math.PI / 2; points.push(new THREE.Vector2(sign * (lw - lr + Math.cos(a) * lr), lh - lr + Math.sin(a) * lr)); }
      for (let i = 0; i <= 10; i++) { const a = -i / 10 * Math.PI / 2; points.push(new THREE.Vector2(sign * (lw - lr + Math.cos(a) * lr), -(lh - lr) + Math.sin(a) * lr)); }
      points.push(new THREE.Vector2(0, -lh));
      return points;
    };
    const sy = -H / 2 - .2;
    const runs = [half(1), half(-1), [new THREE.Vector2(0, sy), new THREE.Vector2(9, sy)], [new THREE.Vector2(0, sy), new THREE.Vector2(-9, sy)]];
    runs.forEach((points, i) => {
      const segments = i < 2 ? 360 : 260;
      for (const [width, material, lift] of [[.003, ambient, .0004], [.06, spill, 0]]) {
        const geometry = ribbon(points, width * (i < 2 ? 1 : .8), segments, z + lift);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 1;
        lights.push({ mesh, total: geometry.index.count });
        dash.add(mesh);
      }
    });
    showLight();
  }
  function showLight() {
    const k = smooth(state.light);
    lights.forEach(({ mesh, total }) => mesh.geometry.setDrawRange(0, Math.floor(total * k / 6) * 6));
  }

  // ---------------------------------------------------------- the display
  const disposables = new Set();
  const keep = thing => { disposables.add(thing); return thing; };
  const jewel = { envMap: jewelled.texture };
  const chrome = keep(new THREE.MeshPhysicalMaterial({ ...jewel, envMapIntensity: .3, color: '#ece6dc', metalness: 1, roughness: .26, clearcoat: .25 }));
  const darkChrome = keep(new THREE.MeshPhysicalMaterial({ ...jewel, color: '#2b2a29', metalness: 1, roughness: .28 }));
  const gold = keep(new THREE.MeshPhysicalMaterial({ ...jewel, color: '#dcab5d', metalness: 1, roughness: .2, clearcoat: .3 }));
  const endMetal = keep(new THREE.MeshStandardMaterial({ color: '#1c1b1a', metalness: .9, roughness: .4, side: THREE.DoubleSide }));
  const blackLacquer = keep(new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: .2, clearcoat: 1, clearcoatRoughness: .03 }));

  function texture(source, srgb = true) {
    const t = keep(new THREE.CanvasTexture(source));
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
    return t;
  }

  function buildDisplay() {
    if (display) { scene.remove(display.root); display.dispose(); }
    portrait = STACKED.matches;
    const W = portrait ? 1.36 : 3.4, H = portrait ? 3.3 : 1.06;
    const side = portrait ? W : H, length = portrait ? H : W;
    const inradius = side / (2 * Math.sqrt(3)), circumradius = side / Math.sqrt(3);
    const local = new Set();
    const own = thing => { local.add(thing); return thing; };
    const root = new THREE.Group(), drum = new THREE.Group();
    root.add(drum);
    const faceGroup = k => {
      const pivot = new THREE.Group();
      if (portrait) pivot.rotation.y = -k * TURN; else pivot.rotation.x = -k * TURN;
      const face = new THREE.Group();
      face.position.z = inradius;
      pivot.add(face); drum.add(pivot);
      return face;
    };
    // The prism's edges and ends.
    for (let k = 0; k < 3; k++) {
      const phi = Math.PI / 3 + k * TURN;
      const edge = new THREE.Mesh(own(new THREE.CylinderGeometry(.011, .011, length, 12)), darkChrome);
      if (portrait) edge.position.set(circumradius * Math.sin(phi), 0, circumradius * Math.cos(phi));
      else { edge.rotation.z = Math.PI / 2; edge.position.set(0, circumradius * Math.sin(phi), circumradius * Math.cos(phi)); }
      drum.add(edge);
    }
    for (const end of [-1, 1]) {
      const points = [0, 1, 2].map(k => { const phi = Math.PI / 3 + k * TURN; return portrait ? [circumradius * Math.sin(phi), end * length / 2, circumradius * Math.cos(phi)] : [end * length / 2, circumradius * Math.sin(phi), circumradius * Math.cos(phi)]; });
      const cap = own(new THREE.BufferGeometry());
      cap.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
      cap.computeVertexNormals();
      drum.add(new THREE.Mesh(cap, endMetal));
    }

    // Face one: the walnut.
    const wood = woods[portrait ? 'tall' : 'wide'] ||= runNow(walnut(W, H, !portrait, logo));
    const veneer = new THREE.Mesh(own(new THREE.PlaneGeometry(W, H)), own(new THREE.MeshPhysicalMaterial({
      ...jewel, envMapIntensity: .75, map: own(texture(wood.color)), roughnessMap: own(texture(wood.finish, false)), metalnessMap: own(texture(wood.finish, false)),
      roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: .05, anisotropy: .35, anisotropyRotation: portrait ? Math.PI / 2 : 0,
    })));
    faceGroup(0).add(veneer);

    // Face two: the dials.
    const dialsFace = faceGroup(1);
    dialsFace.add(new THREE.Mesh(own(new THREE.PlaneGeometry(W, H)), blackLacquer));
    const spacing = (portrait ? H : W) / 3, R = Math.min((portrait ? W : H) * .42, spacing * .43);
    const dials = readings.map((reading, i) => {
      const group = new THREE.Group();
      const offset = (i - 1) * spacing;
      if (portrait) group.position.y = -offset; else group.position.x = offset;
      dialsFace.add(group);
      const printed = dialFace(reading.scale);
      const glowMap = own(texture(printed.glow));
      const plate = new THREE.Mesh(own(new THREE.CircleGeometry(R * .96, 96)), own(new THREE.MeshPhysicalMaterial({
        map: own(texture(printed.base)), emissiveMap: glowMap, emissive: new THREE.Color('#ffdcaa'), emissiveIntensity: 0,
        roughness: .4, metalness: .35, anisotropy: .75, anisotropyMap: sunburst(), clearcoat: .5, clearcoatRoughness: .06, envMapIntensity: .8,
      })));
      plate.position.z = .002;
      group.add(plate);
      // Applied gold indices at the major marks.
      const marks = Math.round(reading.scale.max / reading.scale.major) + 1;
      const indices = new THREE.InstancedMesh(own(new THREE.BoxGeometry(R * .024, R * .1, .007)), gold, marks);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let k = 0; k < marks; k++) {
        const a = START + SWEEP * k / (marks - 1);
        p.set(Math.sin(a) * R * .742, Math.cos(a) * R * .742, .006); q.setFromEuler(e.set(0, 0, -a));
        indices.setMatrixAt(k, m.compose(p, q, one));
      }
      group.add(indices);
      const arc = new THREE.Mesh(own(new THREE.RingGeometry(R * .655, R * .675, 180)), own(arcMaterial()));
      arc.position.z = .004;
      group.add(arc);
      // The readout, redrawn only as its figure changes.
      const readoutCanvas = sheet(512, 288), readoutMap = own(texture(readoutCanvas));
      const readout = new THREE.Mesh(own(new THREE.PlaneGeometry(R, R * .5625)), own(new THREE.MeshBasicMaterial({ map: readoutMap, transparent: true, depthWrite: false })));
      readout.position.set(0, -R * .47, .005);
      group.add(readout);
      // The needle: polished gold, its outer half lit, with its shadow on
      // the face beneath, offset as the key light throws it.
      const needleShape = new THREE.Shape();
      needleShape.moveTo(-R * .03, -R * .17); needleShape.lineTo(R * .03, -R * .17); needleShape.lineTo(R * .016, 0); needleShape.lineTo(R * .0045, R * .77); needleShape.lineTo(-R * .0045, R * .77); needleShape.lineTo(-R * .016, 0); needleShape.closePath();
      const needleGeometry = own(new THREE.ExtrudeGeometry(needleShape, { depth: .005, bevelEnabled: true, bevelThickness: .0015, bevelSize: .0012, bevelSegments: 2 }));
      const needleMaterial = own(new THREE.MeshPhysicalMaterial({ ...jewel, color: '#f3e4c6', metalness: 1, roughness: .2, emissive: new THREE.Color('#ffb54a'), emissiveIntensity: 0 }));
      const needle = new THREE.Mesh(needleGeometry, needleMaterial);
      needle.position.z = .026;
      const tipShape = new THREE.Shape();
      tipShape.moveTo(-R * .007, R * .42); tipShape.lineTo(R * .007, R * .42); tipShape.lineTo(R * .0035, R * .765); tipShape.lineTo(-R * .0035, R * .765); tipShape.closePath();
      const tipMaterial = own(new THREE.MeshBasicMaterial({ color: '#ffd68a' }));
      const tip = new THREE.Mesh(own(new THREE.ShapeGeometry(tipShape)), tipMaterial);
      tip.position.z = .0335;
      const shadowMaterial = own(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .5, depthWrite: false }));
      const shadow = new THREE.Mesh(own(new THREE.ShapeGeometry(needleShape)), shadowMaterial);
      const shadowHolder = new THREE.Group();
      shadowHolder.position.set(R * .02, -R * .03, .0055);
      shadowHolder.add(shadow);
      const spin = new THREE.Group();
      spin.add(needle, tip);
      group.add(spin, shadowHolder);
      const hub = new THREE.Mesh(own(new THREE.CylinderGeometry(R * .072, R * .08, .022, 48)), chrome);
      hub.rotation.x = Math.PI / 2; hub.position.z = .036;
      group.add(hub);
      // The knurled chrome bezel and the domed lens.
      const profile = [[.955, 0], [.962, .028], [.985, .045], [1.04, .048], [1.085, .04], [1.108, .022], [1.112, 0]].map(([r, z]) => new THREE.Vector2(r * R, z));
      const bezelGeometry = own(new THREE.LatheGeometry(profile, 160));
      bezelGeometry.rotateX(Math.PI / 2);
      const bezelMaterial = own(chrome.clone());
      bezelMaterial.bumpMap = knurl(); bezelMaterial.bumpScale = .8; bezelMaterial.side = THREE.DoubleSide;
      group.add(new THREE.Mesh(bezelGeometry, bezelMaterial));
      const lensR = R * .965, sag = .022, rho = (lensR * lensR + sag * sag) / (2 * sag), theta = Math.asin(lensR / rho);
      const lensGeometry = own(new THREE.SphereGeometry(rho, 64, 6, 0, Math.PI * 2, 0, theta));
      lensGeometry.rotateX(Math.PI / 2);
      lensGeometry.translate(0, 0, .044 - rho * Math.cos(theta));
      const lens = new THREE.Mesh(lensGeometry, own(glassFinish(new THREE.MeshPhysicalMaterial({ ...jewel, color: '#0b0b0c', roughness: .03, metalness: 0, opacity: .05, ior: 1.5, specularIntensity: 1, envMapIntensity: .32 }))));
      lens.renderOrder = 2;
      group.add(lens);
      const dial = { reading, R, plate, arc, readout, readoutCanvas, readoutMap, spin, shadow, needleMaterial, tipMaterial, value: 0, lit: 0, shown: null };
      paintDial(dial, true);
      return dial;
    });

    // Face three: the navigation screen.
    const screenFace = faceGroup(2);
    screenFace.add(new THREE.Mesh(own(new THREE.PlaneGeometry(W, H)), blackLacquer));
    const inset = .05, sw = W - inset * 2, sh = H - inset * 2;
    const screenCanvas = portrait ? sheet(1600 * sw / sh, 1600) : sheet(2048, 2048 * sh / sw);
    const screenMap = own(texture(screenCanvas));
    const screenMaterial = own(new THREE.MeshPhysicalMaterial({ color: '#010101', roughness: .4, metalness: 0, clearcoat: .7, clearcoatRoughness: .02, envMapIntensity: .6, emissive: new THREE.Color('#ffffff'), emissiveMap: screenMap, emissiveIntensity: 0 }));
    const screen = new THREE.Mesh(own(new THREE.PlaneGeometry(sw, sh)), screenMaterial);
    screen.position.z = .001;
    screenFace.add(screen);
    const screenState = { canvas: screenCanvas, map: screenMap, material: screenMaterial, t: 0, glow: 0, clock: 0 };

    scene.add(root);
    buildDash(W, H);
    display = {
      root, drum, W, H, portrait, inradius, dials, screen: screenState,
      dispose() { local.forEach(thing => thing.dispose?.()); },
    };
    paintScreen();
    pose();
  }

  // ----------------------------------------------------------- the dials
  const fmt = n => String(Math.round(n * 10) / 10);
  function paintDial(dial, force = false) {
    const { reading } = dial;
    const angle = START + SWEEP * Math.min(1, Math.max(0, dial.value / reading.scale.max));
    dial.spin.rotation.z = -angle;
    dial.shadow.rotation.z = -angle;
    dial.arc.material.uniforms.uValue.value = clamp01(dial.value / reading.scale.max);
    dial.arc.material.uniforms.uLit.value = dial.lit * 2.2;
    dial.plate.material.emissiveIntensity = dial.lit * 1.1;
    dial.needleMaterial.emissiveIntensity = dial.lit * .3;
    dial.tipMaterial.color.set('#ffd68a').multiplyScalar(.25 + dial.lit * 2.1);
    dial.readout.material.color.setScalar(.22 + dial.lit * .7);
    // The figure counts with the needle's last rise only.
    const shown = dial.counting ? Math.min(reading.value, Math.floor(dial.value + 1e-6)) : dial.done ? reading.value : 0;
    if (shown !== dial.shown || force) {
      dial.shown = shown;
      drawReadout(dial.readoutCanvas.getContext('2d'), fmt(shown), reading.suffix, reading.label);
      dial.readoutMap.needsUpdate = true;
    }
  }
  let dialsOn = false, screenOn = false, dialsRun = null, screenRun = null;
  function ignite() {
    dialsOn = true;
    dialsRun?.kill();
    display.dials.forEach(dial => gsap.killTweensOf(dial));
    const tl = gsap.timeline({ onUpdate: changed });
    display.dials.forEach((dial, i) => {
      dial.done = false; dial.counting = false;
      const max = dial.reading.scale.max, at = i * .08;
      tl.to(dial, { lit: 1, duration: .5, ease: 'power2.out', onUpdate: () => paintDial(dial) }, at)
        .to(dial, { value: max, duration: .7, ease: 'power2.inOut', onUpdate: () => paintDial(dial) }, at + .2)
        .to(dial, { value: 0, duration: .62, ease: 'power2.in', onUpdate: () => paintDial(dial) }, at + .95)
        .add(() => { dial.counting = true; }, at + 1.62)
        .to(dial, { value: dial.reading.value, duration: 1.5, ease: 'elastic.out(1, .62)', onUpdate: () => paintDial(dial), onComplete: () => { dial.counting = false; dial.done = true; paintDial(dial); } }, at + 1.62);
    });
    dialsRun = track(tl);
    wake();
  }
  // A touch of throttle: a dial under the pointer blips its needle.
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let hovered = null;
  function hover(event) {
    if (!display || !dialsOn || state.face !== 1) { hovered = null; return; }
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(display.dials.map(dial => dial.plate), false)[0];
    const dial = hit ? display.dials.find(d => d.plate === hit.object) : null;
    if (dial === hovered) return;
    hovered = dial;
    if (!dial?.done) return;
    const { value, scale } = dial.reading;
    gsap.killTweensOf(dial);
    track(gsap.timeline({ onUpdate: changed })
      .to(dial, { value: Math.min(scale.max, value + scale.max * .09), duration: .2, ease: 'power2.out', onUpdate: () => paintDial(dial) })
      .to(dial, { value, duration: 1.2, ease: 'elastic.out(1, .4)', onUpdate: () => paintDial(dial) }));
  }
  function douse() {
    dialsOn = false;
    dialsRun?.kill();
    display.dials.forEach(dial => gsap.killTweensOf(dial));
    const tl = gsap.timeline({ onUpdate: changed });
    display.dials.forEach(dial => { dial.counting = false; tl.to(dial, { lit: 0, value: 0, duration: .5, ease: 'power2.inOut', onUpdate: () => paintDial(dial), onComplete: () => { dial.done = false; paintDial(dial); } }, 0); });
    dialsRun = track(tl);
    wake();
  }

  // ----------------------------------------------------------- the screen
  // While it faces out the screen runs, as a car's does: the streets pass
  // under the route and the destinations take their turn. It is painted
  // some thirty times a second, and not at all once it has turned away, the
  // section has left the screen or the tab is hidden.
  function paintScreen() {
    const s = display.screen;
    s.material.emissiveIntensity = s.glow * 1.05;
    drawScreen(s.canvas.getContext('2d'), places, s.t, display.portrait, s.clock);
    s.map.needsUpdate = true;
  }
  let screenAt = 0, painted = 0;
  function screenTick() {
    if (!screenOn || !display || !state.active || document.hidden) { screenAt = 0; return; }
    const now = performance.now();
    if (now - screenAt < 32) return;
    display.screen.clock += screenAt ? Math.min(.1, (now - screenAt) / 1000) : 0;
    screenAt = now;
    paintScreen();
    if (import.meta.env.DEV) painted = Math.max(painted * .96, performance.now() - now);
    changed();
  }
  function screenUp() {
    screenOn = true;
    screenRun?.kill();
    const s = display.screen;
    s.clock = 0; screenAt = 0;
    screenRun = track(gsap.timeline({ onUpdate: changed })
      .to(s, { glow: 1, duration: .5, ease: 'power2.out' }, 0)
      .fromTo(s, { t: 0 }, { t: 1, duration: 2.8, ease: 'power1.inOut' }, .1));
    gsap.ticker.add(screenTick);
    wake();
  }
  function screenDown() {
    screenOn = false;
    gsap.ticker.remove(screenTick);
    screenRun?.kill();
    const s = display.screen;
    screenRun = track(gsap.timeline({ onUpdate: () => { s.material.emissiveIntensity = s.glow * 1.05; changed(); }, onComplete: () => { s.t = 0; s.clock = 0; paintScreen(); changed(); } })
      .to(s, { glow: 0, duration: .45, ease: 'power2.in' }, 0));
    wake();
  }

  // ---------------------------------------------------------- the motion
  // The scroll's target for the drum: which way round, and how far back.
  function targets(p) {
    for (let i = 0; i < 2; i++) {
      const a = HOLDS[i][1], b = HOLDS[i + 1][0];
      if (p <= a) return { turn: i, depth: 0 };
      if (p < b) {
        const t = (p - a) / (b - a);
        return { turn: i + smooth(smooth(clamp01((t - .2) / .6))), depth: smooth(clamp01(t / .24)) * (1 - smooth(clamp01((t - .76) / .24))) };
      }
    }
    return { turn: 2, depth: 0 };
  }
  // A spring a little short of critical damping: the drum carries its
  // weight into each face and settles with the faintest detent.
  function spring(dt) {
    const goal = targets(state.progress), k = 110, c = 2 * Math.sqrt(k) * .74;
    let moving = false;
    for (let s = 0; s < 4; s++) {
      const h = dt / 4;
      state.vTurn += (k * (goal.turn - state.turn) - c * state.vTurn) * h; state.turn += state.vTurn * h;
      state.vDepth += (k * (goal.depth - state.depth) - c * state.vDepth) * h; state.depth += state.vDepth * h;
    }
    if (Math.abs(goal.turn - state.turn) > 1e-4 || Math.abs(state.vTurn) > 1e-4 || Math.abs(goal.depth - state.depth) > 1e-4 || Math.abs(state.vDepth) > 1e-4) moving = true;
    else { state.turn = goal.turn; state.depth = goal.depth; state.vTurn = state.vDepth = 0; }
    return moving;
  }
  const look = new THREE.Vector3(), eye = new THREE.Vector3();
  let frameDistance = 7, offset = [0, 0];
  function pose() {
    if (!display) return;
    const { drum, root, inradius } = display;
    if (display.portrait) drum.rotation.y = state.turn * TURN; else drum.rotation.x = state.turn * TURN;
    root.position.z = -inradius - state.depth * RETRACT;
    // The view swings a little to the side while the display turns, so its
    // depth reads, and leans with the pointer.
    const swing = state.depth;
    eye.set(swing * .55 + state.lean[0] * .3, .08 + swing * .22 + state.lean[1] * .18, frameDistance);
    look.set(0, 0, -.25);
    camera.position.copy(eye);
    camera.lookAt(look);
  }
  // The arrivals: the dials light as they come to rest facing out, the
  // screen draws; each goes dark once it has turned away.
  function arrivals() {
    const face = Math.round(state.turn), resting = Math.abs(state.turn - face) < .02 && state.depth < .04;
    if (resting && face !== state.face) setFace(face);
    if (resting && face === 1 && !dialsOn) ignite();
    if (resting && face === 2 && !screenOn) screenUp();
    if (dialsOn && Math.abs(state.turn - 1) > .3) douse();
    if (screenOn && Math.abs(state.turn - 2) > .3) screenDown();
  }

  function setFace(face) { state.face = face; section.dataset.face = String(face); }

  // -------------------------------------------------------------- frames
  function layout() {
    size = { w: stage.clientWidth || innerWidth, h: stage.clientHeight || innerHeight };
    const ratio = density.ratio(size.w, size.h);
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    if (composer) {
      composer.setPixelRatio(ratio);
      composer.setSize(size.w, size.h);
      bloom.resolution.set(size.w * ratio / 2, size.h * ratio / 2);
      sharpen.uniforms.uTexel.value.set(1 / (size.w * ratio), 1 / (size.h * ratio));
    }
    if (display && display.portrait !== STACKED.matches) buildDisplay();
    frameDisplay();
    dirty = true;
    wake();
  }
  // The display fills the slot the page's layout leaves for it.
  function frameDisplay() {
    camera.aspect = size.w / size.h;
    camera.fov = portrait ? 30 : 24;
    if (!display) { camera.updateProjectionMatrix(); return; }
    const stageRect = stage.getBoundingClientRect(), slotRect = slot.getBoundingClientRect();
    const sw = Math.max(40, slotRect.width), sh = Math.max(40, slotRect.height);
    const span = 2 * Math.tan(camera.fov * Math.PI / 360);
    const needW = (display.W + .22) / (sw / size.w * span * camera.aspect), needH = (display.H + .22) / (sh / size.h * span);
    frameDistance = Math.max(needW, needH) + .25;
    offset = [slotRect.left + sw / 2 - (stageRect.left + size.w / 2), slotRect.top + sh / 2 - (stageRect.top + size.h / 2)];
    camera.setViewOffset(size.w, size.h, -offset[0], -offset[1], size.w, size.h);
    camera.updateProjectionMatrix();
    pose();
  }
  function draw(now) {
    raf = 0;
    if (state.disposed || !state.ready) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (density.slow(now) && density.step(size.w, size.h)) layout();
    let moving = spring(dt);
    const lx = state.leanTarget[0] - state.lean[0], ly = state.leanTarget[1] - state.lean[1];
    if (Math.abs(lx) + Math.abs(ly) > 1e-4) { state.lean[0] += lx * Math.min(1, dt * 4); state.lean[1] += ly * Math.min(1, dt * 4); moving = true; }
    pose();
    arrivals();
    if (moving || dirty) render();
    dirty = false;
    if (moving && state.active && !document.hidden) raf = requestAnimationFrame(draw);
  }
  function wake() {
    if (raf || !state.active || !state.ready || state.disposed || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------- loading
  async function load() {
    logo = new Image();
    logo.src = LOGO;
    await Promise.all([
      logo.decode().catch(() => { logo = null; }),
      document.fonts.load('300 64px Newsreader'), document.fonts.load('italic 300 64px Newsreader'),
      document.fonts.load('600 24px Manrope'), document.fonts.load('500 24px Manrope'),
    ]);
    if (state.disposed) return;
    setPlaces(destinations, false);
    // The walnut is the long drawing: a band at a time.
    const tall = STACKED.matches;
    woods[tall ? 'tall' : 'wide'] = await runSoon(walnut(tall ? 1.36 : 3.4, tall ? 3.3 : 1.06, !tall, logo));
    if (state.disposed) return;
    buildDisplay();
    layout();
    await compileAhead(renderer, scene, camera);
    if (state.disposed) return;
    state.ready = true;
    section.classList.add('is-ready');
    if (pinned.progress > 0 || scrollY >= arrival.start) lightUp();
    render();
    wake();
  }
  function setPlaces(list, repaint = true) {
    const seen = new Set();
    places = list.filter(name => name && !seen.has(placeKey(name)) && seen.add(placeKey(name))).map(name => {
      const at = PLACES[placeKey(name)];
      const route = at ? fromDelhi(at) : null;
      // New Delhi itself, and its neighbours, are home: named, not plotted.
      return { name, region: at ? regionOf(placeKey(name)) : null, at: route && route.d > 80 ? route : null };
    });
    if (repaint && display) { paintScreen(); dirty = true; wake(); }
  }

  // -------------------------------------------------------------- scroll
  // The cabin wakes as the section arrives: the ambient light traces round.
  // Once, however the section is reached (scrolled to, jumped to, or
  // already in view when the display loads). Declared before the pin: made
  // on a page already scrolled past this section, the pin reports its
  // progress, and so calls this, as it is created.
  let woken = false;
  const lightUp = () => {
    if (woken) return;
    woken = true;
    track(gsap.to(state, { light: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: () => { showLight(); changed(); } }));
  };
  const pinned = ScrollTrigger.create({
    trigger: section, start: 'top top', end: () => `+=${Math.round(innerHeight * (STACKED.matches ? 2.2 : 2.6))}`,
    pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1.5,
    onUpdate: self => { state.progress = self.progress; if (self.progress > 0) lightUp(); wake(); },
  });
  const visibility = ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: () => pinned.end + innerHeight, refreshPriority: 1.5,
    onToggle: self => { state.active = self.isActive; wake(); },
  });
  const arrival = ScrollTrigger.create({ trigger: section, start: 'top 55%', once: true, refreshPriority: 1.5, onEnter: lightUp });
  setFace(0);
  const onPointer = event => {
    const rect = section.getBoundingClientRect();
    state.leanTarget = [(event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1)];
    hover(event);
    wake();
  };
  if (finePointer) section.addEventListener('pointermove', onPointer);
  const resizer = new ResizeObserver(() => layout());
  resizer.observe(stage);
  const onVisible = () => wake();
  document.addEventListener('visibilitychange', onVisible);
  layout();
  const loaded = load().catch(error => { console.error('The figures display is unavailable; keeping the figures as type.', error); section.classList.add('is-static'); pinned.kill(true); });
  if (import.meta.env.DEV) window.__fascia = {
    state,
    snapshot: () => ({ paint: +painted.toFixed(1), run: dialsRun ? +dialsRun.progress().toFixed(3) : null, progress: +state.progress.toFixed(4), turn: +state.turn.toFixed(4), depth: +state.depth.toFixed(4), face: state.face, ready: state.ready, sleeping: !raf, dials: display?.dials.map(d => [+d.value.toFixed(2), +d.lit.toFixed(2), d.shown]), screen: display ? [+display.screen.t.toFixed(2), +display.screen.glow.toFixed(2)] : null, light: +state.light.toFixed(2), places: places.map(p => p.name) }),
  };

  return {
    loaded,
    setDestinations: list => setPlaces(list),
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(raf);
      pinned.kill(true); visibility.kill(); arrival.kill();
      timelines.forEach(tl => tl.kill());
      gsap.ticker.remove(screenTick);
      resizer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      section.removeEventListener('pointermove', onPointer);
      display?.dispose();
      disposables.forEach(thing => thing.dispose?.());
      dash.children.forEach(child => child.geometry.dispose());
      lacquer.dispose(); ambient.dispose(); spill.map.dispose(); spill.dispose();
      environment.dispose(); jewelled.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}
