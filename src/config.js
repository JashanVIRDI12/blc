// Replace these fields with the dealership's approved identity and contact.
// Empty contact fields stay unpublished; forms never claim a lead was sent.
// From babaluxurycar.com (Sales line). Settings in the admin portal override.
export const dealer = {
  name: 'BABA',
  descriptor: 'Luxury Cars',
  email: '',
  phone: '+91 97737 37310',
  whatsapp: '+91 97737 37310',
  address: 'B-2, Emaya Mall, Paschim Vihar, New Delhi 110063',
  hours: 'Monday to Sunday, 11 am to 8 pm',
  enquiryEndpoint: '',
};

// The footer's other sales numbers, set below the sales and WhatsApp line
// from the admin (`dealer.phone`), in this order.
export const salesMore = ['+91 92665 44494'];

// The dealership's other lines, as published on babaluxurycar.com (the sales
// and WhatsApp line is `dealer.phone`, set in the admin). On the About page.
export const dealerLines = [
  { label: 'Sell your car', phone: '+91 85958 44904' },
  { label: 'Customer support', phone: '+91 85108 30242' },
];

// The WhatsApp lines in the card that opens from the corner button on every
// page (src/whatsapp.js), in this order: what each is for, its number and
// the first message the chat opens with. Saved in the admin (Settings,
// WhatsApp lines), the admin's list replaces this one.
export const whatsappLines = [
  { label: 'Buy a car', number: '+91 97737 37310', message: 'Hello Baba Luxury Cars, I’m looking for a car.' },
  { label: 'Buy a car', number: '+91 92665 44494', message: 'Hello Baba Luxury Cars, I’m looking for a car.' },
  { label: 'Sell your car', number: '+91 85958 44904', message: 'Hello Baba Luxury Cars, I’d like to sell my car.' },
  { label: 'Customer support', number: '+91 85108 30242', message: 'Hello Baba Luxury Cars, I need some help.' },
];

// Directions to the showroom, opened straight into route planning from
// where the visitor is: Google Maps anywhere, Apple Maps on Apple devices.
// Apple Maps finds the showroom by the address as Apple lists it.
const showroom = encodeURIComponent('Baba Luxury Car, B-2, Emaya Mall, Paschim Vihar, New Delhi 110063');
const showroomApple = encodeURIComponent('Baba Luxury Car, Emaya Mall, Block BG 2, Paschim Vihar, New Delhi, Delhi, 110063');
export const directions = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${showroom}&travelmode=driving`,
  apple: `https://maps.apple.com/?daddr=${showroomApple}&dirflg=d`,
};

// Google Analytics 4: its measurement ID (G-…) turns analytics on, for
// visitors who allow it in the cookie choice (consent.js). Empty: none.
export const analytics = { ga4: '' };

// Where the dealership posts, as linked from babaluxurycar.com. In the footer.
export const social = [
  { name: 'Instagram', icon: 'instagram', handle: '@babaluxurycar', url: 'https://www.instagram.com/babaluxurycar/' },
  { name: 'YouTube', icon: 'youtube', handle: '@babaluxurycar', url: 'https://www.youtube.com/@babaluxurycar' },
];

// The founders, as search engines are told of them (the About page names
// them too). Vinod Ahuja is always named first.
export const founders = ['Vinod Ahuja', 'Pawan Ahuja'];

// For search engines, what only the dealership can give; each is left out
// while it is empty. `google` and `bing`: the verification codes from Google
// Search Console and Bing Webmaster Tools (the content="…" of the meta tag
// each offers; not needed if the domain is verified by DNS). `geo`: the
// showroom's pin from Google Maps, { lat: 28.6…, lng: 77.0… }. `founded`:
// the year the business began, e.g. '2007'. `profiles`: other pages about the
// business, such as its Google Business Profile or a CarDekho listing.
export const searchEngines = { google: '', bing: '', geo: null, founded: '', profiles: [] };

// The dealership's own figures, on the home page's "Across India" section
// (src/across-india.js). `value` rolls up as the section comes into view;
// `suffix` follows it.
export const figures = [
  { value: 12, suffix: 'k+', label: 'Happy clients' },
  { value: 98, suffix: '%', label: 'Satisfaction rate' },
  { value: 18, suffix: '+', label: 'Years of experience' },
];

// Baba's own handover photographs, in the home page's "Across India" gallery,
// in this order. Each is in public/deliveries/: `full` is the original
// graphic, opened from the gallery; `card` is the photograph inside it,
// cropped clear of its banners, shown on the card. To add one, put both files
// there and add a line. While this list is empty, the photos uploaded in the
// admin's Deliveries page are shown instead.
export const deliveryPhotos = [
  { id: '3f1c2a50-6b1e-4c7a-9a51-0d1e7b2c4a01', city: 'Jammu & Kashmir', card: '/deliveries/jammu-kashmir-card.webp', full: '/deliveries/jammu-kashmir.webp' },
  { id: '3f1c2a50-6b1e-4c7a-9a51-0d1e7b2c4a02', city: 'Punjab', card: '/deliveries/punjab-card.webp', full: '/deliveries/punjab.webp' },
  { id: '3f1c2a50-6b1e-4c7a-9a51-0d1e7b2c4a03', city: 'Dehradun', card: '/deliveries/dehradun-card.webp', full: '/deliveries/dehradun.webp' },
  { id: '3f1c2a50-6b1e-4c7a-9a51-0d1e7b2c4a04', city: 'Tamil Nadu', card: '/deliveries/tamil-nadu-card.webp', full: '/deliveries/tamil-nadu.webp' },
  { id: '3f1c2a50-6b1e-4c7a-9a51-0d1e7b2c4a05', city: 'Nagaland', card: '/deliveries/nagaland-card.webp', full: '/deliveries/nagaland.webp' },
];

// The supplied GLBs are showcase vehicles, not evidence of stock or condition.
// Stock facts (year, kilometres, owners, registration state, price, photos)
// stay null until the dealership supplies them for a real car; the page then
// says "On request" rather than inventing them. `specs` are manufacturer
// figures for the model, checked online (sources beside each).
const stock = { year: null, kilometres: null, owners: null, fuel: null, transmission: null, location: null, registration: null, price: null, inspection: null, photos: [], available: false };
export const showcase = [
  // mbusa.com / mercedes-benz.ca: GLS 580 4MATIC
  { id: 'gls', make: 'Mercedes-Benz', model: 'GLS 580', trim: 'GLS 580 4MATIC', body: 'SUV', collections: ['signature', 'family'], image: '/stills/gls.webp', paint: { color: '#151e38', name: 'Cavansite Blue', finish: 'metallic' }, ...stock,
    specs: [['Engine', '4.0 V8 biturbo, EQ Boost'], ['Power', '510 hp'], ['Torque', '730 Nm'], ['0–100 km/h', '4.9 s'], ['Top speed', '250 km/h'], ['Drive', '4MATIC, 9G-TRONIC'], ['Seats', '7']] },
  // autotijd.be: X7 xDrive40i (2019–2022)
  { id: 'x7', make: 'BMW', model: 'X7', trim: 'X7 xDrive40i', body: 'SUV', collections: ['signature', 'family'], image: '/stills/x7.webp', paint: { color: '#213a5e', finish: 'metallic' }, ...stock,
    specs: [['Engine', '3.0 inline six, turbo'], ['Power', '340 PS'], ['Torque', '450 Nm'], ['0–100 km/h', '6.1 s'], ['Top speed', '245 km/h'], ['Drive', 'xDrive, 8-speed Steptronic'], ['Seats', '7']] },
  // Fuji White (Land Rover paint 867) is a solid white, here with the Narvik
  // Black contrast roof. landrover.co.uk Defender 110 specification. The
  // engine depends on the variant, so it is left to the stock record.
  { id: 'defender', make: 'Land Rover', model: 'Defender 110', trim: 'Defender 110', body: 'SUV', collections: ['adventure'], image: '/stills/defender.webp', paint: { color: '#ecece6', name: 'Fuji White / Narvik Black roof', finish: 'solid' }, ...stock,
    specs: [['Body', '5-door, 5 or 5+2 seats'], ['Length', '5,018 mm'], ['Wheelbase', '3,022 mm'], ['Wading depth', 'up to 900 mm'], ['Approach angle', 'up to 37.8°'], ['Drive', 'Permanent all-wheel drive']] },
  // carwale.com: Maybach S 580 4MATIC (India)
  { id: 'sclass', make: 'Mercedes-Maybach', model: 'S 580', trim: 'S 580 4MATIC', body: 'Sedan', collections: ['signature'], image: '/stills/sclass.webp', paint: { color: '#0c0c0e', name: 'Maybach two-tone', finish: 'metallic' }, ...stock,
    specs: [['Engine', '4.0 V8 biturbo, 48 V mild hybrid'], ['Power', '496 bhp'], ['Torque', '700 Nm'], ['0–100 km/h', '4.8 s'], ['Top speed', '250 km/h'], ['Drive', '4MATIC, automatic']] },
  // autocarindia.com: i7 xDrive M70 (India)
  { id: 'i7', make: 'BMW', model: 'i7', trim: 'i7 M70 xDrive', body: 'Sedan', collections: ['signature', 'performance'], image: '/stills/i7.webp', paint: { color: '#6b6e72', name: 'Frozen Deep Grey', finish: 'matte' }, ...stock,
    specs: [['Motors', 'Two, all-wheel drive'], ['Power', 'up to 680 hp'], ['Torque', 'up to 1,100 Nm'], ['0–100 km/h', '3.8 s'], ['Top speed', '250 km/h'], ['Battery', '112.5 kWh']] },
  // autocarindia.com / cardekho.com: Land Cruiser 300 ZX (India)
  { id: 'landcruiser', make: 'Toyota', model: 'Land Cruiser 300', trim: 'Land Cruiser 300 ZX', body: 'SUV', collections: ['adventure', 'family'], image: '/stills/landcruiser.webp', paint: { color: '#ebe9e3', name: 'Precious White Pearl', finish: 'solid' }, ...stock,
    specs: [['Engine', '3.3 V6 twin-turbo diesel'], ['Power', '309 hp'], ['Torque', '700 Nm'], ['Gearbox', '10-speed automatic'], ['Drive', 'Four-wheel drive']] },
];

// The collection drive (src/fleet-drive.js), on the home page and at the
// head of the collection page: five cars drive out of the white towards the
// visitor and settle in formation, left to right as seen. `paint` overrides
// the showcase paint for this scene only.
export const fleetVehicles = [
  { id: 'landcruiser' },
  { id: 'defender', paint: { color: '#4d5154', name: 'Carpathian Grey / Narvik Black roof', finish: 'metallic' } },
  { id: 'sclass' },
  { id: 'gls' },
  { id: 'x7', paint: { color: '#e4e5e2', name: 'Mineral White', finish: 'metallic' } },
];

// The home page's "Lights on" (src/lights-on.js): the same cars, without
// the Land Cruiser, left to right as the camera passes them.
export const lightsVehicles = fleetVehicles.filter(({ id }) => id !== 'landcruiser');

// Roles are independent of the model IDs. Swap an ID here, then add its
// audited parts/materials and tune the camera framing for its dimensions.
// The dark showroom film inspects one car.
export const filmVehicles = { first: 'gls' };
// The white About sequence (src/about-drive.js): two cars drive in side by
// side, pause for the introduction, and drive away. `near` takes the lane
// closer to the camera.
export const aboutVehicles = { near: 'x7', far: 'defender' };

// The car the About page's inspection goes over (src/inspection.js): the
// supplied Volvo S90 Recharge, loaded whole (src/detail-car.js;
// npm run model:s90), in Volvo's Onyx Black metallic. A showcase model, not
// stock.
export const inspectionCar = { base: '/models/s90/', name: 'Volvo S90 Recharge', shadow: '/models/sclass-shadow.jpg', paint: { color: '#060607', name: 'Onyx Black metallic' } };
// How many handover photographs the About page shows: the newest, which are
// the first of the admin's Deliveries tab (a new photo goes to the front).
// The home page's gallery shows them all.
export const ABOUT_DELIVERIES = 6;
// The car on the inspection's turntable (src/inspect-stage.js): the
// Defender 110 in Land Rover's Santorini Black metallic, with the black
// contrast roof. A showcase model, not stock.
export const inspectionVehicle = { id: 'defender', paint: { color: '#060607', name: 'Santorini Black metallic', finish: 'metallic' } };
// The collection, parked on an arc at the back of the showroom after the film
// (src/lineup.js), left to right as seen from the stage. The film's car takes
// its place among them.
export const lineupVehicles = ['defender', 'gls', 'x7'];

// Curated collections while Supabase is not connected (its own table takes
// over once it is). An empty collection is never shown.
export const defaultCollections = [
  { slug: 'signature', title: 'Signature', subtitle: 'Flagships, chosen for their presence.' },
  { slug: 'family', title: 'Family', subtitle: 'Seven seats, long journeys, every comfort.' },
  { slug: 'performance', title: 'Performance', subtitle: 'For the drive itself.' },
  { slug: 'adventure', title: 'Adventure', subtitle: 'Built to go further.' },
];

// Publish real records in Supabase through the admin portal (/admin/), or,
// without it, here. See docs/INVENTORY.md for the data contract.
// Optional inspection: { verifiedKm, accidentFree, tyrePercent, mechanical,
// body, interior, ownership, serviceHistory, checkedAt, reportUrl }.
export const inventory = [];
export const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
