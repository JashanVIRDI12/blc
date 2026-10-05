# Baba Luxury Cars — design direction

These notes record earlier design iterations, including the retired Maybach. The current collection is GLS 580, X7 and Defender 110; see README.md for the current experience.

## Homepage structure

1. A shorter showroom film of the Maybach alone: exterior details, bonnet, interior through the open door, door closure, forward departure to the front threshold. There are no full orbits, return loops, engine controls or engine audio.
2. Featured collection, with clear preview labels, search, make filtering and vehicle enquiries.
3. About Baba Luxury Cars on a pinned white stage: the GLS 580 and X7 drive in and stop while the brand story rises in, then drive away. The story sits at left on desktop and above the cars on phones.
4. The Baba standard: three concise disclosures about condition, documentation and the next step.
5. Sell or exchange, retaining the functional valuation enquiry.
6. A compact footer with contact action, navigation and privacy information.

## Research applied

- [Mercedes-Benz: the new Mercedes-Maybach GLS](https://media.mbusa.com/news/the-new-mercedes-maybach-gls). The manufacturer describes Obsidian Black on the lower body with Kalahari Gold above, and a fine dividing pinstripe. The prepared model now uses that two-tone arrangement, applied only to its paint meshes. The shader boundary is recorded in each panel's rest pose so the finish stays attached when the door or bonnet opens. The displayed gold is an art-directed digital approximation, not a certified paint sample. The cabin palette is unchanged.
- [Locomotive / Awwwards: typography in motion](https://assets.awwwards.com/assets/files/live-presentation.pdf). A coherent type direction can establish the composition. Three open-licence serifs were auditioned in the live film hero: Cormorant Garamond, Bodoni Moda and Noto Serif Display. Noto Serif Display was chosen: sharp and modern at display sizes, with a full weight range that keeps small headings solid on phones. [Monotype's review of luxury car typography](https://cms-prod.monotype.com/resources/fonts-and-luxury-brands-cars) notes that high contrast signals elegance and craftsmanship, while most marques run on clean sans-serifs. So Jost, a geometric sans in the Futura tradition, carries the interface.
- [Nielsen Norman Group: Scroll Fading 101](https://www.nngroup.com/articles/scroll-fading-101/). Apply fades sparingly, keep content available and avoid competing moving elements. Below the film, short once-only copy reveals accompany a stationary product composition. The collection remains in normal page flow and the main navigation gives direct access to it.
- [Nielsen Norman Group: The Role of Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/). Motion should communicate an understandable change. The door closes completely before the departure starts, and the next section presents a clear change from cinematic inspection to dealership information.
- [Awwwards / Addy Osmani: Designing for Mobile Performance](https://www.awwwards.com/brainfood-mobile-performance-vol3.pdf). Deliver essential UI first and defer expensive work. The practical site loads separately from Three.js. The white gallery reuses the already loaded geometry and initializes its renderer near the viewport. It renders only on entry or resize. Reduced motion avoids all model downloads.

## Rendering

The original studio and its architectural lights remain in the film. The white gallery uses a separate neutral environment, broad area lights and baked contact shadows. It has no idle animation, audio or orbit controls. On narrow screens it uses a wider lens and a stacked layout. Still images of the same supplied models and updated paint provide fallbacks.

The gallery allocates a second WebGL context only near its section; CPU geometry is shared with the film, with independent material instances. Physical iOS/Safari testing remains outside this local Chrome review.

## Final image pass

The Maybach's rear side and tailgate panes were authored with an almost opaque metallic material, separate from its front glass. They now use a lighter privacy tint, and cabin softboxes reveal the original seats without recolouring them. The front grille slats and surround have their own silver material, selected from the source mesh by connected geometry so nearby black trim stays dark. Film light panels, environment bounce, headlamp spill and studio strips have been lowered to preserve paint definition. The departure camera follows the vehicle instead of leaving an empty room in frame. The active scene restores up to 2× device resolution after a scroll settles, and newly rendered fallback stills are about 1800 pixels wide.

## Dark luxury pass (October 2026)

The page is finished like the Maybach: true black paint, grey gradients read as studio reflections, and a gold coachline as the one recurring device. Its gold was first the Maybach's Kalahari Gold (`#b9a17b`); once the client's logo was in place, every UI gold was resampled from the logo (`#84502c` to `#f2bf5e`). The coachline is the fine pinstripe between the car's two tones. It is under the header as reading progress, and it edges the sections, plinths, forms and dialogs. Gold fills only the wordmark, the main action and the footer's closing line. Templated luxury tells were removed: tracked all-caps eyebrows, 01–04 section numbers (kept only for the Baba Standard's three steps), gold italic accent words and arrows on links. Phones get bottom-sheet dialogs and a full-screen menu. The header turns to pale glass over the white About studio. The one orchestrated moment outside the 3D is the opening title rising, line by line, as the loader clears.

## Brand and performance pass (October 2026)

The client's logo (`blc-logo-transparent.png` from babaluxurycar.com) replaces the typeset wordmark in the loader, header and footer. It also appears on dealer number plates on all three cars. The GLS 580 is now Cavansite Blue. The Maybach's engine bay was recoloured against two CarWale photographs of a GLS 600's engine bay: [one](https://imgd.aeplcdn.com/1280x720/n/cw/ec/177511/maybach-gls-exterior-engine-shot.jpeg) and [two](https://imgd.aeplcdn.com/1280x720/n/cw/ec/181165/mercedes-benz-maybach-gls-engine-shot24.jpeg). The model's engine geometry is a game asset and differs from the real engine; only its finishes were matched.

Scroll lag came from per-pixel shading, not from the main thread. Each frame of the film had shaded nine area lights at up to 2× density. The fixes were to drop the front and rear wall lights, render at a lighter density while moving, decode meshes on workers, and remove blur layered over the moving stage. Measured on the local review machine, a full film scroll went from about 30 fps, with nearly half of all frames over 33 ms, to a steady 60 fps. Phone GPUs gain the most from the pixel reduction; physical-device testing is still outstanding.

The lighter density while moving was then withdrawn, because the client saw it as blur while scrolling. Measured at full density, the film still dropped frames until the two side-wall area lights went as well. A hemisphere fill and slightly stronger room reflections replace them, with no visible change beyond a faint sheen on the lower door. Both scenes now hold 60 fps at a constant 2×. Turning off anti-aliasing was tried and rejected: at phone density the gold pinstripe broke into dots and the grille shimmered. The GLS 580's navy (`#151e38`) was recovered from the first version of the site, by rendering candidates until its door panels matched that version's still.

## Warm luxury pass (October 2026)

The client found the page too plain in type and layout. Current writing on premium sites converges on the same few moves: editorial typography doing the heavy lifting, with large display type against small supporting text ([Banff Digital: The New Editorial](https://banffdigital1.lovable.app/blog/web-design/editorial-web-design-2026), [Line25: Web Design Trends 2026](https://line25.com/articles/web-design-trends-2026/)); restraint and generous space; and rich, deep colour used sparingly rather than flat black ([Designveloper: luxurious websites](https://www.designveloper.com/blog/luxurious-websites)).

- Palette: a warm dark direction (espresso, walnut, a Grasmere green for the Baba standard, cognac light and a film grain) was tried and reverted at the client's request; the page stays black and gold for now.
- Type: Bodoni Moda was tried first; on black its hairlines went spindly and its numerals made model names such as GLS 580 look fussy. Fourteen serifs were then set side by side on black (Newsreader, Source Serif 4, Playfair Display, Cormorant Garamond, Fraunces, DM Serif Display, Instrument Serif, Libre Caslon Display, Noto Serif Display, Gloock, Marcellus and others). Newsreader, in its light display cut, kept clean model numbers, enough weight to hold on black and an elegant true italic. Manrope replaces Jost for a finer, more contemporary small text.
- Film overlay: rewritten as an Indian pre-owned luxury dealer (paint and accident history, tyre age, service book, odometer, RC and insurance, test drive, exchange). Labels are solid tags and notes sit on dark gold-edged panels with checklist tags, so they read over the bright ceiling, chrome or tyres. The service promises in it (disclosing repaints, showing records) should match the dealership's actual practice.
- The Baba standard is the one orchestrated moment outside the 3D. Four React Bits components are ported to GSAP and plain WebGL: LightRays, BlurText, ShinyText and SpotlightCard. The accordion opens one step at a time. The rays first filled the whole section, so opening a step resized their canvas on every frame: it blanked and the rays were re-aimed. They now sit in a fixed, screen-tall band that fades out before it ends.
- Collection cards show two manufacturer figures each (power and 0–100 km/h, or wading depth and approach angle for the Defender), all already sourced in `src/config.js`.
- Paint (`src/paint.js`): metallic flakes, flop and orange peel, each faded out where the pixel cannot resolve it, so nothing flickers.
- Lamps (`src/lamp-glow.js`, `src/models.js`): the GLS's tail-lamp reflectors were bright chrome. Seen through a lens that can only darken, they read as grey bars, so they are now red-tinted chrome that catches the light guides' glow. The lens is a clearer, deep ruby glass. The light guides are dark ruby when off and run hot when lit, and every lit lamp gets an additive halo that follows its emissive intensity, in place of a bloom pass.

