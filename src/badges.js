import * as THREE from 'three';

// Mercedes star badges, as on a real GLS: a faceted chrome three-pointed star
// and a chrome ring on gloss black enamel. The source models carry blank
// chrome discs where the bonnet badge and the wheel centre caps sit; each
// disc becomes the enamel, and a star is fitted to it: centred, filling it,
// standing proud along its normal, top prong upright (wheel stars turn with
// their wheels).

const CHROME = { color: 0xe7e9ed, metalness: 1, roughness: .16 };
const ENAMEL = { color: 0x050607, metalness: .2, roughness: .14, clearcoat: 1, clearcoatRoughness: .05 };

// A star of unit radius in the XY plane, facing +Z, top prong along +Y: each
// prong is two facets rising from the valleys between the prongs to a ridge
// that runs from the raised centre out to the tip.
function starGeometry() {
  const centre = [0, 0, .16], tips = [], valleys = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 2 * Math.PI / 3, v = a + Math.PI / 3;
    tips.push([Math.sin(a) * .86, Math.cos(a) * .86, .035]);
    valleys.push([Math.sin(v) * .11, Math.cos(v) * .11, 0]);
  }
  const positions = [];
  for (let k = 0; k < 3; k++) {
    const left = valleys[(k + 2) % 3], right = valleys[k];
    // Counter-clockwise seen from the front, so each facet faces out.
    positions.push(...centre, ...tips[k], ...left, ...centre, ...right, ...tips[k]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // unindexed: each facet keeps its own normal
  return geometry;
}

let shared;
function parts() {
  return shared ??= {
    star: starGeometry(),
    ring: new THREE.TorusGeometry(.9, .065, 10, 64),
    chrome: new THREE.MeshPhysicalMaterial({ name: 'badge_chrome', ...CHROME }),
    enamel: new THREE.MeshPhysicalMaterial({ name: 'badge_enamel', ...ENAMEL }),
  };
}

// Centre, normal (area-weighted, outward) and radius of a flat disc mesh, in
// its own space.
function measureDisc(mesh) {
  const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), centre = new THREE.Vector3(), box = new THREE.Box3();
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const [i0, i1, i2] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(position, i0); b.fromBufferAttribute(position, i1); c.fromBufferAttribute(position, i2);
    normal.add(b.clone().sub(a).cross(c.clone().sub(a)));
  }
  for (let i = 0; i < position.count; i++) box.expandByPoint(a.fromBufferAttribute(position, i));
  box.getCenter(centre);
  let radius = 0;
  for (let i = 0; i < position.count; i++) radius = Math.max(radius, a.fromBufferAttribute(position, i).distanceTo(centre));
  return { centre, normal: normal.normalize(), radius };
}

// Dress every mesh whose material is `name` (car space: +Y up, nose +Z).
export function addStarBadges(root, name) {
  const { star, ring, chrome, enamel } = parts();
  const discs = [];
  root.traverse(node => { if (node.isMesh && !Array.isArray(node.material) && node.material.name === name) discs.push(node); });
  const up = new THREE.Vector3(), x = new THREE.Vector3(), basis = new THREE.Matrix4();
  for (const disc of discs) {
    const { centre, normal, radius } = measureDisc(disc);
    if (!radius) continue;
    // Face outward: away from the car's middle, as seen in car space.
    const outward = disc.localToWorld(centre.clone()).sub(root.getWorldPosition(new THREE.Vector3()));
    outward.y = Math.max(outward.y, 0);
    const worldNormal = normal.clone().transformDirection(disc.matrixWorld);
    if (worldNormal.dot(outward) < 0) normal.negate();
    // The star's top prong points up the disc, along the car's up direction.
    const localUp = new THREE.Vector3(0, 1, 0).transformDirection(disc.matrixWorld.clone().invert());
    up.copy(localUp).addScaledVector(normal, -localUp.dot(normal));
    if (up.lengthSq() < 1e-6) up.set(0, 0, 1).addScaledVector(normal, -normal.z);
    up.normalize(); x.crossVectors(up, normal);
    const badge = new THREE.Group();
    badge.name = 'Star badge';
    badge.quaternion.setFromRotationMatrix(basis.makeBasis(x, up, normal));
    badge.position.copy(centre).addScaledVector(normal, radius * .02);
    badge.scale.setScalar(radius * .97);
    badge.add(new THREE.Mesh(star, chrome), new THREE.Mesh(ring, chrome));
    disc.add(badge);
    disc.material = enamel;
  }
  return discs.length;
}
