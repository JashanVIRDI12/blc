# The admin portal

`/admin/` is where the dealership runs the website: the cars, their status, the home page and the collections. Every change is live on the site as soon as it is saved. Nobody needs to edit code or redeploy.

## What it does

| Tab | What you can do |
| --- | --- |
| **Overview** | The day at a glance: cars on sale and their total value, new enquiries, cars sold this month, cars that still lack photos, a price, a year or the distance driven, insurance that turns to Expired within 30 days, the stock by make and by body, and the cars edited last. |
| **Cars** | Search (make, model, year, colour, registration or stock), filter by status or make, *Needs attention*, sort, and switch between rows and a photo grid. Change a car's status or its home-page star straight from the list; each change saves at once, with **Undo**. Tick several cars to change their status together, add them to a collection or the home page, copy their WhatsApp ads, or delete them. **Export** saves every car, with its private details, as a spreadsheet. Shortcuts: `/` searches, `N` adds a car. |
| **Car editor** | **Fill from a WhatsApp ad**: paste an ad as the team writes it (`BMW X7 XDRIVE 30D{PHYTONIC BLUE COLOUR} \| 2021 MODEL \| … \| @✅68LACS`) and every field it understands is filled in. Photos: drag in as many as you like (each is sized for the web with a small copy for the cards), reorder, set the cover, and mark one with the eye as the **hover photo** the card turns to on the collection page. The **full registration** is private; the site shows only the state and RTO code (HR51). A **Fancy or VIP number** tag (selected automatically as you type the registration or number; 0001–0099 are VIP, and patterns such as 7272 are Fancy) appears on the car's photo and page. **Insurance** shows as Valid or Expired, never a date; give the date and it turns to Expired by itself. **For the dealership** (never shown): which stock the car belongs to (BLC, A.M., Park & Sale…) and notes. A live **preview** shows the card as visitors will see it, and **Share** gives the car's WhatsApp ad in your style, ready to copy or send. Also: price typed as people say it (`68 lakh`, `1.25 cr`), status, card note, highlights, specification, inspection, collections and the 3D model. ⌘S / Ctrl+S saves. |
| **Enquiries** | Every enquiry, valuation request and **Concierge** request (modifications for a car, or a car to source) sent from the site, the moment it is sent, with a count in the menu and a notice while the portal is open. Call or WhatsApp in one tap (the message names the car), mark each one Contacted or Closed, keep a note, export them all. |
| **Deliveries** | **The map on the home page** (*Across India*): the places it shows (cities or states, comma separated; unknown places are flagged; any place can take coordinates, `Leh (34.15, 77.58)`), its introduction, and a delivered total (empty shows the cars marked Sold). Below, handover photos, each with the place it went to (it joins the map, and pointing at that place shows the photo) and an optional caption; they also appear on the collection page. Hide or reorder them. |
| **Home page** | Choose the cars in the home page's Featured collection and their order (drag, or use the arrows), how many show, and the heading and introduction above them. |
| **Collections** | Create, rename, reorder, show or hide curated collections (Signature, Family, Performance, Adventure…) and tick the cars in each. *Just arrived* (cars added in the last N days) and *Arriving soon* (cars marked Coming soon) are made automatically. |
| **Settings** | **Baba Concierge**: its WhatsApp number (+91 85108 30242), introduction and list of services, one group per line (`Off-road [SUV, Pickup]: …` shows a group only for those bodies). **Your ad rules**: how the registration is shown (state and RTO code, or the first N characters), the distance label (*Driven*, never "km"), the Fancy and VIP tag wording, whether insurance is shown, and what a sold car still shows (no price; by default the year, fuel and body). Also phone, WhatsApp, email, address and opening hours, the collection page's introduction, whether sold cars appear as *Recently delivered*, and the account's password. |

What each status does on the site:

- **Available**: listed, with "Arrange a viewing". New cars wear *Just arrived* for the first 21 days (change this under Collections).
- **Reserved**: listed and marked Reserved. Enquiries ask to join the waiting list.
- **Coming soon**: listed and marked Coming soon, under *Arriving soon*. Enquiries register interest.
- **Sold**: leaves the collection and moves to *Recently delivered* (if turned on). The car's own page stays up and offers "Find me one like this".
- **Hidden**: a draft. It is never shown, and its page does not open.

## Before Supabase is connected: preview mode

Without Supabase settings the portal opens in **preview mode**. Everything works, but changes are saved only in that browser, so you can try it out. Open the site with `?preview` (the portal's "See them on the site" link does this) to see those changes on the site, in that browser only. A gold banner marks the preview. "Reset the preview" in Settings starts again from the three showcase cars.

## Connecting Supabase (about 10 minutes, free)

1. Create a project at [supabase.com](https://supabase.com/dashboard). Any region close to India is fine (Mumbai, `ap-south-1`).
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](../supabase/schema.sql) and press **Run**. This creates the tables, the photo bucket, the starting collections and the security rules. It is safe to run again.
3. **Authentication → Users → Add user**: your email and a password, with **Auto confirm user** ticked. Then, in the SQL editor, make that account an admin:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```
4. **Authentication → Sign In / Providers**: turn off **Allow new users to sign up**. Only accounts you add can exist, and only those listed in `admins` can edit.
5. **Authentication → URL Configuration**: set the Site URL to the live site (for example `https://babaluxurycar.com`) and add `https://babaluxurycar.com/admin/` to the redirect URLs, so password-reset emails come back to the portal.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `.env.local` in the project folder (see `.env.example`):
   ```sh
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ…
   ```
   Add the same two variables to the host's environment settings (Vercel, Netlify and Cloudflare Pages all have them), then build and deploy once. From then on, the portal publishes without redeploying.

**Connected project:** `eitkxfwcbjgzmzcpkyuq` (Singapore). Steps 1–4 and 6 are done (the admin is `babaluxurycar@gmail.com`, email and password, no second step), through the Supabase CLI (a dev dependency): `npx supabase login` once, then `npm run db:schema` re-runs the schema safely, and `npm run db:config` compares `supabase/config.toml` with the live project (`npx supabase config push --project-ref eitkxfwcbjgzmzcpkyuq` applies it). Sign-ups are off in that file. Still to do at launch: step 5 (the live domain), and adding the host's environment variables.

The anon key is public by design. Row-level security in the schema lets visitors read only published cars, visible collections and settings. Only signed-in admins can write or upload photos. Never put the `service_role` key in the site.

To add another admin, add them as a user (step 3) and run the same `insert` with their email. To remove one: `delete from public.admins where email = '…';`.

## How the site reads the data

`src/data.js` loads the cars, collections and settings once per page: from Supabase when connected, otherwise from `src/config.js`. If Supabase cannot be reached, the site falls back to the showcase models rather than showing an empty page. With no car for sale, the three showcase models stand in as labelled *Collection previews*, as before.

| Page | Path | Notes |
| --- | --- | --- |
| Home | `/` | The film, then the Featured collection chosen in the portal |
| Collection | `/collection/` | Filters live in the address, e.g. `/collection/?body=SUV&price=1-2cr`, so a filtered view can be shared |
| A car | `/car/?id=<web address>` | Gallery, price, facts, WhatsApp/call/enquiry, specification, inspection, similar cars, and schema.org `Car` data for search engines |
| Admin | `/admin/` | Not indexed by search engines |

Each car's web address (its `slug`) is made from its make, model and year when it is first saved, and then never changes, so links already shared keep working.

## The stock from WhatsApp (6 October 2026)

The 58 cars the team sent in *BLC x Jashan* are in the database, each with its photos sorted from the chat (cover first, then the outside, then the cabin; 781 photos, with small copies for the cards) and its hover photo set to the first cabin shot. 44 are Available, 13 Sold (the ones marked sold in the chat: no price, only the basics) and 1 Hidden (the Corolla Altis: the team said smaller cars needn't be listed). Each car's full registration, its stock (BLC, A.M., Park & Sale, from the DSR report) and the original ad are in its private notes. Number plate tags are detected from the digits. One- and two-digit values (0001–0099) are VIP; older Fancy labels for these numbers are corrected when cars are loaded and saved. Insurance dates were taken from the ads, so cars whose date has passed already read Expired.
