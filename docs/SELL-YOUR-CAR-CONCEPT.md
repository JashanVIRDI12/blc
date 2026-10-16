# Sell your car — The Private Appraisal

Design recommendation, 13 October 2026. The `/sell/` destination, shared navigation links and an initial appraisal form are now implemented locally. The owner's folio and richer interactions below remain proposed.

## Recommendation

Create a dedicated `/sell/` page around a personal appraisal and an owner's folio. A black leather folio, embossed with the Baba crest, opens once to reveal an ivory vehicle sheet. As the owner shares their car's details, that sheet becomes their own vehicle record. Their photograph can become its cover image.

The experience should feel like a considered appointment at a dealership: tactile materials, clear information, time to read, and a person handling the next step. The visual interest comes from the owner's car and the care it has received.

Proposed hero copy:

> Your car deserves
> *a considered offer.*
>
> Tell us about your car. Our team will review its details and speak with you about the next step.

Primary action: **Request a private appraisal**.

Secondary action: **Speak to our team**.

Use “Sell your car” in navigation for clarity; “The Private Appraisal” is the page's creative direction.

## What the current site establishes

The desktop review covered the homepage showroom film, lights-on collection, featured catalogue, consultation sculpture, About drive, night drive and handover gallery; the About unveiling, dashboard, inspection, paperwork, handovers and clock; and the Collection, Concierge and vehicle pages. The review also inspected the shared transitions, headline reveals, magnetic actions, form feedback and footer key behavior in the source.

The strongest recurring details are:

- Black lacquer, ivory paper, warm metal and fine gold coachlines.
- Newsreader's light display type and true italic, supported by Manrope.
- Broad studio reflections, contact shadows and physical mechanisms.
- The catalogue's page turns, the dashboard's mechanical rotation, the cloth unveiling and the documents' weight.
- Direct personal contact and real car photography.

The recent glass stats strip is an accent over moving imagery. The appraisal form should use the site's paper language, with solid, readable fields and restrained metal details.

Several existing sections occupy a substantial amount of pinned scrolling. The seller page should use normal scrolling and give immediate access to its form. Its hero can have depth and movement without asking the visitor to finish a sequence before starting.

At the time of the concept review, Sell your car opened the general enquiry dialog, whose heading addresses finding a next car. Navigation now leads to a dedicated `/sell/` page with a focused valuation form. `src/valuation.js` also contains registration formatting, mileage wording and a live vehicle-card concept that can support the proposed folio.

## Page sequence

### 1. A quiet arrival

The headline and both contact actions are readable from the first paint. Beside them sits one folio on a dark studio surface. Its leather has fine grain, the crest is embossed rather than brightly illuminated, and the ivory page edges catch a soft highlight.

One broad reflection passes across the cover; it opens with a slight sense of weight. The camera stays steady. The folio then rests.

The form action goes directly to the form. It remains available while the decorative scene loads.

### 2. Your car, recorded

An ivory appraisal desk provides the practical centre of the page. Group the fields into two clearly labeled parts, with the vehicle summary beside them on desktop and beneath them on a phone.

**Your car:** make, model, year, distance driven and city. Offer a short choice between selling and exchanging. Variant, registration and additional notes can be optional at first contact, subject to the buying team's intake needs.

**How to reach you:** name, phone number and optional preferred contact time. Clearly mark optional fields beside their labels.

The folio sheet updates when a field is completed. The car's name becomes its title, the distance settles into place once the owner finishes entering it, and chosen care details appear as simple text. The sheet remains a readable summary rather than an additional control surface.

Optional photo intake can use four understated framing guides: exterior front, exterior rear, cabin and odometer. The owner can submit the initial request without photos. Once a photograph is added, their actual car becomes the sheet's image.

### 3. What informs the appraisal

A short editorial section explains what the buying team considers: the car's specification, condition, distance driven, ownership and available maintenance history. A quiet **Care record** lets the owner add details such as service records, recent maintenance, warranty information and a second key.

Present these as information for human review. Any value or offer must come from the dealership's actual appraisal process.

Show the dealership's real sequence in three plain steps: **Share the details → Appraisal and conversation → Agreed handover**. Describe inspection, payment and transfer arrangements according to the service the dealership actually provides.

### 4. A personal acknowledgement

After the request is saved successfully, the sheet settles into a request summary with a genuine reference and clear next-step wording. Proposed status: **Appraisal request received**.

The owner can review the submitted details and contact the team. Confirmation should acknowledge receipt; an appraisal outcome follows the team's review.

## Three useful distinguishing features

1. **The owner's folio.** The owner's actual car photograph and details create a personal record. This makes the visual treatment relevant to the task and gives it a clear reason to exist.
2. **The care record.** Give maintenance and ownership details a dignified place. Owners can explain what has been looked after instead of only supplying a model and a number.
3. **The next chapter.** If the owner chooses exchange, let them attach a car from the real collection or describe the replacement they want. Their current car and next-car preference appear together in the request summary.

A personal buying-team introduction would also strengthen the page if the dealership supplies a real portrait and the contact arrangement. A real seller story can be added when suitable seller-specific material is available.

## Proposed motion direction

These are design targets for the new page, not measured timings from a usability study.

| Moment | Proposed treatment |
| --- | --- |
| Headline arrival | A small rise from the baseline and a soft reveal, about 900–1,200 ms. |
| Folio opening | One weighted opening, about 1.3–1.8 seconds, then rest. |
| Light on the leather | One broad, slow pass over roughly 3 seconds, rather than a repeating effect. |
| Section copy | A 10–14 px rise over 600–800 ms, once as it enters view. |
| Field completion | A subtle rule or color change over 150–220 ms. |
| Vehicle summary | Update the completed line with a 200–300 ms fade; keep the sheet in place. |
| Distance entry | Settle once after editing, over roughly 450–600 ms. |
| Successful request | A small paper movement and a status reveal, about 500–700 ms. |

Give each moment a long still interval. Keep the form stationary while it is being filled. Gold should respond like a warm metal under soft lighting. Use the existing native cursor, a modest button response and ordinary page scrolling.

On phones, give the introductory visual a compact area and keep the form in a single column. With reduced motion, show the folio already open and all information immediately readable.

## Practical implementation fit

- The `/sell/` page and desktop, mobile and footer seller links are in place.
- Reuse the shared typography, header, page transition, buttons and footer.
- Adapt the useful formatting and vehicle-summary helpers in `src/valuation.js`; simplify its continuous tilt, glow and per-keystroke motion for this direction.
- Send seller requests through the existing valuation enquiry category and admin inbox.
- Treat the folio as an independent enhancement. Keep essential content available while it loads, and render only when it changes.
- If photo intake is included, add private submission storage. The existing public stock-photo bucket is not a seller-photo intake service.
- Add a genuine saved-request reference and appropriate receipt wording. Preferred contact times are requests unless a real appointment system confirms them.

The first build should focus on the folio, a short working form, the care record and a clear receipt. Exchange linking and richer photo intake can follow as functional additions.

## Research and interpretation

- [H.R. Owen — Sell my car](https://www.hrowen.co.uk/sell-my-car/): its seller page leads with a dedicated buying team and gathers vehicle information, condition and contact details. This supports a personal appraisal as a relevant luxury-dealership service model. It does not establish Baba's pricing, turnaround or operational promises.
- [Big Boy Toyz — Sell your car](https://www.bigboytoyz.com/sell-used-luxury-car): the Indian competitor combines professional evaluation, vehicle details and photo intake. Useful for local functional expectations; its eligibility criteria and business claims belong to that dealership.
- [Rolls-Royce — Bespoke Craft](https://www.rolls-roycemotorcars.com/content/rrmc/marketUK/rollsroycemotorcars_com/en_GB/bespoke/craft.html): leather embossing, stitching, wood surfaces and coachline work provide a reference for communicating luxury through materials and craft. The owner's folio is an original application of that principle to Baba's existing paper-and-key language.
- [Bentley — Extraordinary Materials](https://www.bentleymotors.com/us/en/about-bentley/people-and-expertise/extraordinary-materials.html): the emphasis on leather, wood and metal in a tranquil interior supports a calm, tactile direction.
- [Nielsen Norman Group — The Role of Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/): recommends restraint and motion that communicates feedback and state. This informs the short form responses and the decision to let the hero settle.
- [Baymard — Required and optional fields](https://baymard.com/research-articles/required-optional-form-fields): supports clearly labeling field requirements. Applying that guidance to seller intake is a design inference; the cited research concerns ecommerce forms, not this dealership's conversion rate.
