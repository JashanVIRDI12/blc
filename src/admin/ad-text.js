// A car as the team's WhatsApp ad, in their own style ("KIA CARNIVAL {WHITE
// COLOUR} | 2020 MODEL | … | @✅17.95LACS"), with the dealership's rules: the
// registration only by its first characters, "DRIVEN 75,000" (never km),
// insurance VALID or EXPIRED (no date), a fancy or VIP number named. Ends with
// the car's link on the site.
import { drivenText, plateLabel, insuranceState } from '../listing-rules.js';
import { LISTING_DEFAULTS } from '../listing-rules.js';

const ORDINAL = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH'];
const priceTag = price => !Number.isFinite(price) || price <= 0 ? '' : price >= 1e7 ? `@✅${+(price / 1e7).toFixed(2)}CR` : `@✅${+(price / 1e5).toFixed(2)}LACS`;

export function adText(car, listing = LISTING_DEFAULTS, origin = location.origin) {
  const finance = car.highlights.some(item => /finance/i.test(item));
  const insurance = listing.showInsurance === false ? '' : insuranceState(car);
  const parts = [
    `${[car.make, car.model, car.variant].filter(Boolean).join(' ').toUpperCase()}${car.colour ? ` {${car.colour.toUpperCase()} COLOUR}` : ''}`,
    car.year ? `${car.year} MODEL` : '',
    car.fuel ? car.fuel.toUpperCase() : '',
    car.owners ? `${ORDINAL[car.owners] || `${car.owners}TH`} OWNER` : '',
    car.transmission ? `${car.transmission.toUpperCase()} TRANSMISSION` : '',
    ...car.highlights.filter(item => !/finance/i.test(item)).map(item => item.toUpperCase()),
    car.registration ? car.registration.toUpperCase() : '',
    plateLabel(car, listing).toUpperCase(),
    car.status === 'sold' ? '' : drivenText(car.kilometres, listing).toUpperCase(),
    insurance && car.status !== 'sold' ? `INSURANCE ${insurance.toUpperCase()}` : '',
    finance && car.status !== 'sold' ? 'PAN INDIA FINANCE AVAILABLE' : '',
    car.status === 'sold' ? 'SOLD' : car.status === 'reserved' ? 'RESERVED' : priceTag(car.price),
  ].filter(Boolean);
  return `${parts.join(' | ')}${car.slug ? `\n${origin}/car/?id=${encodeURIComponent(car.slug)}` : ''}`;
}
