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
