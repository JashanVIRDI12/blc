# Collection cover assets

Generated using the built-in `image_gen` tool from the dealership’s existing collection photos. The source vehicle is preserved while its setting is changed. These editorial images are used only as collection covers; each car listing keeps its original photographs.

| Cover | Source car | Saved asset |
| --- | --- | --- |
| Signature | Mercedes-Benz S 500 Maybach (2016) | `public/collections/signature-cover.webp` |
| Family | BMW X7 xDrive30d (2021) | `public/collections/family-cover.webp` |
| Performance | BMW 220d Gran Coupé (2021), white | `public/collections/performance-cover.webp` |
| Adventure | Jeep Wrangler Rubicon (2022) | `public/collections/adventure-cover.webp` |

All files are compressed WebP assets. Custom covers live in the existing Supabase `car-photos` bucket under `collections/`. A curated collection saves its selection in `collections.cover`. `settings.collection.covers` stores the Every car, Just arrived and Arriving soon selections. No schema migration is needed. Empty selections use the generated defaults; `auto` follows the current stock. The collection page keeps its original animated 3D hero. Original stock images used as covers are protected from photo cleanup when a car is edited or deleted.

Change covers in **Admin → Collections → Edit**, or **Automatic collection covers**. Choose an existing car photo, upload an image, use a generated cover, enter an image URL, or switch to automatic car photos. Save applies the choice.

## Final prompts

### signature

```text
Use case: precise-object-edit
Asset type: square editorial collection cover for Baba Luxury Cars website; also needs to crop gracefully to a wide banner.
Input image: edit target and exact vehicle identity reference.
Primary request: create a polished photographic collection cover using the dark blue Mercedes-Benz S 500 Maybach saloon from the supplied photo. Change the background to An understated modern luxury hotel forecourt in New Delhi, pale sandstone architecture, a shaded portico and subtle landscaped greenery, warm late-afternoon sunlight.
Composition/framing: square photograph, entire vehicle visible in front three-quarter view, centered horizontally in the lower-middle of the composition, balanced breathing room around bumper and all wheels; the vehicle occupies about 70% of the width. Keep it fully within the middle 60% of the image height so a wide banner crop retains it. Natural grounded contact shadow, correct reflections and perspective.
Style/medium: realistic premium automotive editorial photography, restrained warm stone, natural greens, crisp detail and believable textures, no exaggerated HDR.
Constraints: preserve the exact model, generation, body shape, paint colour, wheels, grille, lights and badges of the input car. Preserve existing dealership plate if readable. Do not add body kits, roof luggage or accessories. No people, no additional cars, no added text, no watermarks, no collage, no framing.
```

### family

```text
Use case: precise-object-edit
Asset type: square editorial collection cover for Baba Luxury Cars website; also needs to crop gracefully to a wide banner.
Input image: edit target and exact vehicle identity reference.
Primary request: create a polished photographic collection cover using the dark blue BMW X7 SUV from the supplied photo. Change the background to A calm scenic Himalayan foothill overlook on a broad smooth paved road, soft green hills and distant hazy mountains, clear gentle morning light.
Composition/framing: square photograph, entire vehicle visible in front three-quarter view, centered horizontally in the lower-middle of the composition, balanced breathing room around bumper and all wheels; the vehicle occupies about 70% of the width. Keep it fully within the middle 60% of the image height so a wide banner crop retains it. Natural grounded contact shadow, correct reflections and perspective.
Style/medium: realistic premium automotive editorial photography, restrained warm stone, natural greens, crisp detail and believable textures, no exaggerated HDR.
Constraints: preserve the exact model, generation, body shape, paint colour, wheels, grille, lights and badges of the input car. Preserve existing dealership plate if readable. Do not add body kits, roof luggage or accessories. No people, no additional cars, no added text, no watermarks, no collage, no framing.
```

### performance

```text
Use case: precise-object-edit
Asset type: square editorial collection cover for Baba Luxury Cars website; also needs to crop gracefully to a wide banner.
Input image: edit target and exact vehicle identity reference.
Primary request: create a polished photographic collection cover using the white BMW 220d Gran Coupé from the supplied photo. Change the background to A quiet sweeping paved mountain road with a low stone verge and sculptural rocky hills, refined golden late-afternoon daylight, no other traffic.
Composition/framing: square photograph, entire vehicle visible in front three-quarter view, centered horizontally in the lower-middle of the composition, balanced breathing room around bumper and all wheels; the vehicle occupies about 70% of the width. Keep it fully within the middle 60% of the image height so a wide banner crop retains it. Natural grounded contact shadow, correct reflections and perspective.
Style/medium: realistic premium automotive editorial photography, restrained warm stone, natural greens, crisp detail and believable textures, no exaggerated HDR.
Constraints: preserve the exact model, generation, body shape, paint colour, wheels, grille, lights and badges of the input car. Preserve existing dealership plate if readable. Do not add body kits, roof luggage or accessories. No people, no additional cars, no added text, no watermarks, no collage, no framing.
```

### adventure

```text
Use case: precise-object-edit
Asset type: square editorial collection cover for Baba Luxury Cars website; also needs to crop gracefully to a wide banner.
Input image: edit target and exact vehicle identity reference.
Primary request: create a polished photographic collection cover using the charcoal grey four-door Jeep Wrangler Rubicon from the supplied photo. Change the background to A broad dry gravel trail in the Himalayan foothills, restrained pine trees and rugged distant mountains, clear cool morning light.
Composition/framing: square photograph, entire vehicle visible in front three-quarter view, centered horizontally in the lower-middle of the composition, balanced breathing room around bumper and all wheels; the vehicle occupies about 70% of the width. Keep it fully within the middle 60% of the image height so a wide banner crop retains it. Natural grounded contact shadow, correct reflections and perspective.
Style/medium: realistic premium automotive editorial photography, restrained warm stone, natural greens, crisp detail and believable textures, no exaggerated HDR.
Constraints: preserve the exact model, generation, body shape, paint colour, wheels, grille, lights and badges of the input car. Preserve existing dealership plate if readable. Do not add body kits, roof luggage or accessories. No people, no additional cars, no added text, no watermarks, no collage, no framing.
```

