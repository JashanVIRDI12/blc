// Reads one of the dealership's WhatsApp ads, as the team writes them:
//   BMW X7 XDRIVE 30D{PHYTONIC BLUE COLOUR} | 2021 MODEL | DIESEL | SECOND
//   OWNER | AUTOMATIC TRANSMISSION | HR70H9908 | 80000KM DRIVEN | INSURANCE
//   EXPIRED | PAN INDIA FINANCE AVAILABLE | @✅68LACS
// into a car's fields. What it can't place becomes a highlight. Spelling
// slips in the ads (PANAROMIC, VALUD, LEGENENDER) are forgiven. Pure, so the
// admin and the import tools share it.
import { normalizeRegistration } from './listing-rules.js';

const MAKES = [
  ['MERCEDES-MAYBACH', 'Mercedes-Maybach'], ['MERCEDES MAYBACH', 'Mercedes-Maybach'], ['MERCEDES-AMG', 'Mercedes-AMG'], ['MERCEDES-BENZ', 'Mercedes-Benz'], ['MERCEDES BENZ', 'Mercedes-Benz'], ['MERCEDES', 'Mercedes-Benz'], ['BENZ', 'Mercedes-Benz'],
  ['LAND ROVER', 'Land Rover'], ['LANDROVER', 'Land Rover'], ['RANGE ROVER', 'Land Rover', 'Range Rover'], ['ROLLS ROYCE', 'Rolls-Royce'], ['ROLLS-ROYCE', 'Rolls-Royce'], ['ASTON MARTIN', 'Aston Martin'],
  ['MARUTI SUZUKI', 'Maruti Suzuki'], ['MARUTI', 'Maruti Suzuki'], ['VOLKSWAGEN', 'Volkswagen'], ['VW', 'Volkswagen'],
  ['KIA', 'Kia'], ['FORD', 'Ford'], ['BMW', 'BMW'], ['JEEP', 'Jeep'], ['TATA', 'Tata'], ['TOYOTA', 'Toyota'], ['VOLVO', 'Volvo'], ['LEXUS', 'Lexus'], ['PORSCHE', 'Porsche'], ['HONDA', 'Honda'],
  ['MAHINDRA', 'Mahindra'], ['MG', 'MG'], ['AUDI', 'Audi'], ['BYD', 'BYD'], ['JAGUAR', 'Jaguar'], ['FORCE', 'Force'], ['HYUNDAI', 'Hyundai'], ['SKODA', 'Skoda'], ['NISSAN', 'Nissan'], ['ISUZU', 'Isuzu'],
  ['RENAULT', 'Renault'], ['BENTLEY', 'Bentley'], ['LAMBORGHINI', 'Lamborghini'], ['FERRARI', 'Ferrari'], ['MASERATI', 'Maserati'], ['MCLAREN', 'McLaren'], ['MINI', 'MINI'], ['CITROEN', 'Citroën'], ['TESLA', 'Tesla'],
];
// Models whose name is two words.
const TWO_WORD = ['COROLLA ALTIS', 'LAND CRUISER', 'RANGE ROVER', 'DISCOVERY SPORT', 'THAR ROXX', 'INNOVA CRYSTA', 'GRAND VITARA', 'GRAND CHEROKEE', 'URBAN CRUISER', 'MODEL S', 'MODEL 3', 'MODEL Y', 'NEW BEETLE'];
const BODIES = [
  ['MPV', /\b(CARNIVAL|CARENS|ALPHARD|VELLFIRE|INNOVA|CRYSTA|ERTIGA|XL6|E6|HEXA|MARAZZO|V-CLASS)\b/],
  ['Pickup', /\b(HILUX|V-CROSS|PICKUP|PICK-UP)\b/],
  ['Convertible', /\b(Z4|CONVERTIBLE|CABRIOLET|ROADSTER|SPYDER|SPIDER)\b/],
  ['Hatchback', /\b(COMET|B[- ]?1?80|B[- ]?200|A[- ]?180|SWIFT|BALENO|I20|POLO|GOLF|KWID|ALTROZ|GLANZA|MINI COOPER|COOPER)\b/],
  ['Estate', /\b(V90|V60|ESTATE|TOURING|AVANT|WAGON)\b/],
  ['Motorhome', /\b(TRAVELLER|CARAVAN|MOTORHOME)\b/],
  ['Sedan', /\b(S\s?\d{3}D?|C\s?\d{3}D?|E\s?\d{3}D?|CLA|CLS|A4|A6|A8|[357]\d{2}[DI]|[357]GT|[357] SERIES|220D|GRAN COUPE|CIVIC|CITY|VERNA|COROLLA|ALTIS|CAMRY|S60|S90|SUPERB|OCTAVIA|JETTA|PASSAT|XE|XF|XJ|IS\s?\d{3}|ES\s?\d{3}|LS\s?\d{3}|CIAZ|DZIRE|SLAVIA|VIRTUS|PANAMERA|GHOST|PHANTOM|FLYING SPUR|S-CLASS|E-CLASS|C-CLASS|7 SERIES|5 SERIES|3 SERIES)\b/],
];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Extras, as they read on the site.
const EXTRAS = [
  [/PAN\s*INDIA\s*FINANCE/, 'Pan-India finance'],
  [/DOUBLE\s*SUN\s*ROOF/, 'Double sunroof'],
  [/PANORAMA\s*GLASS\s*ROOF\s*SKY\s*LOUNGE/, 'Panorama glass roof Sky Lounge'],
  [/PAN[AO]R[AO]MI?C\s*(SUN)?\s*ROOF/, 'Panoramic sunroof'],
  [/^MOON\s*ROOF$/, 'Moonroof'],
  [/^SUN\s*ROOF$/, 'Sunroof'],
  [/REAR\s*ENTERTAINMENT/, 'Rear entertainment screens'],
  [/VENTIL+ATED\s*SEATS?/, 'Ventilated seats'],
  [/MASSAG(ING|E)\s*SEATS?/, 'Massage seats'],
  [/SOFA\s*RECLINER/, 'Sofa recliner seats'],
  [/360\s*(DEGREE|°)?\s*CAMERA/, '360° camera'],
  [/BRAND\s*NEW\s*TYRES?/, 'Brand new tyres'],
  [/RECENTLY\s*SERVICED\s*\(?\s*MAJOR\s*&?\s*(AND)?\s*MINOR\s*\)?/, 'Recently serviced (major and minor)'],
  [/RECENTLY\s*SERVICED/, 'Recently serviced'],
  [/UNDER\s*WARRANTY/, 'Under warranty'],
  [/FULLY\s*MODIFIED/, 'Fully modified'],
  [/FULLY\s*LOADED/, 'Fully loaded'],
  [/UPLIFT\s*KIT/, 'Uplift kit'],
  [/MATTE?\s*PPF/, 'Matte PPF'],
  [/^PPF/, 'Paint protection film'],
  [/FRAMELESS\s*DOORS?/, 'Frameless doors'],
  [/^2\s*SEATER$/, '2-seater'],
  [/^(\d)\s*LED\s*TVS?$/, match => `${['', 'One', 'Two', 'Three', 'Four'][match[1]] || match[1]} LED TVs`],
  [/^LED\s*TV$/, 'LED TV'],
  [/ATTACHED\s*WASHROOM/, 'Attached washroom'],
  [/SONY\s*SOUND/, 'Sony sound system'],
  [/^MICROWAVE$/, 'Microwave'],
  [/^REFRIGERATOR$|^FRIDGE$/, 'Refrigerator'],
  [/^FULLY\s*A\/?C$/, 'Fully air-conditioned'],
  [/EXTRA\s*SPLIT\s*A\/?C/, 'Extra split AC'],
  [/SINGLE\s*BED/, 'Single bed'],
  [/^BS\s*-?\s*(VI|6)$/, 'BS VI'],
  [/^4\s*X\s*4$/, '4x4'],
  [/VALID\s*TILL\s*(\d{4})/, match => `Registration valid till ${match[1]}`],
];

const sentence = text => { const lower = text.toLowerCase().replace(/\s+/g, ' ').trim(); return lower.charAt(0).toUpperCase() + lower.slice(1); };
const titleWord = word => word.split('-').map(part => {
  if (!part) return part;
  if (/\d/.test(part)) return part.replace(/(\d)([DIHE])$/, (_, d, l) => d + l.toLowerCase());
  if (part === 'XDRIVE') return 'xDrive';
  if (part === 'SPORTLINE') return 'Sport Line';
  if (part === 'COUPE') return 'Coupé';
  if (part === 'LEGENENDER' || part === 'LEGENDER') return 'Legender';
  if (part.length <= 3 && !/^(THE|AND|FOR|NEW)$/.test(part)) return part;
  return part.charAt(0) + part.slice(1).toLowerCase();
}).join('-');
const colourCase = text => text.trim().toLowerCase().split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const title = text => text.trim().split(/\s+/).filter(Boolean).map(titleWord).join(' ').replace(/\bPlus\b/, '+').replace(/ \+/, '+');

function readDate(text) {
  const match = text.match(/(\d{1,2})?\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s*,?\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2]), year = Number(match[3]);
  // A month alone means the end of that month.
  const day = match[1] ? Number(match[1]) : new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseAd(raw) {
  const text = String(raw ?? '').replace(/[✅✔️☑️]/gu, ' ').replace(/[‎‏]/g, '').toUpperCase();
  const car = { make: '', model: '', variant: '', colour: '', year: null, fuel: '', owners: null, transmission: '', registration: '', kilometres: null, insurance: '', insuranceUntil: null, price: null, note: '', body: '', highlights: [] };
  const found = [];
  const segments = text.split(/[|\n]/).map(part => part.trim()).filter(Boolean);
  if (!segments.length) return { car, found };

  // The name and colour lead the ad: "KIA CARNIVAL LIMOUSINE { WHITE COLOUR}".
  let head = segments.shift();
  const colour = head.match(/[{[(<]\s*([^{}[\]()<>]*?)\s*COLOU?RS?\s*[^{}[\]()<>]*[}\])>]?/);
  if (colour) { car.colour = colourCase(colour[1]); head = head.replace(colour[0], ' '); }
  head = head.replace(/[{}[\]()<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const make = MAKES.find(([key]) => head === key || head.startsWith(`${key} `));
  if (make) { car.make = make[1]; head = (make[2] ? `${make[2].toUpperCase()} ` : '') + head.slice(make[0].length).trim(); }
  // Mercedes names: "GLS400 D", "S350d", "E 220d", "C200" → "GLS 400 d".
  if (/^Mercedes/.test(car.make)) head = head.replace(/^([A-Z]{1,3})\s?-?\s?(\d{2,3})\s*(D|E|H)?\b/, (_, cls, n, d) => `${cls}·${n}${d ? `·${d.toLowerCase()}` : ''}`);
  const words = head.split(' ').filter(Boolean);
  const two = TWO_WORD.find(name => head.startsWith(name));
  const modelWords = two ? two.split(' ').length : Math.min(1, words.length);
  car.model = title(words.slice(0, modelWords).join(' ')).replace(/·/g, ' ');
  car.variant = title(words.slice(modelWords).join(' '));
  if (car.make || car.model) found.push('name');

  // Price: anywhere in the ad, the last lakh or crore figure.
  const prices = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(CR(?:ORE)?S?|LAKHS?|LACS?|LACK)\b/g)];
  if (prices.length) { const [, n, unit] = prices.at(-1); car.price = Math.round(Number(n) * (unit.startsWith('CR') ? 1e7 : 1e5)); found.push('price'); }
  if (/ALMOST\s*FIX/.test(text)) car.note = 'Near-final price';

  for (const original of segments) {
    let seg = original.replace(/(\d+(?:\.\d+)?)\s*(CR(?:ORE)?S?|LAKHS?|LACS?|LACK)\b.*$/, '').replace(/@|\(\s*ALMOST\s*FIX\s*\)/g, ' ').trim();
    if (!seg) continue;
    let match;
    if (/MODEL/.test(seg) && (match = seg.match(/(?:^|\D)(19[5-9]\d|20\d{2})(?!\d)/))) { car.year = Number(match[1]); found.push('year'); continue; }
    if ((match = seg.match(/^(PETROL\s*\/\s*CNG|PETROL\s*\+\s*CNG|DIESEL|PETROL|CNG|EV|ELECTRIC|HYBRID|PLUG-?IN\s*HYBRID)$/))) {
      car.fuel = { DIESEL: 'Diesel', PETROL: 'Petrol', CNG: 'CNG', EV: 'Electric', ELECTRIC: 'Electric', HYBRID: 'Hybrid' }[match[1]] || (/CNG/.test(match[1]) ? 'Petrol + CNG' : 'Plug-in hybrid');
      found.push('fuel'); continue;
    }
    if ((match = seg.match(/\b(FIRST|SECOND|THIRD|FOURTH|FIFTH|1ST|2ND|3RD|4TH|5TH)\s*OWNER/))) { car.owners = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5, '1ST': 1, '2ND': 2, '3RD': 3, '4TH': 4, '5TH': 5 }[match[1]]; found.push('owners'); continue; }
    if ((match = seg.match(/\b(AUTOMATIC|MANUAL|AMT|DCT|CVT)\b/)) && /TRANSMISSION|GEAR|^(AUTOMATIC|MANUAL|AMT|DCT|CVT)$/.test(seg)) { car.transmission = match[1] === 'MANUAL' ? 'Manual' : 'Automatic'; found.push('transmission'); continue; }
    if (/INSURANCE/.test(seg)) {
      car.insurance = /EXPIRED|LAPSED/.test(seg) ? 'expired' : /VAL[IU]D/.test(seg) ? 'valid' : '';
      if (car.insurance === 'valid') car.insuranceUntil = readDate(seg.replace(/INSURANCE|VAL[IU]D/g, ' '));
      found.push('insurance'); continue;
    }
    if (/\dKMS?\b|\bKMS?\b|KMDRIVEN|DRIVEN|^\d+\s*K$/.test(seg)) {
      const thousands = seg.match(/(\d+(?:\.\d+)?)\s*K\b/);
      const plain = seg.match(/(\d[\d,]*)\s*(KMS?|KM\b|DRIVEN)/);
      const km = thousands ? Number(thousands[1]) * 1000 : plain ? Number(plain[1].replace(/,/g, '')) : null;
      if (km !== null && Number.isFinite(km)) { car.kilometres = Math.round(km); found.push('kilometres'); continue; }
    }
    const plate = normalizeRegistration(seg);
    if (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(plate) && seg.length <= 16) { car.registration = plate; found.push('registration'); continue; }
    if ((match = seg.match(/^([A-Z]{2})\s*REG(ISTRATION|D|N)?\.?$/))) { car.registration = match[1]; found.push('registration'); continue; }
    if (/^CONVERTIBLE$/.test(seg)) { car.body = 'Convertible'; continue; }
    const extra = EXTRAS.find(([pattern]) => pattern.test(seg));
    const label = extra ? (typeof extra[1] === 'function' ? extra[1](seg.match(extra[0])) : extra[1]) : sentence(seg);
    if (label && !car.highlights.includes(label)) car.highlights.push(label);
  }
  // 4x4 in the name or the ad is a highlight too.
  if (/\b4\s*X\s*4\b/.test(text) && !car.highlights.includes('4x4')) car.highlights.push('4x4');
  car.variant = car.variant.replace(/\s*\b4x4\b\s*/i, ' ').trim();
  const name = `${car.model} ${car.variant}`.toUpperCase();
  car.body ||= BODIES.find(([, pattern]) => pattern.test(name))?.[0] || (car.make ? 'SUV' : '');
  return { car, found: [...new Set(found)] };
}
