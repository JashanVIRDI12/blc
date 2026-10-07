# Baba Luxury Cars

A premium pre-owned dealership website built with Vite, Three.js and GSAP: the homepage film, a collection page, a page for each car, and an admin portal where the dealership manages the stock (Supabase). See [the admin guide](docs/ADMIN.md).

The homepage: A showroom inspection film of the Mercedes-Benz GLS 580 leads into the white Featured Collection, then About Baba (the GLS 580 and a Land Rover Defender 110 drive in and away on a white stage), The Baba Standard, Sell or Exchange, and the footer.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5174
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

`dist/` is the static production site. Asset paths assume hosting at the domain root.

## Pages

| Page | Path | What it is |
| --- | --- | --- |
| Home | `/` | The showroom film; the collection drive (five cars drive out of the white and park in formation above *Luxury cars. Trusted deals.*); the Featured collection (chosen in the admin); About; *Across India*, a map with gold lines from Paschim Vihar to the places the cars have come from and gone to, counters and the handover photos (`src/across-india.js`, `src/india-map.js` from Natural Earth's India view, `src/places.js`). The Baba standard and the valuation form are off the home page for now (their code stays, for a Sell page) |
| Collection | `/collection/` | Light theme, white with black bands. The collection drive opens the page (the five cars arrive and park in front of a wall-high *COLLECTION*; see below), then Baba's four promises, the luxury marques Baba sources as a quiet logo strip (it drifts and quickens with the scroll; pointing at a marque stops it and names it with its stock; a click filters the cars, or asks Baba to find one), body-style tabs with counts and the stock at a glance, a filter drawer led by the curated collections (then make, budget, kilometres, fuel, gearbox, year, availability), removable filter tokens, grid or list, a shortlist kept in the browser, *Recently delivered* on black, and a sourcing request. GSAP unveils the title letter by letter and each row of cards. Filters live in the address, so a view can be shared |
| A car | `/car/?id=…` | Light theme. Swipeable gallery with lightbox, price in lakh/crore, facts, Arrange a viewing / WhatsApp / Call / Share, highlights, specification, inspection, similar cars on black, a phone enquiry dock, schema.org `Car` data. **Baba Concierge**: buyers choose modifications and services (grouped; off-road for SUVs), gathered on a build sheet and sent on WhatsApp or as a call-back request |
| Concierge | `/concierge/` | Any car, sourced: a ring of the luxury marques turns beside the promise; the brief (marque, model, year, spec, budget, timing, extras) gathers on a card that sends it to the concierge on WhatsApp or as a call-back request; how it works, on a gold line that draws with the scroll; the services. `?marque=Bentley` arrives with the marque chosen (the collection's strip sends marques not in stock here). |
| Admin | `/admin/` | Cars, Home page, Collections and Settings ([guide](docs/ADMIN.md)) |

The public pages share their header, footer and dialogs through `partials/`, set into each page at build time (`vite.config.js`).

## The collection drive

On a seamless white stage after the film (`src/fleet-drive.js`, `src/fleet-storyboard.js`), a Toyota Land Cruiser 300, a Land Rover Defender 110 (in Carpathian Grey with the Narvik Black roof, for this scene only), a Mercedes-Maybach S 580, the GLS 580 and the X7 set off line abreast out of the white and drive towards the visitor. They brake in turn, the outer pair first, into a V led by the Maybach (on phones, a narrower arrowhead seen from higher). They park in a tight V seen from near their own height, as large as the space between the header and the words allows; the words sit in a bar beneath them and rise in as the section settles. The cars carry no names and open nothing: the picture is only a picture. The scroll is the only clock, so it reverses exactly. The stills stand in until the models arrive, and without WebGL.

The same drive opens the collection page (`mode: 'stage'`). There it runs on its own clock as the page opens, over 4.6 seconds. The cars park in a tighter V, seen from nearer their own roof height, so the group fills the width. A wall-high *COLLECTION* stands behind them, and the cars cover the lower part of its letters. The canvas is transparent: far away, the cars fade towards clear rather than towards white, so they never veil the title. Whatever height is left over is shared above the title and above the words beneath (`--stage-shift`). A fine pointer sways the camera a little, the title less and the dust more, by depth. As the page scrolls on, the title lags and pales. Reduced motion and WebGL failure show the stills (`*-fleet.webp` for the repainted cars, from `FLEET=1 npm run stills`) in the same arrangement; reduced motion downloads no models.

Dust is in the air on both stages: motes drift on slow currents behind and in front of the cars, brightening as they turn through the light (`src/dust.js`, two light 2D canvases, paused off screen). As the cars roll, their tyres throw a little dust back and out across the floor, which billows and settles (`src/road-dust.js`, in the WebGL scene, so the cars hide what is behind them).

The three new models came from the supplied files and are prepared by `npm run model:fleet` (`tools/prep-fleet.mjs`; the i7's FBX is converted by `tools/fbx-to-glb.py`, from `5309329.6476c45879370.rar` extracted to `source/i7/`). Each is scaled to its real length (5,469, 5,391 and 4,985 mm), turned nose forward, grounded, its wheels grouped to roll (the S-Class's tyres, modelled one per axle, are split by side), simplified (the Land Cruiser from 1.1 million triangles to 174,000; paint and glass keep nearly all theirs, since their double layers fold through each other when simplified coarsely) and compressed to 1.7–3.1 MB. The i7 wears matte Frozen Deep Grey; it is a showcase model in the collection and has its own page, but is no longer in the drive. The cars in the drive wear no plates.

## Experience

The film inspects one car: the Mercedes-Benz GLS 580 in Cavansite Blue. Its glazing follows the real GLS (X167): the windscreen and front door glass are clear, with the faint green-grey of heat-insulating glass, so the cabin reads; the rear door and quarter windows, tailgate glass and roof are dark privacy glass, standard on the GLS, and the rear doors' window-frame uprights are piano black, with chrome only on the window outline and beltline. Its engine bay is finished from photographs of a real GLS (satin charcoal covers, black ducts, a white coolant tank, a chrome star): `tools/cars/gls.mjs` splits the bay's materials from the exterior's. Its stars are as on the car: the grille's 3D star is chrome on a gloss black disc, the bonnet badge and wheel centre caps (blank discs in the source) each get a faceted chrome star and ring on gloss black enamel, built in `src/badges.js` and fitted to each disc (the wheel stars turn with their wheels), and the tailgate star, left in black trim by the source, is satin chrome; the piece the model preparation took for the tailgate badge is the rear wiper's pivot cap, now black. Its headlamps read through their glass: behind a clear lens the housing is dark graphite, the three MULTIBEAM reflector cells and bezels are chrome, the LED chips glow softly in their cells, the projector is dark optical glass, and the brow carries the daytime running light. All glass on the cars reflects at full strength over its tint, more at a glance than head-on (`src/glass.js`): three.js would otherwise scale reflections by opacity, so a clear lens all but vanished. After the engine and the open-door interior reveal, the camera pulls back, the door closes, and the car drives forward towards the front doorway. There are no 360° orbits, parked return loops, engine buttons or sound.

The film is set in the supplied car showroom (`car-showroom_2.glb`), prepared with `npm run model:showroom` into `public/models/showroom.glb`. It is a 26.3 m square room under a luminous ceiling grid, each panel a softly lit diffuser, glowing warm and brightest over the inspection stage. Its walls are fluted smoked oak, slat by slat a shade apart; light slots stand in the panel-seam reveals 5.32 m and 10.64 m from each wall's centre line, and an LED shadow-gap skirting runs along the floor. The floor is polished large-format stone in 1.33 m tiles on the walls' panel grid, with a flush turntable ringed by a warm LED line at the inspection mark, and a light strip crosses each threshold (`src/showroom-floor.js`). The doorways stand in bronze portals. The Baba logo is lit on the back wall, beside the drive-in doorway, for the whole film (`src/studio-environment.js`). The slots, skirting, ring and logo are all captured into the car's reflections, so the paint reflects clean studio light shapes; the grid between the ceiling panels reflects as a soft line, so the bodywork's ripples never wobble. Drive-in (rear) and drive-out (front) doorways are cut at existing wall-panel seams, and the front and rear walls bounce light only either side of them, so a car crossing a threshold is lit evenly. The film opens in the lit showroom with the GLS emerging through the rear doorway, and anything beyond the walls fades into darkness. The GLS's walkaround circles the car in one direction and covers less than a full turn: rear three-quarter, right flank, front wheel, bonnet, then the driver's door. The camera keeps moving between these points instead of stopping at each one. The camera then turns to follow the GLS out, and the film ends as it crosses the front threshold, tail lamps lit. The film keeps drawing while it scrolls away, so the scrub settles on that last frame.

The film speaks as a pre-owned luxury dealer in India would: what a buyer checks, chapter by chapter. Paint, repaints and accident history; tread depth, tyre age and brakes; the service book, odometer and RC; the cabin and a test drive; then exchange and paperwork. Headlines are light Newsreader: “Choosing well.”, “Honest bodywork.” and “Drive it home.” sit between the room and the car, so the bodywork passes in front of the words. The overlay is built to read over anything the film shows: each chapter's label is a pair of solid tags, and its note sits on a dark, gold-edged panel with the chapter's checks listed beneath it as tags (solid, never blurred over the moving stage). These titles drift gently with the scroll, reversing with it; the wheel, engine and cabin shots use smaller foreground headlines. Each line is rasterised into its own texture band, with correct display colour and device-pixel alignment. Broad, soft shading keeps the room behind the type quiet without darkening the car or surrounding every letter with a heavy shadow. Phone captions sit at the foot of the stage, clear of the moving subject. As the loader clears, the opening title rises into place. The chapter rail jumps through the film, and the DOM headings retain the accessible text and static fallback.

The white Featured Collection follows the film directly. About Baba comes next: a pinned white stage on which the BMW X7 (navy metallic) and the Land Rover Defender 110 drive in out of the white, stop side by side, and hold, then drive away out of frame. The Defender is dressed as a Fuji White car (Land Rover paint 867, a solid white) with the Narvik Black contrast roof: gloss black roof, pillars and DEFENDER lettering, Ceres Silver skid plates and bonnet vents, textured black arches, gloss dark grey wheels. The source also carries the Hard Top's body-coloured panels a millimetre outside the rear quarter glass; they are hidden, so the passenger 110's quarter windows show glass instead of flickering white slabs, and the About camera's near plane stands well out, so the depth buffer stays fine at its 22–27 m distance. The introduction is always set: a two-line headline whose second line turns in italic, in the logo's deep gold, with the introduction in the text face and a signature line beneath. The camera looks up the lanes as the cars appear and turns with them, so they arrive beside the copy (below it on phones), never behind it, and leave away from it. The scroll position is the only clock, so scrolling back replays it exactly. Desktop places the copy at left and the cars at right; phones and other tall screens stack the copy above the cars. The camera's lens and framing are fitted to whatever space the laid-out copy leaves. The two models load in the background once the film is ready, and still images of the same cars stand in until they arrive. Links to `#about` land where the cars are parked and the copy is set.

## Look

The film is tone mapped with Khronos PBR Neutral, which reproduces base colours one to one and compresses only the highlights, so the Cavansite Blue reads as itself rather than near-black.

The page uses a black-and-gold finish. The ground is true black paint (OLED phones render it as black), and soft grey gradients read as studio light reflected in it. Gold appears as a fine coachline. That line runs under the glass header and fills as you read down the page. It also edges the sections, the collection plinths, the forms and the dialogs. The brand is the client's own logo (`public/brand/`, from `source/blc-logo-transparent.png`, as published on babaluxurycar.com). It appears in the loader, header and footer, and on the number plates. All UI gold is sampled from the logo, `#84502c` to `#f2bf5e`, so text, lines and buttons match it. Solid gold fills only the main action and the closing "Let's find your car." Newsreader (OFL), a refined serif with true italics and optical sizes, sets the statements in its light display cut and car names a step heavier, with lining figures for model numbers; where a headline turns on its second line, that line is italic. Manrope (OFL) sets everything small. Both are self-hosted Latin subsets.

The Baba standard has one orchestrated entrance, after four React Bits components ported to GSAP and plain WebGL (`src/standard.js`, `src/light-rays.js`): the coachline draws out and gold light rays fall from it (LightRays), the headline blurs into focus word by word (BlurText), its italic line then catches the light now and then (ShinyText), and a warm spotlight follows the pointer along each step (SpotlightCard). The steps open one at a time, with the coachline drawn under the open one. Reduced motion keeps the section still and the steps open natively. The rays canvas is one screen tall, so opening a step never resizes or re-aims it.

Sell or exchange is interactive (`src/valuation.js`). Beside the form, a card shows the car being described as it is typed. It has an Indian high-security number plate (chakra hologram and IND), the car's name and an odometer whose drums roll to the kilometres entered, read out in thousands or lakhs ("1.25 lakh km"). It also shows the owner and an exchange badge, and it tilts towards the pointer. Registration numbers are capitalised as typed and grouped on leaving the field (state, Delhi and Bharat series). Popular luxury makes are one tap each. Every finished field ticks, a five-step bar counts them, the action lights up once all five are in, and preparing the enquiry stamps the card. Field names and submission (`src/forms.js`) are unchanged.

Car paint is built up as on a real car (`src/paint.js`): metallic flakes that break highlights into fine glints in close-ups and fade into the base coat's roughness where they cannot be resolved, a metallic flop that darkens the flanks, and a faint orange peel in the clear lacquer. Lit lamps glow beyond their edges (`src/lamp-glow.js`); the GLS's tail lamps are dark ruby glass over red-tinted reflectors and LED light guides that run hot when lit.

The collection shows each car in a lit vitrine, with two manufacturer figures beneath its name. Cut-out renders stand on the plinth; photographs fill the frame. The page tells them apart by the transparency of the image's corner, so real photos need no code change. On phones, the vehicle details and enquiry dialogs rise as bottom sheets, and the menu fills the screen. The header turns to pale glass while the white About studio is under it.

Every car wears a dealer number plate front and rear: black acrylic with the Baba logo in gold foil (`src/plates.js`). The mounts in `src/vehicle-parts.js` were found by probing each bumper and tailgate along the centre line.

## Performance

Both 3D stages render at one constant sharpness, moving or still (`src/render-density.js`): the screen's own density up to 2×, and on desktop screens below 2× the frame is supersampled towards 2× within a pixel budget (a 1440 × 920 Retina frame), so a 1× monitor gets smooth edges and fine detail rather than MSAA alone. MSAA stays on throughout, and car textures are filtered anisotropically. The showroom is lit by one area light, the luminous ceiling; the room's captured reflections (512 px on larger screens) and a hemisphere fill supply the wall bounce. Every area light is shaded for every car pixel, so dropping the wall lights is what makes full sharpness affordable. The floor reflection is drawn small, multisampled, and read from its mipmaps, so thin lights reflect as soft lines rather than ghosted, dotted copies. Whether the floor reflects is decided once, behind the loader, by timing a few frames to completion: a device whose typical frame takes over 11 ms starts without it. The floor never changes in view; switching the reflection off mid-film turned the polished floor matte in front of the visitor. A device that still cannot keep up steps its density down, for good, never below 1.5×: only sustained slowness counts, never the warm-up frames while textures upload. Compressed meshes decode on background workers, so the About cars arriving mid-film never stall a frame. Blurred glass is never layered over a moving 3D stage.

## Configuration

Stock, collections, the home page's picks and contact details are managed in the admin portal and stored in Supabase: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example` and [the admin guide](docs/ADMIN.md); the database is created by `supabase/schema.sql`). Without them, the site runs from `src/config.js` and the admin opens in a browser-only preview mode.

`src/config.js` holds the dealership identity, fallback contact information, optional enquiry endpoint, the showcase models and fallback inventory. The supplied models are showcase vehicles, not proof of availability. The current collection contains the Mercedes-Benz GLS 580, BMW X7 and Land Rover Defender 110. With no real stock records, the collection labels its entries as previews and does not invent prices or inspection details. See [the inventory contract](docs/INVENTORY.md).

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
| `src/split-words.js` | Wraps each word of an element in a span, for the Baba standard's BlurText headline |
| `src/about-storyboard.js` | About lanes, parking marks, copy timing and camera drift |
| `src/about-framing.js` | Fits the About camera to the space beside or below the copy |
| `src/paint.js` | Two-tone body finish and fine dividing stripe |
| `src/plates.js` | Baba dealer number plates, front and rear, on every car |
| `src/cabin.js` | Cabin lighting, actual dashboard displays and glazing |
| `src/about.css` | The white About studio, static and pinned |
| `src/data.js` | Loads stock, collections and settings (Supabase, or `config.js`); prices in lakh/crore, badges, ordering |
| `src/cards.js` | The vehicle card everywhere (GlareHover sweep, status badge, shortlist), scroll reveal |
| `src/inventory.js` | The home page's Featured collection |
| `src/collection-page.js`, `src/collection.css` | The collection page |
| `src/vehicle-page.js`, `src/vehicle.css` | A car's own page |
| `src/chrome.js` | Menu, inner-page header, admin-preview banner |
| `src/fleet-drive.js`, `src/fleet-storyboard.js`, `src/fleet.css` | The collection drive: pinned on the home page, opening the collection page (`mode: 'stage'`) |
| `src/lights-on.js`, `src/lights-on-storyboard.js` | The home page's collection, *Lights on*: four cars (no Land Cruiser) parked in the dark, headlamps on; the camera tracks along them as a light comes up over each, then the studio turns white and the words rise. Every light follows the scroll, so it reverses exactly |
| `src/delivered.js` | The collection page's *Now with their new owners*: the cars sold and the handover photos on a 3D ring (pinned and turned by the scroll on a computer, swiped on a phone), with an odometer of cars handed over |
| `src/dust.js`, `src/road-dust.js` | Dust in the drive: motes in the air, and dust lifted by the tyres |
| `src/concierge-page.js`, `src/concierge.css`, `src/marque-art.js` | The Concierge page, and drawing the marques at an even weight |
| `src/marques.js`, `public/brands/marques/` | The marque logos: Simple Icons paths, and ink masks of the four logos from babaluxurycar.com |
| `src/listing-rules.js` | The dealership's ad rules: registration shown by its first characters, Fancy/VIP number tags, "Driven 75,000" (never km), insurance as Valid or Expired |
| `src/parse-ad.js` | Reads a WhatsApp ad (the team's format) into a car's fields; used by the admin's *Fill from a WhatsApp ad* |
| `src/admin/overview.js`, `enquiries.js`, `deliveries.js`, `ad-text.js` | The admin's Overview, enquiry inbox, deliveries gallery, and a car's WhatsApp ad |
| `src/light.css` | The light theme of the collection and car pages |
| `tools/prep-fleet.mjs`, `tools/fbx-to-glb.py`, `tools/inspect-car.mjs` | Preparing the collection drive's new models |
| `src/admin/` | The admin portal: `store.js` (Supabase or browser preview), `cars.js`, `photos.js`, `home.js`, `collections.js`, `settings.js` |
| `supabase/schema.sql` | Tables, row-level security, photo bucket and starting collections |
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
