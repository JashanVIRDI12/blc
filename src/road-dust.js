import * as THREE from 'three';

// The fine dust a car lifts from the floor: soft puffs left behind the rear
// tyres, as many as the distance rolled, that billow, drift back and up a
// little, and settle away. They live in the car scene, so a car hides the
// dust behind it, and they fade into the distance as the cars do. Puffs are
// spawned by distance (not time), so a parked car lifts none.
const MAX = 720;
const vertexShader = /* glsl */`
  attribute float size; attribute float alpha;
  uniform float scale; uniform vec2 fade;
  varying float vAlpha;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = min(size * scale / -view.z, 480.0);
    vAlpha = alpha * (1.0 - smoothstep(fade.x, fade.y, -view.z));
  }
`;
const fragmentShader = /* glsl */`
  uniform vec3 color; varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - .5) * 2.0;
    float soft = exp(-r * r * 3.4) * (1.0 - smoothstep(.75, 1.0, r));
    gl_FragColor = vec4(color, vAlpha * soft);
    #include <colorspace_fragment>
  }
`;

export function createRoadDust({ color = '#a39782', strength = 1 } = {}) {
  const positions = new Float32Array(MAX * 3), sizes = new Float32Array(MAX), alphas = new Float32Array(MAX);
  const geometry = new THREE.BufferGeometry();
  const attribute = (array, n) => new THREE.BufferAttribute(array, n).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute(positions, 3));
  geometry.setAttribute('size', attribute(sizes, 1));
  geometry.setAttribute('alpha', attribute(alphas, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, scale: { value: 1 }, fade: { value: new THREE.Vector2(30, 60) } },
    vertexShader, fragmentShader, transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; points.renderOrder = 4; points.raycast = () => {};

  const puffs = Array.from({ length: MAX }, () => ({ age: 1, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), from: 0, to: 0, peak: 0 }));
  let next = 0, alive = 0;
  const wheel = new THREE.Vector3(), forward = new THREE.Vector3(), side = new THREE.Vector3();
  const random = (a, b) => a + Math.random() * (b - a);

  return {
    points,
    // `holder` has just rolled `metres` (signed) at `speed` m/s; its rear
    // tyres sit `track` apart and `axle` metres behind its centre.
    kick(holder, metres, speed, { track, axle }) {
      const travelled = Math.abs(metres);
      if (travelled < 1e-4 || travelled > 4) return;
      holder.updateMatrixWorld();
      forward.set(0, 0, Math.sign(metres)).transformDirection(holder.matrixWorld);
      side.set(1, 0, 0).transformDirection(holder.matrixWorld);
      const count = travelled * 2.2 * strength;
      for (let n = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0); n > 0; n--) {
        for (const x of [-track / 2, track / 2]) {
          const puff = puffs[next]; next = (next + 1) % MAX;
          if (puff.age >= puff.life) alive++;
          // Thrown back and out from the tread, low over the floor: it
          // shows beside the tyres and spreads into the gaps between cars.
          wheel.set(x + Math.sign(x) * random(0, .16), random(.05, .2), -axle + random(-.35, .25));
          puff.p.copy(holder.localToWorld(wheel));
          puff.v.copy(forward).multiplyScalar(-random(.6, 1) * Math.min(speed, 14) * .1)
            .addScaledVector(side, Math.sign(x) * random(.5, 1.7)).add({ x: 0, y: random(.12, .45), z: 0 });
          puff.age = 0; puff.life = random(1.3, 2.4);
          puff.from = random(.35, .6); puff.to = random(1.8, 2.8) + Math.min(speed, 14) * .07;
          puff.peak = random(.16, .3) * Math.min(1, .3 + speed / 8);
        }
      }
    },
    // Ages the dust by `dt` seconds; false once it has all settled.
    update(dt) {
      if (!alive) return false;
      alive = 0;
      const drag = Math.exp(-1.7 * dt);
      for (let i = 0; i < MAX; i++) {
        const puff = puffs[i];
        if (puff.age >= puff.life) { alphas[i] = 0; continue; }
        puff.age += dt; alive++;
        const k = Math.min(1, puff.age / puff.life);
        puff.p.addScaledVector(puff.v, dt);
        puff.v.multiplyScalar(drag); puff.v.y -= .04 * dt;
        positions[i * 3] = puff.p.x; positions[i * 3 + 1] = Math.max(.02, puff.p.y); positions[i * 3 + 2] = puff.p.z;
        sizes[i] = puff.from + (puff.to - puff.from) * (1 - (1 - k) ** 2.4);
        alphas[i] = puff.peak * Math.min(1, k / .1) * (1 - k) ** 1.7;
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.size.needsUpdate = geometry.attributes.alpha.needsUpdate = true;
      return alive > 0;
    },
    // Pixels per metre at one metre from `camera` in a canvas `height` device pixels tall.
    frame(camera, height, fade) {
      material.uniforms.scale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      material.uniforms.fade.value.set(...fade);
    },
    get alive() { return alive > 0; },
    clear() { puffs.forEach(puff => { puff.age = puff.life = 0; }); alphas.fill(0); alive = 0; geometry.attributes.alpha.needsUpdate = true; },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
