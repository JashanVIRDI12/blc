// The collection page's promises, each under a hallmark: a gold-foil seal
// with the dealership's name and city around its rim and a mark for the
// promise at its centre (an inspection loupe, the papers, the rupee, a route
// across the country). They are set still, as printed: nothing moves.

const RIM = 'Baba Luxury Cars · New Delhi · Baba Luxury Cars · New Delhi · ';
// Each mark in the seal's 120-unit square, inside the inner ring (r 35).
const GLYPHS = {
  loupe: '<circle class="draw" pathLength="1" cx="56" cy="56" r="10.5"/><path class="draw" pathLength="1" d="M63.6 63.6 73 73" stroke-width="2.6"/><path class="draw" pathLength="1" d="M50.5 53.5a6.5 6.5 0 0 1 4-4"/>',
  papers: '<path class="draw" pathLength="1" d="M50 43h14l8 8v26H50z"/><path class="draw" pathLength="1" d="M64 43v8h8"/><path class="draw" pathLength="1" d="M55 58h12M55 63.5h12M55 69h7"/>',
  rupee: '<path class="draw" pathLength="1" d="M49 46h22M49 53h22"/><path class="draw" pathLength="1" d="M54 46c11 0 12.5 13 1 14h-4.5L66 76"/>',
  route: '<path class="fade" d="M46 70C47 54 60 46 72.5 50" stroke-dasharray="2.2 3.2"/><circle class="draw" pathLength="1" cx="45.5" cy="72.5" r="2.4"/><path class="draw" pathLength="1" d="M75 57.5c-3.4-4.3-5.4-6.8-5.4-9.4a5.4 5.4 0 0 1 10.8 0c0 2.6-2 5.1-5.4 9.4z"/><circle class="draw" pathLength="1" cx="75" cy="48.3" r="1.6"/>',
};

function sealSVG(glyph, k) {
  return `<span class="c-seal-die"><svg viewBox="0 0 120 120" focusable="false">
    <defs>
      <linearGradient id="foil-${k}" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="120" y2="100" gradientTransform="translate(0 0)">
        <stop offset="0" stop-color="#7d4d22"/><stop offset=".3" stop-color="#b98336"/><stop offset=".44" stop-color="#e9c47a"/>
        <stop offset=".5" stop-color="#fff2cf"/><stop offset=".56" stop-color="#e2b562"/><stop offset=".74" stop-color="#a06c2c"/><stop offset="1" stop-color="#6e4219"/>
      </linearGradient>
      <path id="rim-${k}" d="M60 60m-40.5 0a40.5 40.5 0 1 1 81 0a40.5 40.5 0 1 1-81 0"/>
    </defs>
    <g fill="none" stroke="url(#foil-${k})">
      <circle cx="60" cy="60" r="57" stroke-width="1.5"/><circle cx="60" cy="60" r="53.2" stroke-width=".55"/><circle cx="60" cy="60" r="35" stroke-width=".55"/>
    </g>
    <text fill="url(#foil-${k})" font-size="8.2" font-style="italic"><textPath href="#rim-${k}" textLength="252" lengthAdjust="spacing">${RIM}</textPath></text>
    <g class="c-seal-glyph" fill="none" stroke="url(#foil-${k})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph] || ''}</g>
  </svg></span><i class="c-seal-ring"></i>`;
}

export function createHallmarks(band) {
  if (!band) return;
  band.querySelectorAll('.c-promise [data-seal]').forEach((seal, k) => { seal.innerHTML = sealSVG(seal.dataset.seal, k); });
}
