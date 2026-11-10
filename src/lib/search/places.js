import { normalize } from './tokenize.js';

/**
 * The pages a search can lead to besides records: countries, cities, artists and shops whose name matches the query
 * (/search/places.json, src/pages/search/places.json.js; /search/artists.json from the index). Shared by the
 * browser and the tests.
 *
 * A name matches when it is the query, when the query holds it as whole words ("pink floyd animals"),
 * or when it starts with the query (from 3 characters for a country; 4 for an artist or a shop). A one-word
 * artist ("Love", "Pink") must be the whole query, and a name that only starts with the query shows only when
 * nothing matches better. A city matches by its name in any language or a local spelling ("wien", "渋谷区").
 * Exact matches come first, then countries, cities, artists (most shops first) and shops (most records first).
 */
const MIN = 3;
const MIN_NAME_PREFIX = 4;
const KINDS = ['country', 'city', 'artist', 'shop'];

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
 * places: { shops: [[id, name, country, records]], countries: [[code, shops]], cities: [[country, slug, shops,
 * { en, fr…: name }, [local spellings]]] }; artists: [[slug, name, records]] in page order (or null);
 * countryNames(code) -> names in the reader's language and in English. Returns at most `max` of
 * { kind: 'country', code, shops }, { kind: 'city', country, slug, shops, names }, { kind: 'artist', slug, name }
 * and { kind: 'shop', id, name, country }.
 */
export function findPlaces(query, places, countryNames, artists = [], max = 4) {
  const q = normalize(query);
  if (q.length < MIN || !places) return [];
  const found = [];
  for (const [code, shops] of places.countries || []) {
    const s = Math.min(...countryNames(code).map((n) => score(n, q) ?? Infinity));
    if (s !== Infinity) found.push({ kind: 'country', code, shops, s, rank: -shops });
  }
  for (const [country, slug, shops, names, aliases = []] of places.cities || []) {
    const s = Math.min(...[...Object.values(names), ...aliases].map((n) => score(n, q, MIN_NAME_PREFIX) ?? Infinity));
    if (s !== Infinity) found.push({ kind: 'city', country, slug, shops, names, s, rank: -shops });
  }
  (artists || []).forEach(([slug, name], i) => {
    const s = score(name, q, MIN_NAME_PREFIX);
    if (s !== null && !(s === 1 && !normalize(name).includes(' '))) found.push({ kind: 'artist', slug, name, s, rank: i });
  });
  for (const [id, name, country, records] of places.shops || []) {
    const s = Math.min(score(name, q, MIN_NAME_PREFIX) ?? Infinity, normalize(hostName(id)) === q ? 0 : Infinity);
    if (s !== Infinity) found.push({ kind: 'shop', id, name, country, s, rank: -records });
  }
  const order = (p) => [p.s === 0 ? 0 : 1, KINDS.indexOf(p.kind), p.s, p.rank];
  const compare = (a, b) => order(a).reduce((d, x, i) => d || x - order(b)[i], 0);
  const best = Math.min(...found.map((p) => p.s));
  return found
    .filter((p) => p.s < 2 || best === 2)
    .sort(compare)
    .slice(0, max)
    .map(({ s, rank, ...p }) => p);
}
