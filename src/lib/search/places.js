import { normalize } from './tokenize.js';

/**
 * The pages a search can lead to besides records: shops and countries whose name matches the query
 * (/search/places.json, src/pages/search/places.json.js). Shared by the browser and the tests.
 *
 * A name matches when it is the query, when the query holds it as whole words ("records berlin germany"),
 * or when it starts with the query (from 3 characters; 4 for a shop, whose names are full of common words).
 * Exact matches come first, then countries, then shops with the most records.
 */
const MIN = 3;
const MIN_SHOP_PREFIX = 4;

/** How well `name` matches the normalized query: 0 exact, 1 its words are in the query, 2 a prefix; null for none. */
export function score(name, q, minPrefix = MIN) {
  const n = normalize(name);
  if (!n) return null;
  if (n === q) return 0;
  if (` ${q} `.includes(` ${n} `)) return 1;
  if (q.length >= minPrefix && n.startsWith(q)) return 2;
  return null;
}

/** The shop's address without "www." and its domain ending ("flur.pt" -> "flur"): people search shops by it too. */
const hostName = (id) => id.replace(/\.[a-z]+$/, '').replace(/[.-]/g, ' ');

/**
 * places: { shops: [[id, name, country, records]], countries: [[code, shops]] }; countryNames(code) -> names in the
 * reader's language and in English. Returns at most `max` of { kind: 'country', code, shops } and
 * { kind: 'shop', id, name, country }.
 */
export function findPlaces(query, places, countryNames, max = 4) {
  const q = normalize(query);
  if (q.length < MIN || !places) return [];
  const found = [];
  for (const [code, shops] of places.countries || []) {
    const s = Math.min(...countryNames(code).map((n) => score(n, q) ?? Infinity));
    if (s !== Infinity) found.push({ kind: 'country', code, shops, s, rank: -shops });
  }
  for (const [id, name, country, records] of places.shops || []) {
    const s = Math.min(score(name, q, MIN_SHOP_PREFIX) ?? Infinity, normalize(hostName(id)) === q ? 0 : Infinity);
    if (s !== Infinity) found.push({ kind: 'shop', id, name, country, s, rank: -records });
  }
  const order = (p) => [p.s === 0 ? 0 : 1, p.kind === 'country' ? 0 : 1, p.s, p.rank];
  const compare = (a, b) => order(a).reduce((d, x, i) => d || x - order(b)[i], 0);
  return found
    .sort(compare)
    .slice(0, max)
    .map(({ s, rank, ...p }) => p);
}
