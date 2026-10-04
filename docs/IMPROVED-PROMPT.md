# Baba Luxury Cars — refined creative and implementation brief

Create a client-ready homepage for **Baba Luxury Cars**, a premium pre-owned vehicle dealership. Baba is the brand. The BMW X7, Mercedes-Benz GLS 580 and Land Rover Defender 110 are examples of its collection, not separate manufacturer campaigns. Build on the existing site, supplied vehicle models, and supplied studio. Keep the result restrained, credible, responsive, and practical to use.

## Art direction

Use a dark architectural studio (fluted wood walls, a warm ceiling, the Baba logo lit on the back wall) for one short, continuous scroll-controlled film. Headlines must always read: soft halos, calm skies behind them, nothing bright parked behind a line while it is read. Follow it with a dark luxury page: featured collection, Baba's introduction, dealership standards, one sell or exchange section, and a concise footer. The page uses a black-and-gold finish. The ground is true black paint, with grey gradients read as studio reflections. Gold sampled from the Baba logo appears as a fine coachline, and fills only the wordmark, the main action and the closing line. Baba's introduction is the one white room: a lit studio for the GLS 580 and X7, edged in the gold coachline. Set statements in a high-contrast serif (Noto Serif Display) and everything small in a geometric sans (Jost). Use generous space, strong type hierarchy and precise details. Avoid tracked all-caps labels, numbered markers on anything that is not a sequence, single accented words in headlines, arrows appended to links, excessive cards, neon, heavy bloom, and copy that sounds like a generic luxury template. Motion answers the visitor. The one orchestrated moment outside the 3D is the opening title rising as the loader clears.

The GLS 580 is the hero, in Cavansite Blue, glazed like the real GLS: clear front glass with a faint green-grey tint, dark privacy glass behind the B-pillars, piano-black window-frame uprights, and an engine bay finished from photographs of a real GLS. The Defender 110 is Fuji White (Land Rover paint 867) with the Narvik Black contrast roof.

## Film choreography

The film inspects the GLS alone. The car enters under its own power, settles, and is inspected through deliberate camera moves. Show bodywork, wheels, bonnet and engine, then the cabin through the open driver's door. Populate the real dashboard screen meshes with restrained, believable displays. Close the door fully before departure. Track the car as it drives forward to the front doorway; keep it visible while the departure copy is on screen. The film ends as the GLS crosses the lit threshold with its tail lamps on, never on an empty or dark room. The camera must move continuously: no interior cut, teleport, full 360-degree orbit, reverse-drive illusion, or overlapping vehicle poses.

Use GSAP ScrollTrigger to bind motion to scrolling and support clean reversal. Camera position, look target, vehicle travel, wheel rotation, steering, door hinges, copy fades, and lighting should agree at every point on the timeline. Give reduced-motion visitors a useful static page without requiring 3D downloads.

## Lighting and image quality

Art-direct paint with broad warm and neutral softboxes, a subtle cool rim, controlled environment reflections, and grounded contact shadows. Keep the gold metallic and the black body legible without blowing out the paint or making the floor a gray wash. Studio strips should add structure, not become the main subject. Headlights and rear lights should read as believable lamps, with restrained floor spill and no oversized glow.

Render at one constant pixel density, native up to 2× on desktop and 1.6× on phones, moving or still. Never soften the picture while scrolling. Earn the frame time instead: few area lights, no blur layered over the moving stage, and meshes decoded off the main thread. Use crisp, high-resolution images of the actual supplied models for static fallbacks and collection cards. Preserve detailed geometry, tyre texture, chrome edges, interior definition, and readable dashboard displays.

## Page and product requirements

After the film, the page scrolls straight onto the white Featured Collection. Then About Baba is a pinned, scroll-driven scene on a seamless **white** stage. The GLS 580 in Cavansite Blue and the Defender 110 in Fuji White emerge from the white, drive in forwards, and stop side by side. Their wheels roll with the distance travelled. Baba's introduction is read in word by word while they are parked (a scroll-linked text reveal: ghosted words fill in to full ink). Then both cars drive forward out of frame. They never cross the copy while it shows, never touch, and replay exactly in reverse. On desktop, the copy sits left and the cars right. On phones and other tall screens, the copy sits above the cars within one screen. Load these two models in the background after the film, with still images standing in until they arrive. Continue with Baba's standards, sell or exchange, and a footer. Keep navigation and collection access immediate. Do not add ignition buttons, engine sound, sound toggles, or draggable 360-degree controls.

Show only supplied vehicle facts. If service history, ownership count, mileage, price, or contact endpoint is unknown, disclose that clearly rather than inventing it. Keep enquiry and valuation flows usable without pretending an unconnected form has sent data.

## Acceptance review

Review the film at its opening, inspection, open door, closed door, departure and final threshold frame, then the About drive-in, the parked introduction and the departure. Confirm the silver grille, light tint, visible rear seats, consistent original cabin palette, believable light levels, and sharp Retina render. Check desktop and mobile composition, scroll reversal, reduced motion, browser exceptions, image fallbacks, filter and enquiry controls, and final production build. Deliver the editable source, current preview, and a short note on any missing client data.
