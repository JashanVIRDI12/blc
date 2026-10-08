// "Lights on", the home page's collection (lights-on.js): the cars wait parked
// in the dark, only their headlamps lit; the camera tracks along them and a
// light comes up over each as it passes; then the whole studio comes up, the
// room turns white, and the camera pulls back to see them all. One playhead
// (0..1) runs for as long as the section is on screen: it rises into view (to
// about .24), stays pinned, then scrolls away. Every light follows the scroll
// itself, so scrolling back dims it exactly as it came up.
//
// World: metres, floor at y = 0, cars nose towards +Z, the camera in front of
// them (+Z). Wide screens park the cars side by side, angled like a
// showroom's bays; tall ones side by side too, in a line running away from
// the camera, so they stack up the screen.
import { lightsVehicles } from './config.js';
import { interval, smooth } from './motion.js';

export const lightsViews = ['wide', 'tall'];
const N = lightsVehicles.length;
const lerp = (a, b, t) => a + (b - a) * t;
const along = i => N > 1 ? i / (N - 1) : .5; // 0 at the first car, 1 at the last

// Each car turned the same way (noses to the camera's left), a bay apart.
// Wide screens set the line square to the camera; tall ones along the cars'
// own left-right axis, so it runs away up the screen.
const BAYS = { wide: { yaw: -.5, gap: 3.3 }, tall: { yaw: -1.1, gap: 3 } };
const bay = (view, i) => {
  const { yaw, gap } = BAYS[view], k = i - (N - 1) / 2;
  return view === 'wide' ? [k * gap, 0, 0] : [-k * gap * Math.cos(yaw), 0, k * gap * Math.sin(yaw)];
};
export const lightsMarks = view => Object.fromEntries(lightsVehicles.map(({ id }, i) => [id, { position: bay(view, i), yaw: BAYS[view].yaw }]));

// The Baba Luxury Car sign, lit on the back wall behind the cars: its centre,
// its width in metres, and the way it faces (towards the last frame's camera).
export const lightsLogo = {
  // Small and high, so it reads above the roofs in every frame.
  wide: { position: [0, 3.75, -12], width: 5.4, yaw: 0 },
  tall: { position: [2.2, 3.85, -9.7], width: 4.2, yaw: Math.atan2(-6 - 2.2, 23 + 9.7) },
};

// When things happen: each car's light comes up over `rise` as the camera
// reaches it; the studio comes up over `room`; the words rise at `words`;
// navigation lands at `anchor`.
const FIRST = .25, LAST = .55;
export const LIGHTS = { panels: lightsVehicles.map((_, i) => lerp(FIRST, LAST, along(i))), rise: .045, room: [.6, .69], words: .68, anchor: .74 };

// A car's own light at a playhead (0, off; 1, full).
export const bayLevel = (p, i) => smooth(interval(p, LIGHTS.panels[i], LIGHTS.panels[i] + LIGHTS.rise));
// The studio's level at a playhead: 0, dark; 1, every light up, the room white.
export const roomLevel = p => smooth(interval(p, ...LIGHTS.room));
// The headlamps, bright in the dark, all but out once the studio is up.
export const lampLevel = p => 1 - .9 * roomLevel(p);

// The camera: it waits at the first car, tracks along them at their own
// height (looking from the left at the first, from the right at the last),
// then swings round and back to see them all. The last frames hold.
const pose = (at, position, target, fov, extra = {}) => ({ at, position, target, fov, offset: [0, 0], ...extra });
const track = (view, i, at) => {
  const [x, , z] = bay(view, i), t = along(i);
  return view === 'wide'
    ? pose(at, [x + lerp(-4.4, 1.6, t), lerp(1.7, 1.6, t) - .2 * Math.sin(t * Math.PI), lerp(8.5, 9.1, t)], [x, .84, z], 30)
    : pose(at, [x - 8.4, 2.2, z + 6.4], [x, .86, z], 52);
};
export const lightsCamera = Object.fromEntries(lightsViews.map(view => {
  const [x0, , z0] = bay(view, 0);
  const start = view === 'wide' ? pose(0, [x0 - 4.6, 1.75, 8.6], [x0, .9, 0], 30, { hold: true }) : pose(0, [x0 - 8.7, 2.4, z0 + 8.2], [x0, .9, z0], 52, { hold: true });
  const end = view === 'wide'
    ? [pose(.74, [0, 2.4, 20], [0, .85, -.4], 26, { hold: true }), pose(1, [0, 2.35, 19.5], [0, .85, -.4], 26, { hold: true })]
    : [pose(.74, [-6, 14, 23], [0, .85, -1], 34, { hold: true }), pose(1, [-5.9, 13.8, 22.5], [0, .85, -1], 34, { hold: true })];
  return [view, [start, ...lightsVehicles.map((_, i) => track(view, i, LIGHTS.panels[i] - .01)), ...end]];
}));
