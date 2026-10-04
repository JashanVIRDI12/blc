// The cars we have 3D models for, and how each model is dressed and moved.
// Stock entries in inventory.js point at these by id (`model3d`).
//
// Car space, for every model: metres, nose towards +Z, the car's left side
// towards +X, tyres on y = 0.

const CHROME = { color: 0xd4d7db, metalness: 1, roughness: 0.1 };
// Glass reflects at full strength over its tint (glass.js); `opacity` is how
// much of the view through it the tint takes away.
const GLASS = { glass: true, color: 0x0b0f13, metalness: 0, roughness: 0.02, opacity: 0.5 };
// GLS-family cabin materials come directly from their GLBs. Keep the authored
// upholstery, dashboard, wood, steering wheel and ambient-strip colours.
// Baked-texture interiors came out of the game as half metal; they read as
// leather and plastic once that's taken off. Their colour is in the
// texture (re-toned by tools/prep-x7.mjs).
const BAKED = { metalness: 0, roughness: 0.6 };
// The X7's original leather is black: a low, broad sheen, so the room's
// reflections don't veil it grey.
const LEATHER = { metalness: 0, roughness: 0.66, specularIntensity: 0.45 };
// The three-pointed star and other badges.
const BADGE = { color: 0xe4e6ea, metalness: 1, roughness: 0.06 };
// Satin chrome: a little roughness gathers the bright ceiling into every
// facet, so a star facing the dark end of the room still reads as silver
// rather than mirroring the dark.
const SATIN_CHROME = { color: 0xf1f3f6, metalness: 1, roughness: 0.17 };

// The GLS's two headlamps, just inside their lenses (car space, metres).
const HEADLAMPS = [1, -1].map(side => ({
  min: [side > 0 ? .53 : -.91, .84, 1.98], max: [side > 0 ? .91 : -.53, 1.06, 2.445],
}));

// Where the camera goes for each part of an inspection report, and where its
// pin sits on the car. Poses: az is degrees around the car (0 = looking at the
// nose, 90 = its left side), el degrees above the ground, dist metres from the
// target; `narrow` shifts the car on phones (fraction of the screen, +y down)
// to clear the report cards, `wide` on larger screens; fit is how much the
// pose pulls back on narrow screens to keep the car in frame. `normal` is the
// direction the pin faces; it hides when that side is turned away.
function views({ engineOpens, wheel, boot }) {
  return {
    overview: { pose: { az: -34, el: 16, dist: 11, target: [0, 0.8, 0], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.7 } },
    body: {
      pose: { az: 62, el: 20, dist: 10, target: [0, 0.85, 0], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.7 },
      anchor: [1.0, 1.02, -0.75],
      normal: [1, 0.2, 0],
    },
    tyres: {
      pose: { az: 52, el: 6, dist: 4.8, target: [wheel[0] - 0.15, 0.45, wheel[2] - 0.1], wide: [0.1, -0.1], narrow: [0, -0.06], fit: 1.5 },
      anchor: wheel,
      normal: [1, 0, 0.15],
    },
    engine: {
      pose: { az: 14, el: 22, dist: 7.8, target: [0, 1.0, 1.0], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.4 },
      anchor: [0, 1.12, 2.1],
      normal: [0, 0.7, 0.7],
      opens: engineOpens,
    },
    cabin: {
      pose: { az: 118, el: 11, dist: 9.4, target: [0, 0.95, 0], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.7 },
      anchor: [0.86, 1.3, 0.2],
      normal: [1, 0.1, 0],
      opens: ["Door_FL", "Door_RL"],
    },
    boot: {
      pose: { az: 204, el: 16, dist: 9.8, target: [0, 1.0, -0.3], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.7 },
      anchor: boot,
      normal: [0, 0.2, -1],
      opens: ["Tailgate"],
    },
    papers: { pose: { az: -34, el: 16, dist: 11, target: [0, 0.8, 0], wide: [0.06, -0.12], narrow: [0, -0.1], fit: 1.7 } },
  };
}

export const models = {
  gls: {
    url: "/models/gls.glb",
    shadow: "/models/gls-shadow.jpg",
    still: "/stills/gls.webp", // npm run stills
    paint: "gls_paint",
    // The bonnet badge and wheel centre caps are blank discs in the source:
    // each gets a chrome star and ring on gloss black enamel (badges.js).
    starBadges: "gls_shild",
    // Wheels: the GLS's rims share a material with trim elsewhere on the car,
    // so rims are restyled only where they sit on a wheel.
    rim: { material: "gls_black_chrome", color: 0xc3c7cc, metalness: 1, roughness: 0.2 },
    drl: "lsiggls",
    openings: {
      Bonnet: { axis: "x", angle: -52 },
      Door_FL: { axis: "y", angle: -64 },
      Door_RL: { axis: "y", angle: -64 },
      Door_FR: { axis: "y", angle: 64 },
      Door_RR: { axis: "y", angle: 64 },
      Tailgate: { axis: "x", angle: 76 },
    },
    // Driver's eye and the spot outside the open driver's door the camera
    // passes on its way in.
    eye: [0.41, 1.3, 0.1],
    doorway: [1.9, 1.4, 0.3],
    views: views({ engineOpens: ["Bonnet"], wheel: [1.0, 0.4, 1.62], boot: [0, 1.05, -2.62] }),
    // Preserve the authored cabin palette while lighting its actual strips.
    ambient: { material: "gls_rgblentaa", preserveOriginal: true },
    cabin: true,
    parts: {
      logo_chrome: BADGE,
      // The smooth gloss black disc behind the grille star (it covers the
      // radar on a real GLS).
      star_cover: { color: 0x030405, metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 },
      grille_face: { color: 0xb2b5b9, metalness: 1, roughness: 0.42 },
      gls_kaki: { color: 0x0f1011, roughness: 0.5 },
      gls_black_chrome: { color: 0x3a3d41, metalness: 1, roughness: 0.22 },
      black_chrome: { color: 0x3a3d41, metalness: 1, roughness: 0.22 },
      wheel_42b: CHROME,
      wheel_42a: { color: 0x9a9da2, metalness: 1, roughness: 0.3 },
      gls_ras: CHROME,
      gls_ras_on: CHROME,
      gls_shild: CHROME,
      mirror: { color: 0xffffff, metalness: 1, roughness: 0 },
      gls_fara: { color: 0xeef0f2, metalness: 1, roughness: 0.04 },
      // The projector lens: dark optical glass, glossy, softly lit from
      // within when the lamps are on (vehicle-parts.js: projectorMaterials).
      gls_svet: { color: 0x07090c, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x9fb2d4, emissiveIntensity: 0 },
      gls_rear: { color: 0x8d9095, metalness: 1, roughness: 0.15 },
      gls_sigl: { color: 0xb9bcc0, metalness: 1, roughness: 0.12 },
      gls_sigr: { color: 0xb9bcc0, metalness: 1, roughness: 0.12 },
      lsiggls: { color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 4, roughness: 0.2 },
      // Glazing as on a real GLS (X167): the windscreen and front door glass
      // are clear, with the faint green-grey of heat-insulating glass, so the
      // cabin reads from outside; the rear door and quarter windows, the
      // tailgate glass and the roof are dark privacy glass (gls_carbonn, all
      // of the model's fixed glass), standard on the GLS.
      gls_glass_1: { ...GLASS, color: 0x1d2724, opacity: 0.22 },
      gls_carbonn: { ...GLASS, color: 0x0a0d10, opacity: 0.86 },
      // The tail-lamp lenses: red glass over the lamp, gloss on top.
      etk800_glass: { ...GLASS, color: 0x6e0710, opacity: 0.8 },
      gls_run: { color: 0x96101a, emissive: 0x7a0610, emissiveIntensity: 1.5, roughness: 0.25 },
      gls_stop: { color: 0x96101a, emissive: 0x3c0308, emissiveIntensity: 0, roughness: 0.25 },
      gls_grille: { color: 0x0a0a0b, metalness: 0.6, roughness: 0.22, clearcoat: 1 },
      // No cabin overrides: loadCar retains the original GLB materials.
      gls_palitra: { color: 0x8c8f94, metalness: 1, roughness: 0.4 },
      etk800: { color: 0x1c1d1f, metalness: 0.2, roughness: 0.7 },
      gavril_v8: { color: 0x3a3b3d, metalness: 0.6, roughness: 0.5 },
      "Scene_-_Root": { color: 0x161616, roughness: 0.86 },
      amdb11_brake: { color: 0x5d6065, metalness: 1, roughness: 0.35 },
      amdb11_caliper: { color: 0x66696e, metalness: 0.6, roughness: 0.32 },
      amdb11_misc_chrome: { color: 0x1c1c1d, metalness: 0.4, roughness: 0.5 },
      amdb11_misc: { color: 0x101010, roughness: 0.8 },
      // The engine bay (split off by tools/cars/*.mjs) as photographed on a
      // GLS 600 (4.0 V8 biturbo): satin charcoal covers and panels, ribbed
      // black rubber intake ducts, a black seal around the bay; the coolant
      // tank is split out under `pieces`.
      engine_alloy: { color: 0x151617, metalness: 0, roughness: .6, specularIntensity: .5 },
      engine_cover: { color: 0x0f1011, metalness: 0, roughness: .7, specularIntensity: .5 },
      engine_plastic: { color: 0x0f1011, metalness: 0, roughness: .82, specularIntensity: .3 },
      engine_metal: { color: 0x0a0a0b, metalness: 0, roughness: .9, specularIntensity: .3 },
    },
    pieces: [
      // The coolant tank, apart from the rubber seal around the bay.
      { node: "gls_dvig_gls_palitra005_0", box: { min: [.36, .82, 1.78], max: [.68, 1.14, 2.3] },
        material: { name: "engine_coolant", color: 0xdcd8cd, metalness: 0, roughness: .36, clearcoat: .4, clearcoatRoughness: .3 } },
      // The three-pointed star on the engine cover, in chrome.
      { node: "gls_engine_stock_gls_kaki025_0", box: { min: [-.1, 1.08, 1.68], max: [.3, 1.16, 2.14] },
        material: { name: "engine_badges", color: 0xe9ebee, metalness: 1, roughness: .12 } },
      // The grille's three-pointed star, modelled in 3D but in black trim:
      // chrome, as on the car, over the gloss black radar disc (star_cover).
      { node: "wheel005_gls_kaki104_0", box: { min: [-.1, .79, 2.54], max: [.1, .955, 2.59] },
        material: { name: "grille_star", color: 0xe7e9ed, metalness: 1, roughness: .14 } },
      // The rear doors' window-frame uprights (front, quarter-glass divider,
      // rear) share the chrome of the window outline. On a real GLS they are
      // piano black; only the outline and beltline are chrome.
      ...[1, -1].map(side => ({
        node: `gls_door_R${side > 0 ? 'L' : 'R'}_wheel_42b038_0`,
        box: [[-.25, -.15], [-.95, -.8], [-1.2, -1.0]].map(([z0, z1]) => ({
          min: [side > 0 ? .6 : -.82, 1.2, z0], max: [side > 0 ? .82 : -.6, 1.7, z1] })),
        material: { name: "pillar_black", color: 0x050506, metalness: 0, roughness: .1, clearcoat: 1, clearcoatRoughness: .05 },
      })),
      // Inside each headlamp, behind the lens: the housing shares the trim's
      // dark chrome and the reflector cells and bezels the bumper's black
      // plastic. On the car the housing is dark graphite and the three
      // MULTIBEAM reflector cells, the projector bezel and the brow's frame
      // are bright chrome, which is what makes a lamp read through its glass.
      { node: "gls_screen_L_gls_black_chrome036_0", box: HEADLAMPS,
        material: { name: "headlamp_housing", color: 0x17191c, metalness: .6, roughness: .4 } },
      { node: "gls_steer_brown_gls_kaki025_0", box: HEADLAMPS,
        material: { name: "headlamp_chrome", color: 0xe2e5e9, metalness: 1, roughness: .12 } },
      // The LED chips in two of the reflector cells, apart from the brow's
      // light: lit with the headlamps (vehicle-parts.js), softer than the
      // brow, so they glow behind the lens rather than reading as stickers.
      { node: "gls_headlight_L_lsiggls001_0", box: [1, -1].map(side => ({
          min: [side > 0 ? .64 : -.73, .915, 2.28], max: [side > 0 ? .73 : -.64, .96, 2.37] })),
        material: { name: "headlamp_led", color: 0x14161a, metalness: 0, roughness: .3, emissive: 0xe4ecff, emissiveIntensity: 0 } },
      // The three-pointed star on the tailgate is chrome on the car; the
      // model left it in the black trim.
      { node: "gls_tailgate_gls_kaki025_0", box: { min: [-.065, 1.23, -2.55], max: [.065, 1.34, -2.46] },
        material: { name: "tailgate_star", ...SATIN_CHROME } },
      // What the model preparation took for the tailgate badge (the second
      // `logo_chrome`) is the rear wiper's pivot cap, which is black.
      { node: "logo_chrome_1", box: { min: [-.1, 1.3, -2.56], max: [.1, 1.45, -2.4] },
        material: { name: "wiper_cap", color: 0x0b0c0d, metalness: 0, roughness: .45 } },
    ],
  },

  x7: {
    url: "/models/x7.glb",
    shadow: "/models/x7-shadow.jpg",
    still: "/stills/x7.webp", // npm run stills
    paint: "carpaint",
    drl: "Front_Lights_emissive",
    // No engine was modelled under the X7's bonnet, so it stays shut.
    openings: {
      Door_FL: { axis: "y", angle: -64 },
      Door_RL: { axis: "y", angle: -64 },
      Door_FR: { axis: "y", angle: 64 },
      Door_RR: { axis: "y", angle: 64 },
      Tailgate: { axis: "x", angle: 72 },
    },
    eye: [0.4, 1.3, -0.14],
    doorway: [1.9, 1.4, 0.2],
    views: views({ engineOpens: [], wheel: [1.0, 0.39, 1.7], boot: [0, 1.05, -2.58] }),
    // Two soft cabin lights (cabin.js) find the original black quilted
    // leather through an open door.
    cabin: true,
    pieces: [
      // The cabin carpet shares the exterior's black trim material; under the
      // cabin light that semi-gloss read as a pale grey slab. Matte black pile.
      { node: "Box010__Kuzov_black_0", box: { min: [-0.85, 0.4, -1.45], max: [0.85, 1.25, 1.25] },
        material: { name: "x7_carpet", color: 0x0b0b0c, metalness: 0, roughness: 0.95, specularIntensity: 0.15 } },
      // The B-pillar trims, whose flap carries each hanging seatbelt down to
      // the floor in its texture. Lit like leather, the belt read as a pale
      // line across the seat; dark and matte, it reads as black webbing.
      { node: "Box002___baked_dveri_0", box: { min: [-0.9, 0.45, -0.45], max: [0.9, 1.25, 0.4] },
        material: { name: "x7_pillar_trim", inherit: true, color: 0x7a7a7a, metalness: 0, roughness: 0.88, specularIntensity: 0.18 } },
    ],
    // No strips in the model, so they're laid along the dash face at 1.02 m
    // and along each door card at 1.05 m (see ambient.js).
    ambient: {
      dash: { material: "baked_Torpeda_mtl", y: 1.02, z: 0.2, x: [-0.74, 0.74] },
      doors: { material: "baked_dveri", y: 1.05, inset: 0.1 },
      lights: [[0, 1.0, 0.6], [0.6, 0.98, 0.2], [-0.6, 0.98, 0.2]],
    },
    parts: {
      Chrome_S: CHROME,
      Chome_R: { color: 0xa9acb1, metalness: 1, roughness: 0.28 },
      MEtal_R: { color: 0x8c9096, metalness: 1, roughness: 0.3 },
      Kuzov_1: { color: 0x0a0a0b, metalness: 0.3, roughness: 0.16, clearcoat: 1 },
      Kuzov_black: { color: 0x0f1011, roughness: 0.5 },
      chassis: { color: 0x0b0b0c, roughness: 0.85 },
      Front_lights_mat_black: { color: 0x0c0d0f, metalness: 0.6, roughness: 0.18 },
      Front_lights_mat_blue: { color: 0x0d2a6b, metalness: 0.6, roughness: 0.14 },
      // A light smoke so the original cabin reads.
      Windows_glass: { ...GLASS, color: 0x1f2426, opacity: 0.22 },
      Panarama_glass: { ...GLASS, color: 0x05070a, opacity: 0.85 },
      Front_lights_glass: { ...GLASS, color: 0x202224, roughness: 0.015, opacity: 0.03 },
      light_glass: { ...GLASS, color: 0x202224, roughness: 0.015, opacity: 0.05 },
      light: { color: 0xeef0f2, metalness: 1, roughness: 0.05 },
      Front_Lights_emissive: { color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 3.5, roughness: 0.2 },
      Back_lights_emissive: { ...GLASS, color: 0x6e0710, emissive: 0x3c0308, emissiveIntensity: 0, opacity: 0.85 },
      red_emiss: { color: 0x96101a, emissive: 0x7a0610, emissiveIntensity: 1.5, roughness: 0.25 },
      Mirror: { color: 0xffffff, metalness: 1, roughness: 0 },
      Mirror_lights_mat: { color: 0xb9bcc0, metalness: 1, roughness: 0.12 },
      Koleso_support: { color: 0x1b3f8f, metalness: 0.4, roughness: 0.35 },
      Koleso_tormoz_disk_mat: { color: 0x5d6065, metalness: 1, roughness: 0.35 },
      baked_Tire: { metalness: 0, roughness: 0.86 },
      baked_Back_seat: LEATHER,
      baked_dveri: LEATHER,
      baked_front_seats: LEATHER,
      baked_Potolok: BAKED,
      baked_steering_wheel_tonel_mtl: LEATHER,
      baked_Torpeda_mtl: LEATHER,
      baked_Back_lights: { metalness: 0, roughness: 0.2 },
      Nomera: { color: 0xf3f1ea, roughness: 0.5 },
    },
  },

  // Land Rover Defender 110 (tools/prep-defender.mjs), dressed as a Fuji
  // White car with the Narvik Black contrast roof: gloss black roof, pillars
  // and DEFENDER lettering, Ceres Silver skid plates and bonnet vents,
  // textured black arches and sills, gloss dark grey wheels.
  defender: {
    url: "/models/defender.glb",
    shadow: "/models/defender-shadow.jpg",
    still: "/stills/defender.webp", // npm run stills
    paint: "defender_paint",
    openings: {},
    ambient: {},
    pieces: [
      // The source also carries the Hard Top's body-coloured panels over the
      // rear quarter windows, a millimetre outside the glass: on this
      // passenger 110 they showed as white slabs, flickering against the
      // glass and its black backing. The quarter windows are glass.
      { node: "Object_56", box: [1, -1].map(side => ({
          min: [side > 0 ? .66 : -.8, 1.42, -1.56], max: [side > 0 ? .8 : -.66, 1.81, -1.11] })),
        material: { name: "defender_hard_top_panels", visible: false } },
    ],
    parts: {
      // Narvik Black: glossy, but the white studio must not wash the roof pale.
      defender_gloss_black: { color: 0x060708, metalness: 0, roughness: 0.3, specularIntensity: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.16 },
      defender_vents: { color: 0xa7abb0, metalness: 1, roughness: 0.36 },
      defender_wheel: { color: 0x2b2d30, metalness: 0.7, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.1 },
      defender_wheel_black: { color: 0x0e0f10, metalness: 0.2, roughness: 0.55 },
      defender_cladding: { color: 0x121314, metalness: 0, roughness: 0.62 },
      defender_black: { color: 0x0c0d0e, metalness: 0, roughness: 0.7 },
      defender_lamp_black: { color: 0x050506, metalness: 0.5, roughness: 0.12 },
      defender_chrome: CHROME,
      defender_tyre: { color: 0x141414, metalness: 0, roughness: 0.86 },
      defender_badge: { metalness: 0.3, roughness: 0.25 },
      defender_glass: GLASS,
      defender_tail_lens: { color: 0x7a0a12, emissive: 0x3c0308, emissiveIntensity: 0.4, metalness: 0, roughness: 0.08, clearcoat: 1 },
      defender_lamp_lens: { color: 0xe8eef2, metalness: 0, roughness: 0.05 },
    },
  },
};
