/**
 * The watchlist in localStorage ("vf.watch.v1"), no account. Shape (data/schemas/watch.schema.json):
 *   items    { releaseKey: { t: title, a: "YYYY-MM-DD" added, s: [inStock, soldOut, minCents, currency] } }
 *   last     newest data date whose events were applied; day: UTC day of the last check
 *   changes  unseen changes, rows like the daily event files plus their date; past: seen ones
 * Storage can throw (private mode, blocked site data): every access is guarded.
 */
const KEY = 'vf.watch.v1';
export const EVENT = 'vf-watch-change';
export const today = () => new Date().toISOString().slice(0, 10);

let cache = null;
const empty = () => ({ items: {}, changes: [], past: [] });

export function load() {
  if (cache) return cache;
  let list = null;
  try { list = JSON.parse(localStorage.getItem(KEY)); } catch {}
  cache = list?.items ? { ...empty(), ...list } : empty();
  return cache;
}

export function save(list) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
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

/** Add records ([{ key, title, state }]); returns how many were new. */
export function add(records) {
  let added = 0;
  update((list) => {
    for (const { key, title, state } of records) {
      if (!key || list.items[key]) continue;
      list.items[key] = { t: title || '', a: today(), ...(state ? { s: state } : {}) };
      added++;
    }
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
    if (e.key !== KEY) return;
    cache = null;
    dispatchEvent(new Event(EVENT));
  });
} catch {}
