import { PerspectiveCamera, Vector3, MathUtils } from 'three';

// Corners of a car's bounding box at a pose from motion.js. Car space: nose
// towards +Z, left towards +X; `size` is [width, height, length] in metres.
export function carCorners(state, [width, height, length]) {
  const c = Math.cos(state.yaw), s = Math.sin(state.yaw), corners = [];
  for (const x of [-width / 2, width / 2]) for (const y of [0, height]) for (const z of [-length / 2, length / 2]) {
    corners.push(new Vector3(state.position[0] + x * c + z * s, y, state.position[2] - x * s + z * c));
  }
  return corners;
}

// A camera for `shot` ({ position, target, fov }) in a width × height frame.
// `fit.zoom` narrows the lens; `fit.offset` shifts the picture by a fraction
// of the frame (+x right, +y down), as the film's view offsets do.
export function frameCamera(camera, shot, width, height, fit = { zoom: 1, offset: [0, 0] }) {
  camera.position.set(...shot.position);
  camera.lookAt(...shot.target);
  camera.fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(shot.fov) / 2) / fit.zoom));
  camera.aspect = width / height;
  camera.setViewOffset(width, height, -fit.offset[0] * width, -fit.offset[1] * height, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

// Screen bounds (pixels) of a set of corner lists as seen by `camera`.
export function screenBounds(camera, boxes, width, height) {
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, behind: false };
  const point = new Vector3();
  for (const corners of boxes) for (const corner of corners) {
    point.copy(corner).project(camera);
    if (point.z > 1) bounds.behind = true;
    const x = (point.x + 1) / 2 * width, y = (1 - point.y) / 2 * height;
    bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
    bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
  }
  return bounds;
}

// The space the copy leaves for the cars, in stage pixels: beside it on wider
// screens, below it on phones. `copy` is the copy's rect within the stage and
// `header` the fixed header's height.
export function freeRegion(view, width, height, copy, header) {
  return view === 'portrait'
    ? { left: width * .02, right: width * .98, top: Math.max(copy.bottom + height * .025, header), bottom: height * .95 }
    : { left: copy.right + width * .05, right: width * .955, top: header + height * .07, bottom: height * .86 };
}

// Fit the lens and offset so `boxes` fill `region` (pixels in a width ×
// height frame) as far as their shape allows, centred in it, or hung from
// its top edge (`align: 'top'`). Narrowing the lens scales the picture about
// its centre, so this is exact for one pose. `bounds` is where the boxes land.
export function fitFrame({ shot, width, height, region, boxes, align = 'centre' }) {
  const camera = frameCamera(new PerspectiveCamera(shot.fov, width / height, .1, 500), shot, width, height);
  const b = screenBounds(camera, boxes, width, height);
  const zoom = MathUtils.clamp(Math.min((region.right - region.left) / (b.right - b.left), (region.bottom - region.top) / (b.bottom - b.top)), .3, 3);
  const scaled = v => (v - .5) * zoom + .5;
  const cx = width / 2 + ((b.left + b.right) / 2 - width / 2) * zoom;
  const cy = height / 2 + ((b.top + b.bottom) / 2 - height / 2) * zoom;
  const offset = [((region.left + region.right) / 2 - cx) / width, align === 'top' ? (region.top - scaled(b.top / height) * height) / height : ((region.top + region.bottom) / 2 - cy) / height];
  const bounds = { left: scaled(b.left / width) * width + offset[0] * width, right: scaled(b.right / width) * width + offset[0] * width, top: scaled(b.top / height) * height + offset[1] * height, bottom: scaled(b.bottom / height) * height + offset[1] * height };
  return { zoom, offset, bounds };
}
