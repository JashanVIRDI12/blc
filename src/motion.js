import { CatmullRomCurve3, Vector3, MathUtils } from 'three';

export const clamp01 = n => MathUtils.clamp(n, 0, 1);
export const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp01(t); return clamp01(t * t * t * (t * (t * 6 - 15) + 10)); };
export const interval = (t, start, end) => clamp01((t - start) / (end - start));

// Arc-length sampling gives distance in metres, independent of frame rate or
// scroll direction. Wheel rotation is derived from that same distance.
export function createDrivePath(points, wheelbase) {
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal');
  curve.arcLengthDivisions = 500;
  curve.updateArcLengths();
  const length = curve.getLength();
  const point = new Vector3(), tangent = new Vector3(), before = new Vector3(), after = new Vector3();
  return {
    length,
    sample(raw) {
      const u = smoother(raw);
      curve.getPointAt(u, point);
      curve.getTangentAt(u, tangent);
      const lo = Math.max(0, u - .004), hi = Math.min(1, u + .004);
      curve.getTangentAt(lo, before);
      curve.getTangentAt(hi, after);
      const h0 = Math.atan2(before.x, before.z), h1 = Math.atan2(after.x, after.z);
      const delta = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
      const curvature = delta / Math.max((hi - lo) * length, .001);
      const acceleration = 60 * raw * (2 * raw * raw - 3 * raw + 1);
      // Take up steering as the tyres begin to roll, and straighten at rest.
      // These short ramps cover less than a centimetre of physical travel.
      const steeringLoad = smooth(interval(raw, 0, .045)) * (1 - smooth(interval(raw, .96, 1)));
      return {
        position: point.toArray(), yaw: Math.atan2(tangent.x, tangent.z),
        distance: length * u, steer: MathUtils.clamp(Math.atan(wheelbase * curvature), -.58, .58) * steeringLoad,
        pitch: MathUtils.clamp(-acceleration * .0009, -.007, .007),
      };
    },
  };
}

export function createVehicleJourney(config, wheelbase) {
  const arrival = createDrivePath(config.arrival.points, wheelbase);
  const departure = createDrivePath(config.departure.points, wheelbase);
  // Outside its window a car waits (or has left) beyond the doorways, hidden.
  const [from, until] = config.visible ?? [0, 1];
  const pose = t => {
    if (t < config.arrival.end) return arrival.sample(interval(t, config.arrival.start, config.arrival.end));
    if (t <= config.departure.start) return { ...arrival.sample(1), steer: 0, pitch: 0 };
    const state = departure.sample(interval(t, config.departure.start, config.departure.end));
    state.distance += arrival.length;
    return state;
  };
  // Lamps fade in and out at the ends of the window instead of popping.
  const presence = t => (from > 0 ? smooth(interval(t, from, from + .015)) : 1) * (until < 1 ? 1 - smooth(interval(t, until - .015, until)) : 1);
  return t => ({ ...pose(t), visible: t >= from && t <= until, presence: presence(t) });
}
