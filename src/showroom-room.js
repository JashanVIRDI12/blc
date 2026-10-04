// Measured from car-showroom_2.glb (metres, floor at y = 0, +Z towards the
// front wall). Shared by tools/prep-showroom.mjs, the film and its tests.
export const showroomRoom = {
  // Inner and outer faces of all four walls; the square room is 26.3 m inside.
  wall: { inner: 13.166, outer: 13.342 },
  // Underside of the luminous ceiling grid.
  ceiling: 3.066,
  // Openings run between existing panel seams (2.66 m panel pitch), on the
  // room's centre line, so cars cross the threshold straight.
  doorways: [
    { id: 'rear', z: -13.25, x: [-2.701, 2.701], height: 2.7 },
    { id: 'front', z: 13.25, x: [-2.701, 2.701], height: 2.7 },
  ],
  // The lit Baba logo on the back (rear) wall, right of the drive-in
  // doorway: centre x and height, and width (1200 x 376 artwork).
  logo: { x: 6.3, y: 1.95, width: 3.4, aspect: 1200 / 376 },
};
