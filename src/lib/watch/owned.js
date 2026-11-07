/**
 * The collector's collection ("haves", from Discogs): release keys of records they own, kept with the
 * current profile's watchlist (store.js, `owned`). Search marks them, Dig can hide them.
 */
import { load, update } from './store.js';
import { wantRecords } from './wants.js';

let keys = null;
let of = null;

/** Release keys owned, as a Set (cached until the list changes). */
export function ownedKeys() {
  const list = load();
  if (of !== list.owned) { of = list.owned; keys = new Set(list.owned || []); }
  return keys;
}

/** Replace the collection with these releases (a full import), or add them (one page of a long import). */
export function setOwned(releases, { replace = false } = {}) {
  const found = wantRecords(releases).map((r) => r.key);
  update((list) => {
    list.owned = [...new Set([...(replace ? [] : list.owned || []), ...found])];
    list.ownedAt = new Date().toISOString().slice(0, 10);
  });
  return found.length;
}
