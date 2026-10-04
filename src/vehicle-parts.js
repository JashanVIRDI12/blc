// Audited against the supplied sources and their prepared GLBs.
// Full evidence: docs/model-audit.json. Vehicle coordinates: +Z forward, +X left.
// `size` is the body's bounding box, [width with mirrors, height, length], in metres.
// `plates` are the number-plate mounts (centre and outward normal) found by
// probing each bumper along the centre line; src/plates.js dresses them.
const wheels = { frontLeft: 'Wheel_FL', frontRight: 'Wheel_FR', rearLeft: 'Wheel_RL', rearRight: 'Wheel_RR' };
const doors = ['Door_FL', 'Door_FR', 'Door_RL', 'Door_RR'];
export const vehicleParts = {
  gls: {
    wheels, doors, bonnet: 'Bonnet', tailgate: 'Tailgate',
    bodyMaterial: 'gls_paint', dashboardMaterial: 'gls_torpedka1', interiorMaterial: 'gls_interior',
    headlightMaterial: 'lsiggls', projectorMaterials: ['gls_svet'], rearLightMaterials: ['gls_run'],
    headlamps: [[.74, .96, 2.47], [-.74, .96, 2.47]],
    taillamps: [[.77,1.15,-2.47],[-.77,1.15,-2.47]],
    wheelbase: 3.136, track: 1.648, wheelRadius: .421, size: [2.118, 1.86, 5.206],
    plates: [{ at: [.004, .563, 2.603], normal: [0, 0, 1] }, { at: [0, 1.135, -2.503], normal: [0, .25, -.97] }],
    supports: { engine: true, bonnet: true, cabin: true },
    engineEvidence: ['block_v8', 'gls_dvig'],
  },
  x7: {
    wheels, doors, bonnet: null, tailgate: 'Tailgate',
    bodyMaterial: 'carpaint', dashboardMaterial: 'baked_Torpeda_mtl', interiorMaterial: 'baked_front_seats',
    headlightMaterial: 'Front_Lights_emissive', rearLightMaterials: ['red_emiss'],
    headlamps: [[.73, .95, 2.51], [-.73, .95, 2.51]],
    taillamps: [[.77,1.14,-2.49],[-.77,1.14,-2.49]],
    wheelbase: 3.101, track: 1.682, wheelRadius: .3908, size: [2.238, 1.858, 5.152],
    plates: [{ at: [-.006, .589, 2.576], normal: [0, 0, 1] }, { at: [-.006, 1.044, -2.448], normal: [0, .22, -.98] }],
    supports: { engine: false, bonnet: false, cabin: true },
    engineEvidence: [],
  },
  defender: {
    wheels, doors: [], bonnet: null, tailgate: null,
    bodyMaterial: 'defender_paint',
    headlamps: [[.61, 1.02, 2.29], [-.61, 1.02, 2.29]],
    taillamps: [[.74, 1.0, -2.15], [-.74, 1.0, -2.15]],
    wheelbase: 3.088, track: 1.709, wheelRadius: .43, size: [2.122, 2.037, 5.018],
    // The side-hinged spare wheel stands .26 m proud of the tailgate, so the
    // rear plate sits on the bumper that far inside the body's end.
    spare: .26,
    plates: [{ at: [0, .613, 2.506], normal: [0, -.05, 1] }, { at: [0, .688, -2.253], normal: [0, 0, -1] }],
    supports: { engine: false, bonnet: false, cabin: false },
    engineEvidence: [],
  },
};
