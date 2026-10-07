// Collections: curated groups on the collection page (Signature, Family…),
// their order, visibility and cars. "Just arrived" and "Arriving soon" are
// made from the stock itself.
import { $, $$, esc, toast, fail, busy, confirmDialog, icon } from './ui.js';
import { siteURL } from './cars.js';
import { STATUS, carTitle } from '../data.js';
import { safeImage, slugify } from '../util.js';

const thumb = car => car.photos[0] ? `<img src="${esc(safeImage(car.photos[0]))}" alt="" loading="lazy" />` : icon.car;

export function renderCollections(view, app) {
  const listing = app.settings.listing;
  view.innerHTML = `<header class="a-head"><div><h1>Collections</h1><p class="a-sub">Curated groups on the collection page. A collection with no cars isn’t shown.</p></div><div class="a-head-actions"><a class="a-button" href="${esc(siteURL(app, '/collection/'))}" target="_blank" rel="noopener">View the page ${icon.out}</a><button type="button" class="a-button a-button--primary" data-new>${icon.plus}New collection</button></div></header>
    <section class="a-card"><ol class="a-ranked" data-groups></ol></section>
    <section class="a-card"><h2>Made automatically</h2><div class="a-auto"><div><b>Just arrived</b><p class="a-hint">Available cars added in the last few days.</p><form class="a-inline-form" data-days><label class="a-field">Days a car counts as new<input name="days" type="number" min="1" max="120" value="${Number(listing.newDays) || 21}" /></label><button class="a-button a-button--small" type="submit">Save</button></form></div><div><b>Arriving soon</b><p class="a-hint">Every car whose status is Coming soon.</p></div></div></section>`;

  const holder = $('[data-groups]', view);
  const count = slug => app.cars.filter(car => car.collections.includes(slug) && car.status !== 'hidden').length;
  const draw = () => {
    const groups = [...app.collections].sort((a, b) => a.sort_order - b.sort_order);
    holder.innerHTML = groups.length ? groups.map((group, i) => `<li class="a-rank${group.visible ? '' : ' is-muted'}" data-slug="${esc(group.slug)}"><span class="a-rank-n">${i + 1}</span><span class="a-row-text"><b>${esc(group.title)}</b><small>${esc(group.subtitle || '')}${group.subtitle ? ' · ' : ''}${count(group.slug)} ${count(group.slug) === 1 ? 'car' : 'cars'}${group.visible ? '' : ' · hidden'}</small></span><span class="a-rank-tools"><label class="a-switch a-switch--small" title="Show on the site"><input type="checkbox" data-visible${group.visible ? ' checked' : ''} /><span class="sr-only">Show ${esc(group.title)} on the site</span></label><button type="button" class="a-icon-button" data-move="-1" aria-label="Move ${esc(group.title)} up" ${i === 0 ? 'disabled' : ''}>${icon.up}</button><button type="button" class="a-icon-button" data-move="1" aria-label="Move ${esc(group.title)} down" ${i === groups.length - 1 ? 'disabled' : ''}>${icon.down}</button><button type="button" class="a-button a-button--small" data-edit>Edit</button></span></li>`).join('') : '<li class="a-empty a-empty--small"><p>No collections yet.</p></li>';
  };
  draw();

  holder.addEventListener('click', async event => {
    const row = event.target.closest('[data-slug]');
    if (!row) return;
    const groups = [...app.collections].sort((a, b) => a.sort_order - b.sort_order);
    const i = groups.findIndex(group => group.slug === row.dataset.slug);
    const move = event.target.closest('[data-move]');
    if (move) {
      const j = i + Number(move.dataset.move);
      const order = [...groups];
      [order[i], order[j]] = [order[j], order[i]];
      const changed = order.map((group, k) => ({ ...group, sort_order: k + 1 })).filter((group, k) => groups.find(other => other.slug === group.slug).sort_order !== k + 1);
      try {
        await Promise.all(changed.map(group => app.store.saveCollection(group)));
        app.collections = app.collections.map(group => changed.find(other => other.slug === group.slug) || group);
        draw();
        holder.querySelector(`[data-slug="${CSS.escape(order[j].slug)}"] [data-move="${move.dataset.move}"]`)?.focus();
      } catch (error) { fail(error); }
    }
    if (event.target.closest('[data-edit]')) edit(groups[i]);
  });
  holder.addEventListener('change', async event => {
    const input = event.target.closest('[data-visible]');
    if (!input) return;
    const group = app.collections.find(entry => entry.slug === input.closest('[data-slug]').dataset.slug);
    try { const saved = await app.store.saveCollection({ ...group, visible: input.checked }); app.collections = app.collections.map(entry => entry.slug === saved.slug ? saved : entry); draw(); toast(`${group.title} is ${input.checked ? 'shown' : 'hidden'}`); }
    catch (error) { fail(error); draw(); }
  });
  $('[data-new]', view).addEventListener('click', () => edit(null));
  $('[data-days]', view).addEventListener('submit', async event => {
    event.preventDefault();
    const days = Math.min(120, Math.max(1, Number(event.currentTarget.elements.days.value) || 21));
    try { const value = { ...app.settings.listing, newDays: days }; await app.store.saveSettings('listing', value); app.settings.listing = value; toast(`Cars count as new for ${days} days`); }
    catch (error) { fail(error); }
  });

  // The collection editor: its name, line, visibility and cars.
  function edit(group) {
    const creating = !group;
    const dialog = document.createElement('dialog');
    dialog.className = 'a-dialog a-collection-dialog';
    const members = new Set(creating ? [] : app.cars.filter(car => car.collections.includes(group.slug)).map(car => car.id));
    dialog.innerHTML = `<button type="button" class="a-dialog-close" data-close aria-label="Close">${icon.x}</button><h2>${creating ? 'New collection' : `Edit ${esc(group.title)}`}</h2><form data-form>
      <label class="a-field">Name<input name="title" required maxlength="40" placeholder="Performance" value="${esc(group?.title || '')}" /></label>
      <label class="a-field">One line about it<input name="subtitle" maxlength="90" placeholder="For the drive itself." value="${esc(group?.subtitle || '')}" /></label>
      <p class="a-hint" data-address>${creating ? 'Its web address is made from the name.' : `Web address: <code>/collection/?collection=${esc(group.slug)}</code>`}</p>
      <label class="a-switch"><input type="checkbox" name="visible"${group?.visible === false ? '' : ' checked'} /><span>Show on the site</span></label>
      <fieldset class="a-fieldset"><legend>Cars in this collection</legend><ul class="a-pick-list a-pick-list--checks">${app.cars.map(car => `<li><label><input type="checkbox" value="${esc(car.id)}"${members.has(car.id) ? ' checked' : ''} /><span class="a-thumb">${thumb(car)}</span><span class="a-row-text"><b>${esc(carTitle(car))}</b><small>${STATUS[car.status]}</small></span></label></li>`).join('') || '<li class="a-hint">Add cars first.</li>'}</ul></fieldset>
      <div class="a-dialog-actions">${creating ? '' : '<button type="button" class="a-button a-button--danger" data-delete>Delete</button>'}<button type="button" class="a-button a-button--ghost" data-close>Cancel</button><button type="submit" class="a-button a-button--primary">${creating ? 'Create' : 'Save'}</button></div></form>`;
    const form = $('[data-form]', dialog);
    if (creating) form.elements.title.addEventListener('input', () => { const slug = slugify(form.elements.title.value); $('[data-address]', dialog).innerHTML = slug ? `Web address: <code>/collection/?collection=${esc(slug)}</code>` : 'Its web address is made from the name.'; });
    $$('[data-close]', dialog).forEach(button => button.addEventListener('click', () => dialog.close()));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      if (!title) { form.elements.title.focus(); return; }
      let slug = group?.slug || slugify(title);
      if (creating) { let n = 2; const base = slug || 'collection'; slug = base; while (app.collections.some(other => other.slug === slug) || ['just-arrived', 'coming-soon'].includes(slug)) slug = `${base}-${n++}`; }
      const row = { slug, title, subtitle: form.elements.subtitle.value.trim() || null, cover: group?.cover || null, visible: form.elements.visible.checked, sort_order: group?.sort_order ?? Math.max(0, ...app.collections.map(other => other.sort_order)) + 1 };
      const chosen = new Set($$('.a-pick-list input:checked', form).map(input => input.value));
      await busy(form.querySelector('[type=submit]'), async () => {
        try {
          const saved = await app.store.saveCollection(row);
          app.collections = creating ? [...app.collections, saved] : app.collections.map(other => other.slug === saved.slug ? saved : other);
          // Each car whose membership changed.
          const changes = app.cars.filter(car => chosen.has(car.id) !== car.collections.includes(slug));
          const updated = await Promise.all(changes.map(car => app.store.patchCar(car.id, { collections: chosen.has(car.id) ? [...car.collections, slug] : car.collections.filter(other => other !== slug) })));
          app.cars = app.cars.map(car => updated.find(other => other.id === car.id) || car);
          dialog.close();
          draw();
          toast(creating ? `${title} created` : `${title} saved`);
        } catch (error) { fail(error); }
      });
    });
    $('[data-delete]', dialog)?.addEventListener('click', async () => {
      dialog.close();
      if (!(await confirmDialog({ title: `Delete ${group.title}?`, body: 'The cars stay in the collection; only this grouping goes.', confirm: 'Delete', danger: true }))) return;
      try {
        await app.store.deleteCollection(group.slug);
        const updated = await Promise.all(app.cars.filter(car => car.collections.includes(group.slug)).map(car => app.store.patchCar(car.id, { collections: car.collections.filter(other => other !== group.slug) })));
        app.cars = app.cars.map(car => updated.find(other => other.id === car.id) || car);
        app.collections = app.collections.filter(other => other.slug !== group.slug);
        draw();
        toast(`${group.title} deleted`);
      } catch (error) { fail(error); }
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }
}
