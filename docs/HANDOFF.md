# Baba Luxury Cars — homepage handoff

## Included

The homepage uses the client's own Baba Luxury Car logo (from babaluxurycar.com) in the loader, header and footer, and on every car's number plates. The finish is dark luxury: black paint, grey studio reflections and a coachline in the logo's gold, set in Newsreader and Manrope (both OFL, self-hosted). A short showroom film of the Mercedes-Benz GLS 580 leads into the white Featured Collection. About Baba follows, with a BMW X7 and a Land Rover Defender 110 driving in and away on a white stage. Then come The Baba Standard, Sell or Exchange, and the footer.

The GLS 580 is the film's hero, in Cavansite Blue. Its glazing follows the real GLS: clear front glass with a faint green-grey tint, so the cabin reads, and dark privacy glass on the rear doors, quarter windows, tailgate and roof, with piano-black window-frame uprights. Its engine bay is finished from photographs of a real GLS. After the engine and the interior reveal, the door closes fully and the car drives forward out of the scene, tracked by the camera.

The film takes place in the supplied car showroom (`car-showroom_2.glb`, prepared by `npm run model:showroom`): fluted smoked-oak walls, a warm ceiling brightest over the inspection stage, and the Baba logo lit on the back wall for the whole film. The film's headlines carry a soft dark halo, so they read over the lit ceiling and the reflections; the supporting notes carry a matching text shadow. At rest, the opening title stands clear of the car. Both 3D stages render sharper: desktop screens are supersampled towards 2×, and a slow device steps down only after sustained slowness, never below 1.5×.

About Baba is a pinned white stage. The BMW X7 (in navy metallic) and the Defender 110 in Fuji White (Land Rover paint 867) with the Narvik Black contrast roof emerge from the white and drive in. They stop side by side beside the introduction, which is always set; the camera turns with the cars as they arrive, so they never pass behind it. Then the cars drive away out of frame. Scrolling back replays it exactly. Mobile and other tall screens stack the copy above the cars. The two models load in the background after the film, and sharp stills of the same cars stand in until then. The collection shows three labelled previews: GLS 580, X7 and Defender 110. Film and About frames render at up to 2× device pixel density, moving or still.

## Client data

No verified stock records, dealership contact details or enquiry endpoint were supplied. The collection therefore contains labelled showcase previews, with no invented prices, mileage or ownership history. Before launch, connect Supabase and enter the real stock and contact details in the admin portal (`/admin/`); see `docs/ADMIN.md`.

The site now has a collection page (`/collection/`), a page for each car (`/car/?id=…`) and the admin portal. Until Supabase is connected, the admin works in a browser-only preview mode.

The collection page opens with the collection drive. The Land Cruiser 300, the Defender 110 (in Carpathian Grey), the Maybach S 580, the GLS 580 and the X7 drive out of the white as the page loads. They park in front of a wall-high *COLLECTION*, covering the lower part of its letters, with dust drifting in the light and lifted by their tyres. The same five cars, Defender included, drive in on the home page.

Forms currently prepare a copyable/downloadable enquiry and explicitly state that nothing has been sent. An email/WhatsApp contact enables visitor-initiated sharing; an optional POST endpoint enables online delivery. See `docs/INVENTORY.md` and `src/forms.js`.

## Run and deliver

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5174
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Upload the contents of `dist/` to the root of a static HTTPS host. Serve through HTTP/HTTPS, not by opening `index.html` as a local file. The preview ZIP contains the production files and handoff documents; it does not contain an enquiry backend.

## Verification

- Thirty-two tests cover distance-driven wheels, heading and steering, and reversibility for every car. They also check that the film camera stays inside the showroom walls and under the ceiling, that the GLS passes only through the doorways, and that the lit logo stands clear of the opening and departure headlines. The walkaround must run one way, under a full turn, with no stalls. The bonnet and door must be shut before departure, and the film must end on the front threshold. For the About drive, the tests confirm that the two cars never touch and rest on their marks while the introduction shows. They also check, at desktop, phone and tablet sizes, that the cars fill the space beside or below the copy, never cross it while it shows, arrive out of the white or from beyond the frame, and leave it.
- Local Chrome review covers desktop and portrait composition, section order and the About drive: landing parked with every word revealed, arrival with the words still hidden, departure and reversal. It also covers the absence of engine controls, collection filters, dialogs, enquiry/valuation drafts, reduced motion and WebGL failure.
- Production build and a browser review of the compiled assets. A separate Retina browser check verifies the full-resolution settled frame.

Screenshots are reviewed at 1440×960 and 390×844. Physical iOS/Safari testing was not performed. Vite reports the expected large-chunk warning for the separately loaded Three.js film.

Read `docs/REDESIGN-NOTES.md` for the visual direction, paint reference, design articles and technical choices. `docs/IMPROVED-PROMPT.md` is a concise, reusable version of the creative brief. The supplied source models remain unchanged. Font licences are included in the production files.
