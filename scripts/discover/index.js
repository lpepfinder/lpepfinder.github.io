import fs from 'node:fs';
import path from 'node:path';
import { loadShops, hostOf } from '../lib/shops.js';
import { writeJson, readJson } from '../lib/json.js';
import { files, SHOPS_DIR } from '../lib/paths.js';
import { pool } from '../lib/pool.js';
import { checkShop } from '../check/shop.js';
import { osmCandidates } from './osm.js';
import { countryCode } from '../lib/country.js';

const regions = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Find new record shops (OpenStreetMap for now), check them like curated shops,
 * and keep the ones with a readable record catalog in generated/candidates.json.
 * `--write` also saves them as data/shops/<host>.json files (to commit).
 */
const write = process.argv.includes('--write');
const known = new Set(loadShops({ withCandidates: false }).map((s) => s.id));
const previous = readJson(files.candidates, []);
const seen = new Set(previous.map((c) => c.id));

const raw = await osmCandidates();
const fresh = [];
for (const c of raw) {
  let origin;
  try { origin = new URL(/^https?:\/\//.test(c.url) ? c.url : `https://${c.url}`).origin; } catch { continue; }
  const id = hostOf(origin);
  if (!id || known.has(id) || seen.has(id) || /facebook|instagram|discogs|bandcamp\.com$|ebay|etsy|linktr/.test(id)) continue;
  seen.add(id);
  fresh.push({ id, url: origin, name: c.name, country: c.country?.toUpperCase(), city: c.city, osm: c.osm, vinyl: c.vinyl });
}
console.log(`osm: ${raw.length} music shops with a website, ${fresh.length} new to check`);

const accepted = [];
await pool(fresh, 16, async (c) => {
  const state = await checkShop(c).catch(() => null);
  if (state?.status === 'ok' || (state?.status === 'listed' && c.vinyl)) accepted.push({ ...c, platform: state.platform, status: state.status });
});
const candidates = [...previous, ...accepted];
writeJson(files.candidates, candidates, true);
console.log(`discover: ${accepted.length} new shops accepted (${candidates.length} candidates in total)`);

if (write) {
  for (const c of candidates) {
    const file = path.join(SHOPS_DIR, `${c.id}.json`);
    if (fs.existsSync(file)) continue;
    const country = /^[A-Z]{2}$/.test(c.country || '') && countryCode(regions.of(c.country)) === c.country ? c.country : undefined;
    const shop = { url: c.url, name: c.name, country, city: c.city, osm: c.osm, source: 'osm' };
    writeJson(file, shop, true);
  }
  console.log('written to data/shops/');
}
