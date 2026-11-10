import fs from 'node:fs';
import path from 'node:path';
import { loadShops } from '../lib/shops.js';
import { readJson, writeJson } from '../lib/json.js';
import { SHOPS_DIR } from '../lib/paths.js';
import { json, count } from '../enrich/http.js';
import { countryCode } from '../lib/country.js';

/**
 * The country and city of shops that have an OpenStreetMap element but no country or city, from Nominatim (the
 * OpenStreetMap geocoder, ODbL): `lookup` takes 50 elements per request, spaced by enrich.paceMs. Fills only what
 * is missing, never overwrites a curated value. `npm run locate` writes data/shops; `npm run discover -- --write`
 * runs it after adding shops.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/lookup';
const BATCH = 50;
const regions = new Intl.DisplayNames(['en'], { type: 'region' });

/** "node/123" -> "N123" (Nominatim's osm_ids). */
export const lookupId = (osm) => {
  const [type, id] = String(osm).split('/');
  return /^(node|way|relation)$/.test(type) && /^\d+$/.test(id) ? `${type[0].toUpperCase()}${id}` : null;
};

/** A Nominatim address -> { country, city }: a real ISO code, and the city, town or village in its own language. */
export function place(address = {}) {
  const cc = String(address.country_code || '').toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(cc) && countryCode(regions.of(cc)) === cc ? cc : undefined,
    city: address.city || address.town || address.village || address.municipality || undefined,
  };
}

/** Shops missing a country or a city, located: [{ id, country?, city? }], only the fields that were missing. */
export async function locate(shops) {
  const todo = shops.filter((s) => (!s.country || !s.city) && lookupId(s.osm));
  const byId = new Map(todo.map((s) => [lookupId(s.osm), s]));
  const found = [];
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += BATCH) {
    const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&osm_ids=${ids.slice(i, i + BATCH).join(',')}`;
    for (const r of (await json(url)) || []) {
      const shop = byId.get(`${r.osm_type?.[0]?.toUpperCase()}${r.osm_id}`);
      if (!shop) continue;
      const p = place(r.address);
      const fill = { id: shop.id };
      if (!shop.country && p.country) fill.country = p.country;
      if (!shop.city && p.city) fill.city = p.city;
      if (fill.country || fill.city) found.push(fill);
    }
  }
  return { asked: todo.length, found };
}

/** Writes the located fields into data/shops/<id>.json, keeping the file's field order (country, then city). */
export function save(found) {
  for (const { id, country, city } of found) {
    const file = path.join(SHOPS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const shop = readJson(file);
    const out = {};
    for (const [k, v] of Object.entries(shop)) {
      out[k] = v;
      if (k === 'name' || (k === 'url' && !('name' in shop))) {
        if (country && !shop.country) out.country = country;
        if (city && !shop.city) out.city = city;
      }
    }
    if (country && !out.country) out.country = country;
    if (city && !out.city) out.city = city;
    writeJson(file, out, true);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { asked, found } = await locate(loadShops({ withCandidates: false }));
  save(found);
  const n = (k) => found.filter((f) => f[k]).length;
  console.log(`locate: ${asked} shops asked, ${n('country')} countries and ${n('city')} cities filled (${[...count].map(([h, c]) => `${h} ${c}`).join(', ')})`);
}
