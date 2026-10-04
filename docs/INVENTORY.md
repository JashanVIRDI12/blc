# Publishing dealership data

`src/config.js` is the single data entry point. Empty contact fields are not displayed. Use approved dealership details and actual stock records.

## Dealership

| Field | Format / behaviour |
| --- | --- |
| `name`, `descriptor` | Dealership identity. FORMA / Motor House is the working identity. |
| `phone` | Display number; creates a telephone link. |
| `email` | Adds an email compose action to prepared enquiries. |
| `whatsapp` | International telephone number; digits are used for the sharing link. |
| `address` | Published address text. |
| `enquiryEndpoint` | Optional HTTPS or same-origin POST endpoint. Leave empty until connected. |

The POST body is JSON: `{ type: 'enquiry' | 'valuation', ...fields }`.

- Enquiry: `interest`, `name`, `phone`, optional `message`.
- Valuation: `vehicle`, `registration`, `kilometres`, `name`, `phone`, optional `exchange: 'on'`.

The endpoint must validate input, apply its own abuse controls and return a successful HTTP status only after accepting the lead. The client treats non-2xx status or a 15-second timeout as a failure and preserves the form. No lead data is saved to browser storage or logged by the client. Cross-origin endpoints must permit the site’s origin.

## Vehicle record

`inventory` is an array. It is deliberately empty until real records are available. Each record supports:

| Field | Value |
| --- | --- |
| `id` | Unique stable stock identifier |
| `make`, `model` | Published vehicle names |
| `body` | Body style, such as SUV or sedan |
| `image` | Actual photo URL or local `/images/...` path |
| `year` | Numeric registration/model year, as verified |
| `kilometres` | Actual odometer value as a non-negative number |
| `owners` | Verified number of owners |
| `fuel`, `transmission`, `location` | Published descriptive values |
| `price` | Numeric INR asking price; displayed with Indian currency formatting |
| `available` | `false` excludes the record from available stock |
| `model3d` | Optional prepared model ID to connect verified values to the film |
| `inspection` | Optional record, described below |

Do not infer year, kilometres, ownership or condition from a model filename. A missing value remains unpublished on cards and is shown as “Not supplied” in the detail view. `available: false` showcase entries are not evidence of current stock.

### Inspection record

All fields are optional. Publish them only when supported by the actual vehicle’s records.

- `verifiedKm: true` — odometer/history verification supports `kilometres`.
- `accidentFree: true` — supported non-accidental condition verification.
- `tyrePercent` — a supplied numerical condition measure from 0 to 100; the site does not calculate it from the mesh.
- `mechanical`, `body`, `interior`, `ownership`, `serviceHistory` — explicit verification flags.
- `checkedAt` — the recorded inspection date as display text.
- `reportUrl` — link to the actual inspection report.

Only an explicitly verified mileage value enters the dashboard moment. No number animation fabricates an odometer reading. A missing tyre value leaves the percentage absent.

## Preview mode

If no available inventory exists, the three supplied 3D vehicles (GLS 580, X7, Defender 110) appear as “Collection preview” entries. They support enquiries about that type of car; they do not imply that those exact vehicles are for sale.

For a stock photo that is unavailable, supply an approved placeholder that clearly communicates this. The included rendered stills belong to the showcase models; they should not be used as evidence of another car’s condition.
