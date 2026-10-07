// The collection drive on white (fleet-drive.js): five cars drive out of the
// white towards the visitor, line abreast, and settle into formation. On the
// home page one playhead (0..1) runs for as long as the section is on screen:
// it rises into view (to about .24), stays pinned, then scrolls away; the
// words rise into their bar as it settles. At the head of the collection page
// the same playhead runs on its own clock as the page opens, and the cars
// park in front of the page's title. Both use the same views: wide screens
// ("stage") and tall ones ("stage-portrait").
//
// World: metres, floor at y = 0, cars nose towards +Z, the camera in front of
// them (+Z) looking back. Screen right is +X.
import { fleetVehicles } from './config.js';
import { interval, smooth } from './motion.js';

const START_Z = -38; // where every car sets off, line abreast, deep in the white

// Where each car stops, left to right as seen. Wide screens take a tight V
// with the centre car leading and the flanking cars half a stride back, so
// the group reads as one large picture; tall ones a narrow arrowhead, deep
// enough that each car still has its own place on screen.
const FORMATIONS = {
  stage: [[-4.85, -5.5], [-2.4, -1.7], [0, 1.6], [2.4, -1.7], [4.85, -5.5]],
  'stage-portrait': [[-2.35, -9.6], [-1.22, -4], [0, 1.6], [1.22, -4], [2.35, -9.6]],
};
export const fleetViews = Object.keys(FORMATIONS);
export const fleetMarks = view => Object.fromEntries(fleetVehicles.map(({ id }, i) => [id, [FORMATIONS[view][i][0], 0, FORMATIONS[view][i][1]]]));

// Every car drives the same profile, scaled to its distance, so the line
// keeps its shape at speed; the outer cars brake first, the leader last.
const LEAD = .56; // the leading car comes to rest
export const fleetJourneys = view => Object.fromEntries(Object.entries(fleetMarks(view)).map(([id, mark]) => {
  const distance = mark[2] - START_Z, lead = Math.max(...FORMATIONS[view].map(([, z]) => z)) - START_Z;
  const end = .02 + (LEAD - .02) * distance / lead;
  return [id, { start: .02, end, points: [0, 1, 2, 3].map(k => [mark[0], 0, START_Z + distance * k / 3]) }];
}));

// The home page's words rise into their bar as the section settles into its
// pin, while the cars are still on their way; they reverse with the scroll.
export const fleetText = .27;
// Navigation lands here: cars parked, words set.
export const fleetAnchor = .66;

// The camera looks up the lanes as the cars appear, comes down with them to
// near their own height, so the group fills the frame, and drifts in a little
// while they hold. Fog: distances from the camera where the cars begin to
// fade and where they are gone.
const pose = (at, position, target, fov, extra = {}) => ({ at, position, target, fov, offset: [0, 0], ...extra });
export const fleetCamera = {
  stage: {
    frames: [
      pose(0, [0, 3, 25], [0, 1.15, -15], 28, { hold: true }),
      pose(.3, [0, 2.5, 21.5], [0, 1, -8], 28),
      pose(.58, [0, 2.05, 18.6], [0, .84, -2], 28),
      pose(1, [0, 1.98, 18.2], [0, .84, -1.9], 28, { hold: true }),
    ],
    fog: [27, 54],
  },
  'stage-portrait': {
    frames: [
      pose(0, [0, 12.6, 32], [0, 1.2, -16], 30, { hold: true }),
      pose(.3, [0, 11.4, 30], [0, 1, -8], 30),
      pose(.58, [0, 10.3, 27.8], [0, .85, -3], 30),
      pose(1, [0, 10, 27.3], [0, .85, -2.9], 30, { hold: true }),
    ],
    fog: [31, 66],
  },
};

// How visible the words and labels are at a playhead (for the static check).
export const fleetTextShown = p => smooth(interval(p, fleetText, fleetText + .04));
