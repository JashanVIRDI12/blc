// How the dealership shows a car in every ad, on the site and in the admin:
// - the registration only by its first characters (the full number stays
//   private, in the admin);
// - a fancy or VIP number named with its digits: "Fancy No. 7272";
// - the distance as "Driven 75,000", never with "km";
// - insurance as Valid or Expired, never a date (a date, when the admin
//   knows one, only decides which of the two it is, and turns over by
//   itself on the day it lapses).
// Each label and the registration rule can be changed in the admin's
// Settings. Pure functions, so the admin, the site and the import tools share
// them.

export const LISTING_DEFAULTS = {
  drivenLabel: 'Driven',
  fancyLabel: 'Fancy No.',
  vipLabel: 'VIP No.',
  // 'rto': the state and the RTO district (HR51, DL3); 'chars': the first
  // `regChars` characters.
  regShow: 'rto',
  regChars: 4,
  showInsurance: true,
  // What a sold car still shows: no price, only the basics.
  soldFacts: ['year', 'fuel', 'body'],
};

const grouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const numeric = value => typeof value === 'number' && Number.isFinite(value);

// "75,000", with Indian grouping (1,01,000).
export const formatDriven = km => numeric(km) ? grouping.format(km) : '';
export const drivenText = (km, rules = LISTING_DEFAULTS) => numeric(km) ? `${rules.drivenLabel || 'Driven'} ${formatDriven(km)}` : '';

// "HR 51 cm 9909", "hr51cm9909" → "HR51CM9909".
export const normalizeRegistration = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// The part of a registration the site may show.
export function shownRegistration(full, rules = LISTING_DEFAULTS) {
  const plate = normalizeRegistration(full);
  if (!plate) return '';
  if (/^[A-Z]{2}$/.test(plate)) return plate; // only the state is known
  if (rules.regShow === 'chars') return plate.slice(0, Math.max(2, Number(rules.regChars) || 4));
  const match = plate.match(/^([A-Z]{2})(\d{1,2})/);
  return match ? `${match[1]}${match[2]}` : plate.slice(0, Math.max(2, Number(rules.regChars) || 4));
}

// Accept the number alone, or the final number in a registration. A state
// or RTO prefix such as HR51 is not a number plate. Keep leading zeros.
export function plateDigits(full) {
  const plate = normalizeRegistration(full);
  const digits = /^\d{1,4}$/.test(plate) ? plate
    : plate.match(/^[A-Z]{2}\d{1,2}[A-Z]{1,3}(\d{1,4})$/)?.[1]
      || plate.match(/^[A-Z]{2}\d{1,2}(\d{4})$/)?.[1];
  return digits ? digits.padStart(4, '0') : '';
}

const lowNumber = digits => /^00\d{2}$/.test(digits) && Number(digits) > 0;

// The dealership's automatic tags: one- and two-digit values (0001–0099)
// are VIP, as are four of a kind (7777) and a digit with three zeros (5000).
// Fancy includes repeating pairs, palindromes, triples, runs and 786.
export function suggestPlate(full) {
  const digits = plateDigits(full);
  if (!digits || Number(digits) === 0) return null;
  const [a, b, c, d] = digits;
  const counts = Object.values([...digits].reduce((map, x) => ({ ...map, [x]: (map[x] || 0) + 1 }), {}));
  const run = '0123456789', reversed = '9876543210';
  if (lowNumber(digits) || (a === b && b === c && c === d) || /^[1-9]000$/.test(digits)) return { tag: 'vip', number: digits };
  if ((a === c && b === d && a !== b) || (a === b && c === d) || (a === d && b === c) || counts.includes(3) || run.includes(digits) || reversed.includes(digits) || digits.endsWith('786')) return { tag: 'fancy', number: digits };
  return null;
}

// Correct older Fancy tags for low numbers on read and save. An explicit
// None stays untagged; other manual choices remain available to the admin.
export function normalizePlate(car) {
  const number = plateDigits(car?.plateNumber);
  const tag = ['vip', 'fancy'].includes(car?.plateTag) ? car.plateTag : '';
  if (!tag || !number || Number(number) === 0) return { plateTag: '', plateNumber: '' };
  return { plateTag: lowNumber(number) ? 'vip' : tag, plateNumber: number };
}

// "Fancy No. 7272", or nothing.
export function plateLabel(car, rules = LISTING_DEFAULTS) {
  const { plateTag, plateNumber } = normalizePlate(car);
  if (!plateTag) return '';
  return `${plateTag === 'vip' ? rules.vipLabel || 'VIP No.' : rules.fancyLabel || 'Fancy No.'} ${plateNumber}`;
}

// 'valid', 'expired' or ''. A known date wins over the stored word.
export function insuranceState(car, today = new Date()) {
  if (car?.insuranceUntil) {
    const until = new Date(`${String(car.insuranceUntil).slice(0, 10)}T23:59:59`);
    if (!Number.isNaN(until.getTime())) return until >= today ? 'valid' : 'expired';
  }
  return car?.insurance === 'valid' || car?.insurance === 'expired' ? car.insurance : '';
}
export const insuranceText = state => state === 'valid' ? 'Valid' : state === 'expired' ? 'Expired' : '';
// Days until a known insurance date lapses (negative once it has).
export function insuranceDays(car, today = new Date()) {
  if (!car?.insuranceUntil) return null;
  const until = new Date(`${String(car.insuranceUntil).slice(0, 10)}T23:59:59`);
  return Number.isNaN(until.getTime()) ? null : Math.ceil((until - today) / 864e5);
}
