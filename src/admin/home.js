// Home page: which cars the Featured collection shows, in what order, and
// the words above them.
import { $, $$, esc, toast, fail, busy, icon } from './ui.js';
import { siteURL } from './cars.js';
import { STATUS, FOR_SALE, formatPrice, carTitle } from '../data.js';
import { safeImage } from '../util.js';
import { featuredCars } from '../inventory.js';

const thumb = car => car.photos[0] ? `<img src="${esc(safeImage(car.photos[0]))}" alt="" loading="lazy" />` : icon.car;

export function renderHome(view, app) {
  const home = app.settings.home;
  view.innerHTML = `<header class="a-head"><div><h1>Home page</h1><p class="a-sub">The cars in the home page’s Featured collection, their order, and the words above them.</p></div><a class="a-button" href="${esc(siteURL(app, '/'))}#inventory" target="_blank" rel="noopener">View the home page ${icon.out}</a></header>
  <div class="a-two">
    <section class="a-card"><div class="a-card-head"><h2>Featured cars</h2><button type="button" class="a-button a-button--small a-button--primary" data-add${home.choose === 'picks' ? '' : ' hidden'}>${icon.plus}Add a car</button></div>
      <div class="a-segment a-segment--wide" role="radiogroup" aria-label="Which cars"><label><input type="radio" name="choose" value="priciest"${home.choose === 'picks' ? '' : ' checked'} /><span>The most expensive on sale</span></label><label><input type="radio" name="choose" value="picks"${home.choose === 'picks' ? ' checked' : ''} /><span>My picks</span></label></div>
      <p class="a-hint" data-choose-hint></p>
      <ol class="a-ranked" data-ranked></ol></section>
    <section class="a-card"><h2>Section text</h2><form data-text>
      <label class="a-field">Heading<input name="title" maxlength="60" value="${esc(home.title)}" /></label>
      <label class="a-field">Introduction<textarea name="intro" rows="3" maxlength="220">${esc(home.intro)}</textarea><small>A new line here is a new line on the site.</small></label>
      <label class="a-field">How many cars to show<select name="limit">${[3, 4, 6, 8, 9, 12].map(n => `<option${Number(home.limit) === n ? ' selected' : ''}>${n}</option>`).join('')}</select><small>Three or six fill the rows best on a computer.</small></label>
      <button type="submit" class="a-button a-button--primary">Save text</button></form></section>
  </div>`;

  const ranked = $('[data-ranked]', view);
  const featured = () => app.cars.filter(car => car.featured).sort((a, b) => a.featuredRank - b.featuredRank);
  const draw = () => {
    const limit = Number(app.settings.home.limit) || 3;
    // Automatic: the most expensive cars on sale, kept current as cars sell.
    if (app.settings.home.choose !== 'picks') {
      $('[data-choose-hint]', view).textContent = `Chosen by themselves: the ${limit} most expensive cars on sale, highest first. When one sells, the next takes its place.`;
      const auto = featuredCars(app.cars.filter(car => FOR_SALE.includes(car.status)), app.settings.home).slice(0, limit);
      ranked.innerHTML = auto.length ? auto.map((car, i) => `<li class="a-rank"><span class="a-rank-n">${i + 1}</span><span class="a-thumb">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${esc(formatPrice(car.price) || 'Price on request')}</small></span><span class="a-rank-tools"><a class="a-button a-button--small" href="#car/${esc(car.id)}">Edit</a></span></li>`).join('') : '<li class="a-empty a-empty--small"><p>No cars on sale yet.</p></li>';
      return;
    }
    $('[data-choose-hint]', view).textContent = 'Shown in this order. Drag a row, or use the arrows. With none chosen, the newest cars show.';
    const cars = featured();
    let shown = 0;
    ranked.innerHTML = cars.length ? cars.map((car, i) => {
      const live = FOR_SALE.includes(car.status);
      const position = live ? ++shown : null;
      const note = !live ? `${STATUS[car.status]}: not shown` : position > limit ? `Waiting: only ${limit} are shown` : '';
      return `<li class="a-rank${note ? ' is-muted' : ''}" draggable="true" data-id="${esc(car.id)}"><span class="a-grip" aria-hidden="true">${icon.grip}</span><span class="a-rank-n">${live && position <= limit ? position : '–'}</span><span class="a-thumb">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${esc(note || formatPrice(car.price) || 'Price on request')}</small></span><span class="a-rank-tools"><button type="button" class="a-icon-button" data-move="-1" aria-label="Move ${esc(car.model)} up" ${i === 0 ? 'disabled' : ''}>${icon.up}</button><button type="button" class="a-icon-button" data-move="1" aria-label="Move ${esc(car.model)} down" ${i === cars.length - 1 ? 'disabled' : ''}>${icon.down}</button><button type="button" class="a-icon-button" data-unfeature aria-label="Take ${esc(car.model)} off the home page" title="Remove">${icon.x}</button></span></li>`;
    }).join('') : '<li class="a-empty a-empty--small"><p>No cars chosen, so the newest cars in the collection show.</p></li>';
  };
  draw();

  // Which cars: saved at once.
  view.querySelectorAll('[name=choose]').forEach(input => input.addEventListener('change', async () => {
    const value = { ...app.settings.home, choose: input.value };
    try {
      await app.store.saveSettings('home', value);
      app.settings.home = value;
      $('[data-add]', view).hidden = input.value !== 'picks';
      draw();
      toast(input.value === 'picks' ? 'The home page shows your picks' : 'The home page shows the most expensive cars on sale');
    } catch (error) { fail(error); }
  }));

  async function reorder(ids) {
    const changes = ids.map((id, i) => [app.cars.find(car => car.id === id), i + 1]).filter(([car, rank]) => car.featuredRank !== rank);
    app.cars = app.cars.map(car => { const rank = ids.indexOf(car.id); return rank < 0 ? car : { ...car, featuredRank: rank + 1 }; });
    draw();
    try {
      await Promise.all(changes.map(([car, rank]) => app.store.patchCar(car.id, { featuredRank: rank })));
      toast('Order saved');
    } catch (error) { fail(error); }
  }
  ranked.addEventListener('click', async event => {
    const row = event.target.closest('[data-id]');
    if (!row) return;
    const ids = featured().map(car => car.id);
    const i = ids.indexOf(row.dataset.id);
    const move = event.target.closest('[data-move]');
    if (move) { const j = i + Number(move.dataset.move); [ids[i], ids[j]] = [ids[j], ids[i]]; await reorder(ids); ranked.querySelector(`[data-id="${CSS.escape(ids[j])}"] [data-move="${move.dataset.move}"]`)?.focus(); }
    if (event.target.closest('[data-unfeature]')) {
      const car = app.cars.find(entry => entry.id === row.dataset.id);
      try {
        const saved = await app.store.patchCar(car.id, { featured: false });
        app.cars = app.cars.map(entry => entry.id === car.id ? saved : entry);
        draw();
        toast(`${car.make} ${car.model} is off the home page`, { action: 'Undo', onAction: async () => { try { const back = await app.store.patchCar(car.id, { featured: true }); app.cars = app.cars.map(entry => entry.id === car.id ? back : entry); draw(); } catch (error) { fail(error); } } });
      } catch (error) { fail(error); }
    }
  });
  // Drag a row to its place.
  let dragged = null;
  ranked.addEventListener('dragstart', event => { dragged = event.target.closest('[data-id]'); dragged?.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; });
  ranked.addEventListener('dragover', event => {
    if (!dragged) return;
    event.preventDefault();
    const over = event.target.closest('[data-id]');
    if (!over || over === dragged) return;
    const box = over.getBoundingClientRect();
    over[event.clientY < box.top + box.height / 2 ? 'before' : 'after'](dragged);
  });
  ranked.addEventListener('dragend', () => { if (!dragged) return; dragged.classList.remove('is-dragging'); dragged = null; reorder($$('[data-id]', ranked).map(row => row.dataset.id)); });

  // Add a car from the collection.
  $('[data-add]', view).addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'a-dialog a-picker';
    const candidates = app.cars.filter(car => !car.featured && FOR_SALE.includes(car.status));
    dialog.innerHTML = `<button type="button" class="a-dialog-close" data-close aria-label="Close">${icon.x}</button><h2>Add to the home page</h2><label class="a-search">${icon.search}<span class="sr-only">Search</span><input type="search" placeholder="Search" data-find /></label><ul class="a-pick-list" data-picks>${candidates.length ? '' : '<li class="a-hint">Every car for sale is already featured.</li>'}</ul>`;
    const picks = $('[data-picks]', dialog);
    const drawPicks = text => {
      if (!candidates.length) return;
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      picks.innerHTML = candidates.filter(car => words.every(word => carTitle(car).toLowerCase().includes(word))).map(car => `<li><button type="button" data-pick="${esc(car.id)}"><span class="a-thumb">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${esc([car.year, formatPrice(car.price), STATUS[car.status]].filter(Boolean).join(' · '))}</small></span><span class="a-pick-add">${icon.plus}Add</span></button></li>`).join('') || '<li class="a-hint">No match.</li>';
    };
    drawPicks('');
    $('[data-find]', dialog)?.addEventListener('input', event => drawPicks(event.target.value));
    $('[data-close]', dialog).addEventListener('click', () => dialog.close());
    picks.addEventListener('click', async event => {
      const button = event.target.closest('[data-pick]');
      if (!button) return;
      const car = app.cars.find(entry => entry.id === button.dataset.pick);
      const featuredRank = Math.max(0, ...app.cars.filter(entry => entry.featured).map(entry => entry.featuredRank)) + 1;
      await busy(button, async () => {
        try {
          const saved = await app.store.patchCar(car.id, { featured: true, featuredRank });
          app.cars = app.cars.map(entry => entry.id === car.id ? saved : entry);
          candidates.splice(candidates.indexOf(car), 1);
          draw();
          button.closest('li').remove();
          toast(`${car.make} ${car.model} added to the home page`);
        } catch (error) { fail(error); }
      });
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  });

  // The words above the cars.
  $('[data-text]', view).addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = { ...app.settings.home, title: form.elements.title.value.trim() || 'Featured collection.', intro: form.elements.intro.value.trim(), limit: Number(form.elements.limit.value) };
    await busy(form.querySelector('[type=submit]'), async () => {
      try { await app.store.saveSettings('home', value); app.settings.home = { ...app.settings.home, ...value }; draw(); toast('Home page text saved'); }
      catch (error) { fail(error); }
    });
  });
}
