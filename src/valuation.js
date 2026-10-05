import gsap from 'gsap';

// The valuation form, brought to life. A card beside it shows the car being
// described as the visitor types: its number plate in the Indian HSRP style,
// its name, an odometer whose drums roll to the kilometres entered (read out
// in thousands or lakhs), the owner and whether it is offered in exchange.
// Popular makes can be picked with one tap; each field ticks when it is
// complete, a five-step bar counts them, and the submit button lights up
// once everything is in. Preparing the enquiry stamps the card. The card
// tilts towards a fine pointer (after React Bits' TiltedCard). The form
// itself, its names and its submission (forms.js) are unchanged.
const REQUIRED = ['vehicle', 'registration', 'kilometres', 'name', 'phone'];
const DRUMS = 7; // up to 20,00,000 km, the field's maximum

// Registration numbers in their groups. The visitor's own spacing is kept;
// unspaced numbers are read as a state series ("mh01ab1234" → "MH 01 AB
// 1234"), Delhi's ("dl3cba7788" → "DL 3C BA 7788") or Bharat series
// ("22bh1234aa" → "22 BH 1234 AA"), and anything else is split where
// letters meet digits.
const PLATES = [/^(DL)(\d{1,2}[A-Z])([A-Z]{1,2})(\d{1,4})$/, /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/, /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/];
export function formatRegistration(value) {
  const upper = value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (upper.includes(' ')) return upper;
  for (const pattern of PLATES) {
    const match = upper.match(pattern);
    if (match) return match.slice(1).filter(Boolean).join(' ');
  }
  return upper.replace(/([A-Z]+)(?=\d)|(\d+)(?=[A-Z])/g, '$& ').trim();
}
// Kilometres as an Indian reader says them: thousands, then lakhs.
export function kilometresInWords(km) {
  if (!Number.isFinite(km) || km < 0) return '';
  const trim = n => n.toFixed(2).replace(/\.?0+$/, '');
  if (km < 1000) return `${km} km`;
  if (km < 100000) return `${trim(km / 1000)} thousand km`;
  return `${trim(km / 100000)} lakh km`;
}

export function setupValuation(form, card, { motion = true } = {}) {
  if (!form || !card) return;
  const field = name => form.elements[name];
  const plate = card.querySelector('[data-plate]');
  const vehicle = card.querySelector('[data-card-vehicle]');
  const words = card.querySelector('[data-card-km]');
  const owner = card.querySelector('[data-card-owner]');
  const progress = form.querySelector('[data-progress]');
  const segments = [...form.querySelectorAll('.progress-track i')];
  const inner = card.querySelector('.valuation-card-inner');
  const chips = [...form.querySelectorAll('[data-make]')];

  // Odometer drums: a strip of digits per place, rolled into position.
  const odometer = card.querySelector('[data-odometer]');
  const drums = Array.from({ length: DRUMS }, () => {
    const drum = document.createElement('span');
    drum.className = 'drum is-lead';
    const strip = document.createElement('span');
    strip.className = 'drum-strip';
    for (let d = 0; d <= 9; d++) { const digit = document.createElement('span'); digit.textContent = d; strip.append(digit); }
    drum.append(strip);
    odometer.append(drum);
    return drum;
  });

  // A changed line on the card glows briefly.
  const pulse = element => { element.classList.remove('is-changed'); void element.offsetWidth; element.classList.add('is-changed'); };
  const show = (element, text, placeholder) => {
    const next = text || placeholder;
    if (element.textContent === next) return;
    element.textContent = next;
    element.classList.toggle('is-placeholder', !text);
    if (text) pulse(element);
  };

  function update() {
    show(plate, formatRegistration(field('registration').value), 'MH 01 AB 1234');
    show(vehicle, field('vehicle').value.trim(), 'Make, model and year');
    // The chip for a make the visitor typed lights up too.
    const typed = field('vehicle').value.trim().toLowerCase();
    chips.forEach(chip => chip.setAttribute('aria-pressed', String(typed.startsWith(chip.dataset.make.toLowerCase()))));
    const raw = field('kilometres').value, km = raw === '' ? NaN : Math.min(2000000, Math.max(0, Math.round(Number(raw))));
    const digits = Number.isFinite(km) ? String(km).padStart(DRUMS, '0') : '0'.repeat(DRUMS);
    const lead = Number.isFinite(km) ? DRUMS - String(km).length : DRUMS;
    drums.forEach((drum, i) => { drum.style.setProperty('--d', digits[i]); drum.classList.toggle('is-lead', i < lead); });
    words.textContent = Number.isFinite(km) ? kilometresInWords(km) : 'Kilometres driven';
    const name = field('name').value.trim();
    owner.textContent = name ? `Owner: ${name}` : '';
    card.classList.toggle('is-exchange', field('exchange').checked);
    // Completion: a tick on each finished field, the bar, the button.
    let done = 0;
    for (const key of REQUIRED) {
      const input = field(key), ok = input.value.trim() !== '' && input.checkValidity();
      input.closest('label').classList.toggle('is-complete', ok);
      if (ok) done++;
    }
    progress.textContent = `${done} of ${REQUIRED.length}`;
    segments.forEach((segment, i) => segment.classList.toggle('is-on', i < done));
    form.classList.toggle('is-ready', done === REQUIRED.length);
  }
  // Editing after the enquiry is prepared lifts the stamp.
  const edit = () => { card.classList.remove('is-stamped'); update(); };
  form.addEventListener('input', edit);
  form.addEventListener('change', edit);
  form.addEventListener('reset', () => setTimeout(update));
  // Tidy the registration into its groups once the visitor moves on.
  field('registration').addEventListener('blur', () => { const input = field('registration'); input.value = formatRegistration(input.value); update(); });

  // One tap fills in a make, replacing one picked before.
  const makes = chips.map(button => button.dataset.make);
  chips.forEach(button => button.addEventListener('click', () => {
    const input = field('vehicle');
    const rest = input.value.replace(new RegExp(`^(${makes.map(m => m.replace(/[-\s]/g, '\\$&')).join('|')})\\s*`, 'i'), '');
    input.value = `${button.dataset.make} ${rest}`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    update();
  }));

  // Preparing the enquiry stamps the card (forms.js has shown the result).
  form.addEventListener('submit', () => { if (form.checkValidity()) requestAnimationFrame(() => card.classList.add('is-stamped')); });

  // Tilt towards the pointer, with a highlight that follows it.
  if (motion && matchMedia('(pointer: fine)').matches) {
    const rx = gsap.quickTo(inner, '--rx', { duration: .6, ease: 'power3.out' });
    const ry = gsap.quickTo(inner, '--ry', { duration: .6, ease: 'power3.out' });
    gsap.set(inner, { '--rx': 0, '--ry': 0 });
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
      ry((x - .5) * 14); rx((.5 - y) * 10);
      inner.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      inner.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
  update();
}
