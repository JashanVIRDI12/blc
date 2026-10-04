// Mercedes-Benz GLS 580, source/mersedes-_benz_gls.glb (see prep-model.mjs).
// Part names are the game mod's, without their .001-style suffixes.

const mid = (b, i) => (b.min[i] + b.max[i]) / 2;

export default {
  realLength: 5.207, // metres
  // Alternate interior trims (carbon, wood, brown leather) exported on top of
  // the ones we keep, plus two stray parts from other game vehicles.
  drop: [
    "gls_doorpanel_RL_vstav_carbon",
    "gls_doorpanel_RR_vstav_carbon",
    "gls_doorpanel_RL_vstav_wood",
    "gls_doorpanel_RR_vstav_wood",
    "gls_doorpanel_RL_vstav_black",
    "gls_doorpanel_RR_vstav_black",
    "gls_int_vstav_carbon",
    "gls_int_vstav_wood",
    "gls_int_vstav_black",
    "gls_doorpanel_RL_brown",
    "gls_doorpanel_RR_brown",
    "gls_lettering_tailgate_t",
    "gls_brakedisc_RL_sport",
  ],
  tyre: /^Object_4\.\d+$/,
  rim: /^wheel_stoc\.\d+$/,
  // The engine bay shares the exterior's chrome, paint and trim materials;
  // split them off so the bay can be finished like a real GLS's (models.js).
  materialOverrides: {
    gls_engine_stock: { wheel_42b: 'engine_alloy', wheel_42a: 'engine_cover', gls_kaki: 'engine_plastic' },
    gls_dvig: { gls_paint: 'engine_plastic', gls_palitra: 'engine_metal', wheel_42b: 'engine_alloy', gls_grille: 'engine_plastic' },
  },
  // Parts that open. `skin` is the outer panel whose bounds place the hinge
  // (car space: +X left, +Y up, +Z forward; metres).
  moving: {
    Bonnet: { skin: "gls_hood_1", parts: ["gls_hood_1"], hinge: (b) => [0, b.max[1] - 0.015, b.min[2] + 0.03] },
    Door_FL: {
      skin: "gls_door_FL",
      parts: ["gls_door_FL", "gls_doorglass_FL", "gls_doorpanel_FL", "gls_doorpanel_FL_vstav_wood", "gls_mirror_L"],
      hinge: (b) => [b.max[0] - 0.09, mid(b, 1), b.max[2] - 0.05],
    },
    Door_FR: {
      skin: "gls_door_FR",
      parts: ["gls_door_FR", "gls_doorglass_FR", "gls_doorpanel_FR_brown", "gls_doorpanel_FR_vstav_carbon", "gls_mirror_R"],
      hinge: (b) => [b.min[0] + 0.09, mid(b, 1), b.max[2] - 0.05],
    },
    Door_RL: {
      skin: "gls_door_RL",
      parts: ["gls_door_RL", "gls_doorpanel_RL", "gls_doorpanel_RL_vstav_wood1"],
      hinge: (b) => [b.max[0] - 0.09, mid(b, 1), b.max[2] - 0.05],
    },
    Door_RR: {
      skin: "gls_door_RR",
      parts: ["gls_door_RR", "gls_doorpanel_RR", "gls_doorpanel_RR_vstav_wood1"],
      hinge: (b) => [b.min[0] + 0.09, mid(b, 1), b.max[2] - 0.05],
    },
    Tailgate: {
      skin: "gls_tailgate",
      parts: ["gls_tailgate", "gls_tailgatelight_L", "gls_tailgatelight_R", "gls_tailgatelightglass_L", "gls_rearwiper"],
      hinge: (b) => [0, b.max[1] - 0.02, b.max[2] - 0.03],
    },
  },
  fixedGlass: "gls_sunroof", // roof, rear window and every rear side window
  grille: "gls_bumper_F_b", // its biggest black-plastic piece is the grille face
  // The steering wheel, in front of the driver's seat (left-hand drive).
  steeringWheel: { min: [0.15, 0.95, 0.45], max: [0.68, 1.45, 0.85] },
  // Where the three-pointed stars sit (car space, metres): grille and tailgate.
  badges: [
    { min: [-0.13, 0.735, 2.43], max: [0.13, 0.99, 2.6] },
    { min: [-0.075, 1.33, -2.53], max: [0.075, 1.42, -2.41] },
  ],
};
