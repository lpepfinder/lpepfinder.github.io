/**
 * The watchlist in localStorage ("vf.watch.v1"), no account. Shape (data/schemas/watch.schema.json):
 *   items    { releaseKey: { t: title, u: url of the copy watched, o: [priceCents, currency, shop] of that copy,
 *              a: "YYYY-MM-DD" added, s: [inStock, soldOut, minCents, currency],
 *              f: "YYYY-MM-DD" found in stock (after being out of stock), x: extra release keys found by catalog number,
 *              n: release keys marked "not this record", m: max price (euro cents),
 *              w, c, r: Discogs release id, catalog number, rating (src/lib/watch/wants.js) } }
 *            The `now` shards carry counts only: title, url and shop come from the card watched or from events.
 *   last     newest data date whose events were applied; day: UTC day of the last check
 *   changes  unseen changes, rows like the daily event files plus their date; past: seen ones
 * Storage can throw (private mode, blocked site data): every access is guarded.
 */
import { scoped } from './profiles.js';

// the current profile's list (profiles.js): "vf.watch.v1", or "vf.watch.v1:<profile>"
const KEY = () => scoped('vf.watch.v1');
export const EVENT = 'vf-watch-change';
export const today = () => new Date().toISOString().slice(0, 10);

let cache = null;
const empty = () => ({ items: {}, changes: [], past: [] });

export function load() {
  if (cache) return cache;
  let list = null;
  try { list = JSON.parse(localStorage.getItem(KEY())); } catch {}
  cache = list?.items ? { ...empty(), ...list } : empty();
  return cache;
}

export function save(list) {
  cache = list;
  try { localStorage.setItem(KEY(), JSON.stringify(list)); } catch {}
  dispatchEvent(new Event(EVENT));
}

/** Load, change, save: always on the latest copy. */
export function update(fn) {
  const list = load();
  fn(list);
  save(list);
  return list;
}

export const size = () => Object.keys(load().items).length;
export const isWatched = (key) => key in load().items;

/** Add records ([{ key, title, url, offer, state, fields }]; fields: extra item fields, wants.js); returns how many were new. */
export function add(records) {
  let added = 0;
  update((list) => {
    for (const { key, title, url, offer, state, fields } of records) {
      if (!key) continue;
      // a record watched again (a Discogs import over the same list) keeps its state and gets the new fields
      if (list.items[key]) { if (fields) Object.assign(list.items[key], fields); continue; }
      list.items[key] = { t: title || '', a: today(), ...(url ? { u: url } : {}), ...(offer ? { o: offer } : {}), ...(state ? { s: state } : {}), ...fields };
      added++;
    }
    // records added since the watch page was last opened: the tab shows "+n"
    if (added) list.fresh = (list.fresh || 0) + added;
  });
  return added;
}

export const remove = (key) => update((list) => {
  delete list.items[key];
  list.changes = list.changes.filter((c) => c[0] !== key);
});

/** Another tab changed the list. */
try {
  addEventListener('storage', (e) => {
    if (e.key !== KEY()) return;
    cache = null;
    dispatchEvent(new Event(EVENT));
  });
} catch {}
