// One dealership film in the supplied car showroom (src/showroom-room.js).
// The numbers here are timeline positions, never presented as car chapters.
// World: metres, +Z towards the front wall, cars inspected at the origin.
import { filmVehicles } from './config.js';
import { vehicleParts } from './vehicle-parts.js';
import { interval, smooth } from './motion.js';
const frame = (at, position, target, fov = 34, offset = [.15, .03], extra = {}) => ({ at, position, target, fov, offset, ...extra });
// A walkaround pose about the parked car (origin, nose towards +Z): az is in
// degrees from the nose towards the car's left side (+X).
const around = (at, az, radius, height, target, fov, offset = [.15, .03], extra = {}) => {
  const a = az * Math.PI / 180;
  return frame(at, [Math.sin(a) * radius, height, Math.cos(a) * radius], target, fov, offset, extra);
};

export const cameraFrames = [
  // The showroom is lit; the GLS's nose has just crossed the rear
  // threshold, its tail still in the dark. It drives past the camera to the
  // inspection mark.
  // At rest the opening title stands clear: the car waits beside it
  // (desktop) or below it (phones). Once it rolls, the drive-by shots lift it
  // across the headline's lines.
  frame(0, [-9.2,1.32,-5.4], [0,.95,-11], 34, [.27,.03], { hold: true, portrait: { target: [.2,.8,-13.4], offset: [0,.15] } }),
  frame(.133, [-7.6,1.32,-6.5], [0,.9,-7.2], 34, [.15,.03], { portrait: { offset: [0,-.03] } }),
  // Walkaround, one direction and under a full turn: rear three-quarter,
  // along the right flank to the front wheel, up over the bonnet, around
  // the nose to the open driver's door, then back for the departure.
  around(.252, -128, 8.4, 1.35, [0,.85,-.2], 34, undefined, { hold: true }),
  around(.342, -101, 8.6, 1.35, [0,.85,0], 34, [.19,.03]),
  around(.42, -76, 7.6, 1.25, [-.2,.8,.5], 34, [.18,.03]),
  around(.483, -58, 4.6, .66, [-.95,.5,1.5], 32, [-.13,.02]),
  around(.53, -45, 4.3, .7, [-.85,.5,1.6], 32, [-.13,.02]),
  around(.6, -17, 5.3, 2.2, [0,.9,1.45], 36, [.15,.02]),
  around(.653, 4, 5, 2.35, [.05,.85,1.35], 38, [.15,.02]),
  around(.7, 42, 5.1, 1.72, [.3,1,.8], 40, [.12,.01]),
  around(.743, 88, 2.5, 1.42, [.05,1.05,.4], 50, [.1,0]),
  around(.78, 96, 3.6, 1.5, [0,1,.3], 44, [.1,.01]),
  around(.833, 106, 6.4, 1.55, [0,.9,1.2], 38, [.12,.03], { hold: true }),
  // The GLS pulls away towards the front doorway; the camera turns to
  // follow it from its left. The film ends as it crosses the lit threshold,
  // tail lamps on.
  frame(.9, [5.9,1.52,-.9], [0,.95,2.4], 38, [.08,.03], { portrait: { offset: [0,-.02] } }),
  frame(.95, [5.2,1.48,.9], [0,1,6.8], 38, [.04,.07], { portrait: { offset: [0,-.04] } }),
  frame(1, [3.8,1.45,4.4], [-.15,1.05,14], 40, [0,.13], { hold: true, portrait: { offset: [0,-.05] } }),
];

// Portrait: the desktop camera positions, with the lens narrowed so the car
// fills a phone's width. `fill` is the share of the desktop's horizontal
// field kept: close-ups crop tight, wide shots keep nearly the whole car.
// The car sits a little below the middle, where it crosses the drive-by
// headlines. A frame may override any of this under `portrait`.
const PORTRAIT_ASPECT = 390 / 844, DESKTOP_ASPECT = 1.6;
const portraitLens = (fov, fill) => {
  const half = Math.atan(Math.tan(fov * Math.PI / 360) * DESKTOP_ASPECT) * fill;
  return Math.atan(Math.tan(half) / PORTRAIT_ASPECT) * 360 / Math.PI;
};
export const mobileCameraFrames = cameraFrames.map(f => {
  const target = f.portrait?.target ?? f.target;
  const reach = Math.hypot(...f.position.map((v, i) => v - f.target[i]));
  const fill = .46 + .16 * smooth(interval(reach, 4.5, 7.5));
  return {
    ...f, target,
    fov: f.portrait?.fov ?? portraitLens(f.fov, fill),
    offset: f.portrait?.offset ?? [0, .04],
    ...(f.portrait?.position ? { position: f.portrait.position } : {}),
  };
});

export const journeys = {
  // In from the rear threshold, straight to the inspection mark; out through
  // the front doorway. The departure runs on past the end of the film, so
  // the GLS is still rolling as it crosses the threshold at p = 1.
  [filmVehicles.first]: {
    arrival: { start: .02, end: .252, points: [[0,0,-12.9],[0,0,-9],[0,0,-4.5],[0,0,0]] },
    departure: { start: .833, end: 1.2, points: [[0,0,0],[0,0,4],[0,0,10],[0,0,18],[0,0,26],[0,0,32]] },
    visible: [0, 1],
  },
};
export const wipes = []; // The camera remains outside; the entire film is continuous.
// Copy windows. Headlines live between the room and the cars (type-plane.js),
// so the GLS crosses the arrival, bodywork and departure titles. Smaller
// inspection headlines stay legible in front during the close-up shots.
export const moments = [
  { id:'opening', start:0, end:.22, label:'Arrival' },
  { id:'condition', start:.267, end:.443, label:'Bodywork' },
  { id:'tyres', start:.46, end:.55, label:'Tyres', front:true },
  { id:'mechanical', start:.567, end:.685, label:'Engine', front:true },
  { id:'interior', start:.7, end:.777, label:'Cabin', front:true },
  { id:'departure', start:.823, end:1, label:'Departure' },
];

// Labels tethered to the inspected GLS, in its own space (metres, nose
// towards +Z, its left towards +X). Their words come from each chapter's copy.
export const tethers = [
  { id:'bodywork', moment:'condition', vehicle:filmVehicles.first, point:[-1.02,.93,-.85] },
  { id:'structure', moment:'condition', vehicle:filmVehicles.first, point:[-1.0,.4,.3] },
  { id:'tread', moment:'tyres', vehicle:filmVehicles.first, point:[-1.05,.74,1.9] },
  { id:'wear', moment:'tyres', vehicle:filmVehicles.first, point:[-1.12,.28,1.42] },
  { id:'engine', moment:'mechanical', vehicle:filmVehicles.first, point:[0,1.02,1.8] },
  // Inside the cabin: shown only once the driver's door is open (`inside`).
  { id:'controls', moment:'interior', vehicle:filmVehicles.first, point:[.38,1.02,.55], inside:true },
  { id:'materials', moment:'interior', vehicle:filmVehicles.first, point:[.42,.62,-.15], inside:true },
];

// While the GLS is parked, a sideways drag turns the shot about it. The
// turn counts in full only once the car has settled, and fades to nothing
// before it moves off.
const parked = journeys[filmVehicles.first];
export const lookAroundWeight = p => smooth(interval(p, parked.arrival.end, parked.arrival.end + .02)) * (1 - smooth(interval(p, parked.departure.start - .045, parked.departure.start - .01)));

// The bonnet lifts for the engine and is shut again before the cabin, on a
// car whose engine bay was modelled (the GLS's was; the X7's was not).
const engine = vehicleParts[filmVehicles.first].supports.engine;
export const bonnetProgress = p => engine ? smooth(interval(p,.557,.62))*(1-smooth(interval(p,.662,.698))) : 0;
// The door is fully shut before the first metre of forward departure.
export const doorProgress = p => smooth(interval(p,.697,.738))*(1-smooth(interval(p,.763,.822)));
