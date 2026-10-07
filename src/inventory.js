// The home page's featured collection: by default the most expensive cars on
// sale (three), so it keeps itself current as cars sell; or, if the admin
// chooses (Home page → Featured cars), the cars it picks, in their order.
// With no picks, the first cars of the collection; with no stock, the
// showcase previews.
import { loadSite, recommended, FOR_SALE, defaultSettings } from './data.js';
import { carCard, reveal } from './cards.js';

const lines = (element, text) => element.replaceChildren(...String(text).split('\n').flatMap((line, i) => i ? [document.createElement('br'), line] : [line]));

export async function setupFeatured() {
  const grid = document.querySelector('#vehicle-grid');
  const { cars, settings, previews } = await loadSite();
  const forSale = cars.filter(car => car.preview || FOR_SALE.includes(car.status));
  let picks = featuredCars(forSale, settings.home, previews);
  picks = picks.slice(0, Math.max(1, Number(settings.home.limit) || 3));
  document.querySelector('#inventory-title').textContent = settings.home.title;
  const intro = !previews && settings.home.intro === defaultSettings.home.intro ? 'A considered selection.\nExplore the details and arrange a closer look.' : settings.home.intro;
  lines(document.querySelector('#collection-intro'), intro);
  const cards = picks.map((car, index) => carCard(car, settings, { index }));
  grid.replaceChildren(...cards);
  reveal(cards);
  grid.removeAttribute('aria-busy');
  document.querySelector('#collection-count').textContent = previews ? `${picks.length} collection ${picks.length === 1 ? 'preview' : 'previews'}` : `${picks.length} of ${forSale.length} ${forSale.length === 1 ? 'car' : 'cars'} in the collection`;
  document.dispatchEvent(new Event('layout:change'));
}

// The cars the section shows, in order, before the limit.
export function featuredCars(forSale, home, previews = false) {
  if (home.choose !== 'picks' && !previews) {
    const priced = forSale.filter(car => car.status !== 'coming_soon');
    return [...priced].sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || recommended(a, b));
  }
  const picks = forSale.filter(car => car.featured).sort((a, b) => a.featuredRank - b.featuredRank);
  return picks.length ? picks : [...forSale].sort(recommended);
}
