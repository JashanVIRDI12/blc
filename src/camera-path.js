import { MathUtils } from 'three';

// All camera positions, targets and lens choices live in storyboard.js.
//
// The camera passes through every keyframe without stopping: each channel is
// a cubic Hermite spline in film time whose velocity is continuous (three-point
// tangents, limited so no channel overshoots a keyframe). Only keyframes
// marked `hold` come to rest. Positions are
// interpolated in cylindrical coordinates about the showroom centre, where the
// cars are inspected, so walkarounds follow true arcs at a steady radius
// instead of cutting chords past the bodywork.
export function createCameraPath(frames) {
  const times = frames.map(f => f.at);
  let previous;
  const values = frames.map(f => {
    const [x, y, z] = f.position;
    let az = Math.atan2(x, z);
    if (previous !== undefined) az = previous + Math.atan2(Math.sin(az - previous), Math.cos(az - previous));
    previous = az;
    return [az, Math.hypot(x, z), y, ...f.target, f.fov, ...f.offset];
  });
  const count = values[0].length;
  const tangents = values.map((v, i) => v.map((_, c) => {
    if (frames[i].hold || i === 0 || i === frames.length - 1) return 0;
    const h0 = times[i] - times[i - 1], h1 = times[i + 1] - times[i];
    const d0 = (v[c] - values[i - 1][c]) / h0, d1 = (values[i + 1][c] - v[c]) / h1;
    // Rest at a turning point, and never overshoot a keyframe (Fritsch-Carlson).
    if (d0 * d1 <= 0) return 0;
    const m = (h1 * d0 + h0 * d1) / (h0 + h1);
    return Math.sign(m) * Math.min(Math.abs(m), 3 * Math.min(Math.abs(d0), Math.abs(d1)));
  }));
  return t => {
    t = MathUtils.clamp(t, times[0], times[times.length - 1]);
    let i = times.findIndex((at, n) => n < times.length - 1 && t <= times[n + 1]);
    if (i < 0) i = times.length - 2;
    const h = times[i + 1] - times[i], u = (t - times[i]) / h;
    const u2 = u * u, u3 = u2 * u;
    const a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, c = -2 * u3 + 3 * u2, d = u3 - u2;
    const s = Array.from({ length: count }, (_, k) => a * values[i][k] + b * h * tangents[i][k] + c * values[i + 1][k] + d * h * tangents[i + 1][k]);
    return {
      position: [Math.sin(s[0]) * s[1], s[2], Math.cos(s[0]) * s[1]],
      target: [s[3], s[4], s[5]],
      fov: s[6],
      offset: [s[7], s[8]],
    };
  };
}
