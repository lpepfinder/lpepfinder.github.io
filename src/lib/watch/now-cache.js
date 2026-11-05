/**
 * Current states of watched keys for one data build, kept in localStorage ("vf.watch.now.v1")
 * so a long list fetches the `now` shards once per daily build, and resumes after an interruption:
 *   { b: builtAt of /w/index.json, c: "key1key2…" every key checked (12 hex each, found or not),
 *     r: { key: now entry } for the keys found }
 * Compact: only watched keys, no titles. If storage is full the shop pairs are dropped, then the cache.
 */
const KEY = 'vf.watch.now.v1';

export function open(built) {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!cache || cache.b !== built) cache = { b: built, c: '', r: {} };
  const checked = new Set(cache.c.match(/.{12}/g) || []);
  return { built, checked, rows: cache.r };
}

const slim = (rows) => Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.slice(0, 4)]));

export function save({ built, checked, rows }) {
  const write = (r) => localStorage.setItem(KEY, JSON.stringify({ b: built, c: [...checked].join(''), r }));
  try { write(rows); } catch {
    try { write(slim(rows)); } catch {
      try { localStorage.removeItem(KEY); } catch {}
    }
  }
}
