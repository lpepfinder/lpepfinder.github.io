/**
 * Discogs wants as watched records, and matching them to shop listings:
 * - by release key of "Artist – Title" (the key every shop listing gets, release-key.js)
 * - by catalog number (cat/ files, catno.js), kept only when the listing starts with a word of the want,
 *   so "UR-001" of another label doesn't match.
 * A want's item: { t, a, w: Discogs release id, c: catalog number (matching form), r: rating 0-5, i: cover thumbnail }.
 * Merged rows: one `now` entry per item, over its own key and the keys its catalog number found.
 */
import { releaseKey, hash48 } from '../search/release-key.js';
import { normCatno, wantTags } from './catno.js';

export const wantTitle = (w) => [w.artist, w.title].filter(Boolean).join(' – ');

/** Records for store.add(): the release key of "Artist – Title", else a key of the Discogs id (never found by title). */
export function wantRecords(wants) {
  return wants.map((w) => {
    const title = wantTitle(w);
    const key = releaseKey(title) || hash48(`discogs:${w.id || title}`);
    const fields = { ...(w.id ? { w: w.id } : {}), ...(normCatno(w.catno) ? { c: normCatno(w.catno) } : {}), ...(w.rating ? { r: w.rating } : {}), ...(w.thumb ? { i: w.thumb } : {}) };
    return { key, title, fields };
  });
}

/**
 * Extra release keys of items, from catalog numbers: { itemKey: [releaseKey, …] }.
 * cat: { catno: ["releaseKey:tag", …] } for the items' numbers.
 */
export function catalogKeys(items, cat) {
  const out = {};
  for (const [key, it] of Object.entries(items)) {
    const entries = it.c && cat[it.c];
    if (!entries) continue;
    const tags = wantTags(it.t || '', '');
    const keys = [...new Set(entries.map((e) => e.split(':')).filter(([k, tag]) => k !== key && tags.has(tag) && !it.n?.includes(k)).map(([k]) => k))];
    if (keys.length) out[key] = keys;
  }
  return out;
}

/**
 * One `now` entry ([inStock, soldOut, minCents, currency, shopPairs?]) from several:
 * counts added, each shop at its lowest price, the cheapest first (by `value`, comparable prices).
 */
export function mergeRows(rows, value = (cents) => cents) {
  const found = rows.filter(Boolean);
  if (found.length < 2) return found[0] || null;
  const shops = new Map();
  for (const r of found) {
    const pairs = r[4] || [];
    for (let i = 0; i < pairs.length; i += 2) {
      const best = shops.get(pairs[i]);
      if (best === undefined || (pairs[i + 1] ?? Infinity) < (best ?? Infinity)) shops.set(pairs[i], pairs[i + 1]);
    }
  }
  const inStock = found.filter((r) => r[0]);
  const pick = (inStock.length ? inStock : found).reduce((a, b) => (value(b[2], b[3]) < value(a[2], a[3]) ? b : a));
  const entry = [found.reduce((n, r) => n + r[0], 0), found.reduce((n, r) => n + r[1], 0), pick[2], pick[3]];
  if (shops.size) entry.push([...shops].sort((a, b) => (a[1] ?? Infinity) - (b[1] ?? Infinity)).flat());
  return entry;
}
