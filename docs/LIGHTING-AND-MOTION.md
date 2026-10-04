# Lighting and motion — implementation history

The current homepage direction is documented in [REDESIGN-NOTES.md](REDESIGN-NOTES.md). The lighting principles below remain applicable. The previous interactive finale has been removed; the current film has no 360° orbit, return journey, ignition controls or sound.

## Lighting research and application

- [Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html): roughness-dependent environment filtering. The actual studio is captured once at the inspection position, without cars. Its strip fixtures create coherent highlights on clearcoat and chrome. The 1K HDR is used as subdued bounce during that capture. The environment is a static approximation, most accurate at the inspection position.
- [Three.js RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html): broad rectangular sources produce soft automotive highlights. Five exterior sources provide a following key, side separation, front fill and continuous light along the driving route. Area lights do not cast shadows in Three.js; the vehicles use baked contact shadows, and a subtle desktop reflection supplies additional grounding.
- [Official Three.js car example](https://threejs.org/examples/webgl_materials_car.html): layered physical paint, clearcoat, environment lighting and a separate contact-shadow treatment. This project uses the same material principles with the supplied vehicles and inspected material names.
- [Three.js colour management](https://threejs.org/manual/pages/color-management.html): linear lighting calculations, correct texture roles and display conversion. GLTFLoader handles the original material texture colour spaces. ACES tone mapping controls highlights. The GLS cabin base colours and original ambient-strip hue are preserved. The dashboard, leather and wood have corrected metalness/roughness to respond naturally to the cabin lights.

The floor keeps the source colour and normal textures. Its packed metal/roughness response is replaced with matte, nonmetallic slate to avoid a wet, mirror-like floor. A shader approximates soft indirect illumination around the studio's existing strip fixtures. There is no bloom pass.

### Cabin and dashboard displays

Two local area lights represent windscreen and headliner fill. Two short-range accent sources provide subtle light around the console and footwell, using the model's authored purple hue. These lights travel with the vehicle and brighten for the open-door view and respond to ignition in the final lineup. The original interior colour values are unchanged.

The audited `gls_gauges_screen` and `gls_gps_screen` surfaces receive instrument and navigation artwork through [Three.js CanvasTexture](https://threejs.org/manual/pages/canvas-textures.html) and [emissive material maps](https://threejs.org/docs/pages/MeshStandardMaterial.html). The preparation had stripped their UVs; a vehicle-space projection restores them. Clear glazing is assigned only to the triangles over the displays and front headlamps, preserving the window tint elsewhere. The displays are illustrative, with a stationary speed indication and an abstract map; they do not invent stock mileage or verified history.

