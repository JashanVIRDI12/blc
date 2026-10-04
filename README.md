# Baba Luxury Cars

A premium pre-owned dealership homepage built with Vite, Three.js and GSAP. A showroom inspection film of the Mercedes-Benz GLS 580 leads into the white Featured Collection, then About Baba (the GLS 580 and a Land Rover Defender 110 drive in and away on a white stage), The Baba Standard, Sell or Exchange, and the footer.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5174
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

`dist/` is the static production site. Asset paths assume hosting at the domain root.

## Experience

The film inspects one car: the Mercedes-Benz GLS 580 in Cavansite Blue. Its glazing follows the real GLS (X167): the windscreen and front door glass are clear, with the faint green-grey of heat-insulating glass, so the cabin reads; the rear door and quarter windows, tailgate glass and roof are dark privacy glass, standard on the GLS, and the rear doors' window-frame uprights are piano black, with chrome only on the window outline and beltline. Its engine bay is finished from photographs of a real GLS (satin charcoal covers, black ducts, a white coolant tank, a chrome star): `tools/cars/gls.mjs` splits the bay's materials from the exterior's. Its stars are as on the car: the grille's 3D star is chrome on a gloss black disc, the bonnet badge and wheel centre caps (blank discs in the source) each get a faceted chrome star and ring on gloss black enamel, built in `src/badges.js` and fitted to each disc (the wheel stars turn with their wheels), and the tailgate star, left in black trim by the source, is satin chrome; the piece the model preparation took for the tailgate badge is the rear wiper's pivot cap, now black. Its headlamps read through their glass: behind a clear lens the housing is dark graphite, the three MULTIBEAM reflector cells and bezels are chrome, the LED chips glow softly in their cells, the projector is dark optical glass, and the brow carries the daytime running light. All glass on the cars reflects at full strength over its tint, more at a glance than head-on (`src/glass.js`): three.js would otherwise scale reflections by opacity, so a clear lens all but vanished. After the engine and the open-door interior reveal, the camera pulls back, the door closes, and the car drives forward towards the front doorway. There are no 360° orbits, parked return loops, engine buttons or sound.

The film is set in the supplied car showroom (`car-showroom_2.glb`), prepared with `npm run model:showroom` into `public/models/showroom.glb`. It is a 26.3 m square room under a luminous ceiling grid, each panel a softly lit diffuser, glowing warm and brightest over the inspection stage. Its walls are fluted smoked oak, slat by slat a shade apart; light slots stand in the panel-seam reveals 5.32 m and 10.64 m from each wall's centre line, and an LED shadow-gap skirting runs along the floor. The floor is polished large-format stone in 1.33 m tiles on the walls' panel grid, with a flush turntable ringed by a warm LED line at the inspection mark, and a light strip crosses each threshold (`src/showroom-floor.js`). The doorways stand in bronze portals. The Baba logo is lit on the back wall, beside the drive-in doorway, for the whole film (`src/studio-environment.js`). The slots, skirting, ring and logo are all captured into the car's reflections, so the paint reflects clean studio light shapes; the grid between the ceiling panels reflects as a soft line, so the bodywork's ripples never wobble. Drive-in (rear) and drive-out (front) doorways are cut at existing wall-panel seams, and the front and rear walls bounce light only either side of them, so a car crossing a threshold is lit evenly. The film opens in the lit showroom with the GLS emerging through the rear doorway, and anything beyond the walls fades into darkness. The GLS's walkaround circles the car in one direction and covers less than a full turn: rear three-quarter, right flank, front wheel, bonnet, then the driver's door. The camera keeps moving between these points instead of stopping at each one. The camera then turns to follow the GLS out, and the film ends as it crosses the front threshold, tail lamps lit. The film keeps drawing while it scrolls away, so the scrub settles on that last frame.

The film uses an editorial type hierarchy: quiet Jost chapter labels, clean ivory Noto Serif Display headlines, and short supporting notes. “Choosing well.”, “Beyond beautiful.” and “Yours, to drive.” sit between the room and the car, so the bodywork passes in front of the words. These titles drift gently with the scroll, reversing with it; the wheel, engine and cabin shots use smaller foreground headlines. Each line is rasterised into its own texture band, with correct display colour and device-pixel alignment. Broad, soft shading keeps the room behind the type quiet without darkening the car or surrounding every letter with a heavy shadow. Phone captions sit at the foot of the stage, clear of the moving subject. As the loader clears, the opening title rises into place. The chapter rail jumps through the film, and the DOM headings retain the accessible text and static fallback.

The white Featured Collection follows the film directly. About Baba comes next: a pinned white stage on which the Mercedes-Benz GLS 580 (Cavansite Blue) and the Land Rover Defender 110 drive in out of the white, stop side by side, and hold while the introduction is read in, then drive away out of frame. The Defender is dressed as a Fuji White car (Land Rover paint 867, a solid white) with the Narvik Black contrast roof: gloss black roof, pillars and DEFENDER lettering, Ceres Silver skid plates and bonnet vents, textured black arches, gloss dark grey wheels. The source also carries the Hard Top's body-coloured panels a millimetre outside the rear quarter glass; they are hidden, so the passenger 110's quarter windows show glass instead of flickering white slabs, and the About camera's near plane stands well out, so the depth buffer stays fine at its 22–27 m distance. The introduction uses a word-by-word reveal after the Text Reveal component on 21st.dev (Magic UI): every word waits as a faint ghost and fills in to full ink as the scroll moves on (`src/text-reveal.js`); the link and sign-off follow once it is set. They enter across the frame while the copy is still hidden and leave away from it. The scroll position is the only clock, so scrolling back replays it exactly. Desktop places the copy at left and the cars at right; phones and other tall screens stack the copy above the cars. The camera's lens and framing are fitted to whatever space the laid-out copy leaves. The two models load in the background once the film is ready, and still images of the same cars stand in until they arrive. Links to `#about` land where the cars are parked and the copy is set.

## Look

The film is tone mapped with Khronos PBR Neutral, which reproduces base colours one to one and compresses only the highlights, so the Cavansite Blue reads as itself rather than near-black.

The page uses a black-and-gold finish. The ground is true black paint (OLED phones render it as black), and soft grey gradients read as studio light reflected in it. Gold appears as a fine coachline. That line runs under the glass header and fills as you read down the page. It also edges the sections, the collection plinths, the forms and the dialogs. The brand is the client's own logo (`public/brand/`, from `source/blc-logo-transparent.png`, as published on babaluxurycar.com). It appears in the loader, header and footer, and on the number plates. All UI gold is sampled from the logo, `#84502c` to `#f2bf5e`, so text, lines and buttons match it. Solid gold fills only the main action and the closing "Let's find your car." Noto Serif Display (OFL) sets the statements and car names; Jost (OFL) sets everything small. Both are self-hosted Latin subsets.

The collection shows each car in a lit vitrine. Cut-out renders stand on the plinth; photographs fill the frame. The page tells them apart by the transparency of the image's corner, so real photos need no code change. On phones, the vehicle details and enquiry dialogs rise as bottom sheets, and the menu fills the screen. The header turns to pale glass while the white About studio is under it.

Every car wears a dealer number plate front and rear: black acrylic with the Baba logo in gold foil (`src/plates.js`). The mounts in `src/vehicle-parts.js` were found by probing each bumper and tailgate along the centre line.

## Performance

Both 3D stages render at one constant sharpness, moving or still (`src/render-density.js`): the screen's own density up to 2×, and on desktop screens below 2× the frame is supersampled towards 2× within a pixel budget (a 1440 × 920 Retina frame), so a 1× monitor gets smooth edges and fine detail rather than MSAA alone. MSAA stays on throughout, and car textures are filtered anisotropically. The showroom is lit by one area light, the luminous ceiling; the room's captured reflections (512 px on larger screens) and a hemisphere fill supply the wall bounce. Every area light is shaded for every car pixel, so dropping the wall lights is what makes full sharpness affordable. The floor reflection is drawn small, multisampled, and read from its mipmaps, so thin lights reflect as soft lines rather than ghosted, dotted copies. A device that still cannot keep up first loses the floor reflection, then steps its density down, for good, never below 1.5×: only sustained slowness counts, never the warm-up frames while textures upload. Compressed meshes decode on background workers, so the About cars arriving mid-film never stall a frame. Blurred glass is never layered over a moving 3D stage.

## Configuration

`src/config.js` holds the dealership identity, contact information, optional enquiry endpoint and inventory. The supplied models are showcase vehicles, not proof of availability. The current collection contains the Mercedes-Benz GLS 580, BMW X7 and Land Rover Defender 110. With no real stock records, the collection labels its entries as previews and does not invent prices or inspection details. See [the inventory contract](docs/INVENTORY.md).

Until a contact or delivery endpoint is configured, the forms prepare copyable/downloadable drafts and explicitly state that nothing was sent. A configured endpoint supports online delivery with a draft fallback on error.

## Files

| File | Responsibility |
| --- | --- |
| `src/storyboard.js` | Film camera frames, the GLS's route, bonnet/door timing and copy timing |
| `src/camera-path.js` | Continuous-velocity camera spline; true arcs around the inspected car |
| `src/showroom-room.js` | Measured showroom walls, ceiling and doorways (shared with tests and prep) |
| `src/studio-environment.js` | Showroom finishes (fluted oak, light slots, LED skirting, diffuser ceiling, bronze portals, the lit logo), ceiling switch-on and reflection capture |
| `src/showroom-floor.js` | Polished stone floor, turntable and its LED ring, skirting spill and threshold strips (also lines the reflection capture) |
| `src/glass.js` | Car glass: reflections at full strength over the tint, Fresnel at a glance |
| `src/badges.js` | Faceted chrome Mercedes stars on the GLS's bonnet badge and wheel caps |
| `src/render-density.js` | Render density for both 3D stages: native up to 2×, desktop supersampled, one-way fallback |
| `src/type-plane.js` | Film headlines rasterised from the DOM and drawn between the room and the cars (or over them) |
| `src/styles.css` | Tokens, fonts, header, menu, loader, collection, standard, sell, footer, forms and dialogs |
| `src/film.css` | The showroom film's layout, typography, chapter rail and tethered labels |
| `src/cinema.js` | One reversible GSAP film playhead |
| `src/motion.js` | Arc-length travel, steering, wheel distance and restrained body pitch |
| `src/showroom.js` | Film renderer, studio lights and loaded vehicle geometry |
| `src/about-drive.js` | About Baba: the pinned white stage, its renderer and copy reveal |
| `src/text-reveal.js` | Scroll-linked word-by-word text reveal (after Magic UI's Text Reveal) |
| `src/about-storyboard.js` | About lanes, parking marks, copy timing and camera drift |
| `src/about-framing.js` | Fits the About camera to the space beside or below the copy |
| `src/paint.js` | Two-tone body finish and fine dividing stripe |
| `src/plates.js` | Baba dealer number plates, front and rear, on every car |
| `src/cabin.js` | Cabin lighting, actual dashboard displays and glazing |
| `src/about.css` | The white About studio, static and pinned |
| `src/inventory.js` | Filtering, vehicle cards and details |
| `src/forms.js` | Enquiry and valuation handling |

The existing model preparation and inspection scripts remain in `tools/`. `docs/model-audit.json` (GLS 580, X7) and `docs/showroom-audit.json` record the supplied geometry. `npm run model:defender` prepares the Defender (`tools/prep-defender.mjs`: drops two stray badges 98 m away and the source plates, scales it to 5,018 mm, rigs the wheels on their axles, names its materials in English) and bakes its shadow (`tools/prep-studio.mjs` and `docs/studio-audit.json` belong to the previous studio, which the film no longer loads). The X7's bonnet remains closed because its source does not contain an engine. `npm run model:x7` keeps the X7's original baked interior (an earlier version re-toned it beige and brown).

## Browser review and preview images

Use Node 22+ with Vite and a local Chrome debugging session:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9222 --user-data-dir=/tmp/baba-browser-review --no-first-run about:blank
npm run check:browser
npm run check:browser -- --smoke --retina
npm run stills
STILLS=gls npm run stills   # only the listed showcase IDs
```

The existing `FORMA_SITE_URL`, `FORMA_CDP_URL` and `FORMA_REVIEW_DIR` environment overrides remain compatible. Screenshots default to `/tmp/baba-review`. The checks never send enquiries to a configured endpoint.

Reduced motion skips the film and all GLB downloads. Loading failures, WebGL failure and context loss retain the practical site and vehicle stills. Local fonts and models avoid third-party runtime requests. Rendering stops when unchanged or hidden.

[Design research](docs/REDESIGN-NOTES.md) · [Refined creative prompt](docs/IMPROVED-PROMPT.md) · [Client handoff](docs/HANDOFF.md) · [Lighting notes](docs/LIGHTING-AND-MOTION.md)
