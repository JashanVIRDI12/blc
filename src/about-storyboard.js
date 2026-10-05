// The About sequence on white: the BMW X7 and the Defender drive in out of
// the white, stop for Baba's introduction, and drive away. One playhead (0..1)
// runs for as long as the section is on screen: it rises into view (to about
// .21), stays pinned (to about .79), then scrolls away.
//
// World: metres, floor at y = 0. Both cars drive straight along parallel
// lanes, towards +Z and a little towards +X. The camera watches their front
// right three-quarters. The introduction is set throughout, so the cars come
// in beside it (below it on phones), never behind it, and leave away from it.
import { aboutVehicles } from './config.js';
import { interval, smooth } from './motion.js';

const LANE_YAW = .12; // radians, towards +X
const along = ([x, y, z], metres) => [x + Math.sin(LANE_YAW) * metres, y, z + Math.cos(LANE_YAW) * metres];
// Four points on the lane from `from`, `metres` long. Straight, so the cars never steer.
const run = (from, metres) => [0, 1, 2, 3].map(i => along(from, metres * i / 3));

// Where each car stops for the introduction: the near lane leads.
export const aboutMarks = {
  [aboutVehicles.near]: [-1.8, 0, 1.3],
  [aboutVehicles.far]: [2.7, 0, -2.2],
};

// Each car starts at rest deep in the white, or off the left edge on phones,
// and leaves off the right edge. The near car settles first and leaves first.
const journey = (mark, arrive, leave) => ({
  arrival: { start: arrive[0], end: arrive[1], points: run(along(mark, -26), 26) },
  departure: { start: leave[0], end: leave[1], points: run(mark, 20) },
  visible: [0, 1],
});
export const aboutJourneys = {
  [aboutVehicles.near]: journey(aboutMarks[aboutVehicles.near], [.02, .36], [.62, .86]),
  [aboutVehicles.far]: journey(aboutMarks[aboutVehicles.far], [.05, .4], [.66, .9]),
};

// Navigation to #about lands at the anchor: both cars parked.
export const aboutAnchor = .57;

// While both cars are parked they can be turned by hand. Scrolling on turns
// them back to straight before either moves off: a turn counts in full from
// `start` to `until`, and fades to nothing across the edges beyond.
export const aboutTurn = { from: .4, start: .42, until: .585, settle: .615 };
export const aboutTurnWeight = p => smooth(interval(p, aboutTurn.from, aboutTurn.start)) * (1 - smooth(interval(p, aboutTurn.until, aboutTurn.settle)));

// A slow, continuous drift about the parked pair. Lens and framing are fitted
// to the free space beside (desktop) or below (portrait) the copy, see
// about-framing.js. Both frames first look up the lanes, where the cars
// appear out of the white, and turn with them to their marks, which keeps
// them clear of the copy all the way in. Fog:
// distances from the camera where the white begins and where it is complete.
const TARGET = [.4, .75, -.4];
const pose = (at, dir, distance, fov, extra = {}) => {
  const length = Math.hypot(...dir);
  const target = extra.target ?? TARGET;
  return { at, position: TARGET.map((t, i) => t + dir[i] / length * distance), target, fov, offset: [0, 0], ...extra };
};
export const aboutCamera = {
  desktop: {
    frames: [
      // The look follows the pair's progress down the lanes (their mean
      // distance from the marks), so they stay centred in the space beside
      // the copy all the way in, rather than running ahead to the edge.
      pose(0, [-.44, .14, .88], 24.4, 24, { hold: true, target: along(TARGET, -20) }),
      pose(.12, [-.454, .14, .873], 24.06, 24, { target: along(TARGET, -20) }),
      pose(.2, [-.464, .14, .868], 23.84, 24, { target: along(TARGET, -14) }),
      pose(.25, [-.47, .14, .865], 23.7, 24, { target: along(TARGET, -7.4) }),
      pose(.3, [-.476, .14, .862], 23.56, 24, { target: along(TARGET, -2.5) }),
      pose(.36, [-.483, .14, .858], 23.39, 24),
      pose(.5, [-.5, .14, .85], 23, 24),
      pose(1, [-.54, .13, .83], 22.4, 24, { hold: true }),
    ],
    fog: [28, 46],
  },
  // Phones see the pair staggered in depth from higher up: the Defender behind
  // and beside the X7, so each car can fill the width instead of sharing it.
  portrait: {
    frames: [
      pose(0, [-.708, .38, .594], 27.6, 30, { hold: true, target: along(TARGET, -11) }),
      pose(.22, [-.72, .39, .574], 27.3, 30, { target: along(TARGET, -11) }),
      pose(.36, [-.726, .395, .563], 27.15, 30, { target: along(TARGET, -4) }),
      pose(.42, [-.732, .4, .552], 27, 30),
      pose(1, [-.77, .42, .481], 26.4, 30, { hold: true }),
    ],
    fog: [32, 44],
  },
};
