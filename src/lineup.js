// The collection at the back of the showroom, after the film (cinema.js,
// collection.js). The cars park on an arc about the inspection stage, noses
// in. A chosen car drives straight down its own spoke to the stage, where the
// camera can circle it; it reverses back to its slot when the visitor is
// done. The spokes never cross a neighbour's bodywork (tools/verify-motion).
//
// World: metres, +Z towards the front wall, the stage at the origin.
import { filmVehicles, lineupVehicles } from './config.js';
import { cameraFrames } from './storyboard.js';

// Leave clearance behind the centre car as well as the angled outer cars.
const RADIUS = 10.1;
// Spread the current collection evenly; one car sits at the centre.
const ANGLES = lineupVehicles.map((_, i) => lineupVehicles.length === 1 ? 0 : -60 + 120 * i / (lineupVehicles.length - 1)); // degrees from -Z
const rad = degrees => degrees * Math.PI / 180;

// Where each car parks: on the arc, facing the stage.
export const slots = Object.fromEntries(lineupVehicles.map((id, i) => {
  const a = rad(ANGLES[i]);
  return [id, { index: i, angle: a, position: [RADIUS * Math.sin(a), 0, -RADIUS * Math.cos(a)], yaw: -a }];
}));
export const stage = [0, 0, 0];

// Nose first from the slot to the stage, straight, so the car never steers.
export const stagePoints = id => {
  const { position: [x, , z] } = slots[id];
  return [0, 1, 2, 3].map(i => [x * (1 - i / 3), 0, z * (1 - i / 3)]);
};

// The second act of the film's scroll, `q` 0..1: the film's car has gone
// out of the front doorway; the camera turns round to the back of the room,
// where the collection stands lit. It turns right, past the side wall, so it
// never looks back through itself.
const last = cameraFrames.at(-1);
const shot = (at, position, target, fov, offset = [0, 0], extra = {}) => ({ at, position, target, fov, offset, ...extra });
// Desktop sees the whole arc. Phones and other tall screens see one car at a
// time, from its front three-quarter (`carouselShot`), and swipe between them.
export const overview = shot(1, [0, 2.5, 9.6], [0, .75, -6.4], 50, [0, .02], { hold: true });
export function carouselShot(focus) {
  // Between slots the camera eases from one car's angle to the next.
  const i = Math.max(0, Math.min(ANGLES.length - 1, focus));
  const lo = Math.floor(i), hi = Math.min(ANGLES.length - 1, lo + 1);
  const a = rad(ANGLES[lo] + (ANGLES[hi] - ANGLES[lo]) * (i - lo));
  const view = a + rad(13);
  return {
    position: [4.2 * Math.sin(view), 1.7, -4.2 * Math.cos(view)],
    target: [RADIUS * Math.sin(a), .78, -RADIUS * Math.cos(a)],
    fov: 66, offset: [0, .06],
  };
}
export const defaultFocus = Math.max(0, lineupVehicles.indexOf(filmVehicles.first));
export const lineupCamera = {
  desktop: [
    shot(0, last.position, last.target, last.fov, last.offset, { hold: true }),
    shot(.3, [4.4, 1.6, 5.6], [9.5, 1.1, 4.5], 44),
    shot(.62, [2.6, 2.1, 8.2], [6, 1, -4], 48),
    overview,
  ],
  portrait: [
    shot(0, last.position, last.target, 46, [0, -.05], { hold: true }),
    shot(.3, [4.4, 1.6, 5.6], [9.5, 1.1, 4.5], 60),
    shot(.62, [4.6, 1.8, 2.6], [7.5, .9, -5.5], 64),
    { ...carouselShot(defaultFocus), at: 1, hold: true },
  ],
};

// The film's car joins the collection while the camera faces away: it has
// left by the front doorway, then takes its slot.
export const lineupReveal = { cars: .02, filmCarParks: .18 };

// Circling the chosen car on the stage (collection.js). Kept clear of the
// parked cars' noses, above the floor and below the 3.07 m ceiling: the
// higher the camera may look down from, the closer it must be.
export const orbitLimits = { distance: [4.4, 7.1], elevation: [rad(4), rad(36)], target: [0, .72, 0], ceiling: 2.55 };
export const maxElevation = distance => Math.min(orbitLimits.elevation[1], Math.asin(Math.min(1, (orbitLimits.ceiling - orbitLimits.target[1]) / distance)));
export const orbitShot = (yaw, elevation, distance, fov, offset = [0, 0]) => ({
  position: [Math.sin(yaw) * Math.cos(elevation) * distance, orbitLimits.target[1] + Math.sin(elevation) * distance, Math.cos(yaw) * Math.cos(elevation) * distance],
  target: [...orbitLimits.target], fov, offset,
});
