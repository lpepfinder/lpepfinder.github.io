import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { releaseKey } from '../src/lib/search/release-key.js';

const DIST = path.resolve(import.meta.dirname, '../dist');
const read = (file) => JSON.parse(fs.readFileSync(path.join(DIST, file), 'utf8'));
const nowShards = new Map();
const nowRow = (key) => {
  const shard = key.slice(0, 3);
  if (!nowShards.has(shard)) {
    try { nowShards.set(shard, read(`w/now/${shard}.json`)); } catch { nowShards.set(shard, {}); }
  }
  return nowShards.get(shard)[key];
};

/**
 * Discogs wants made of records in stock in the built site (dist/search and dist/w), so the import finds them:
 * the full shop title as the want's title, no artist, so its release key is the listing's.
 * Distinct release keys, titles of a few words (searchable), in stock today.
 */
export function wantsFromSite(count = 6) {
  const meta = read('search/meta.json');
  const chunks = Math.ceil(meta.docs / meta.docsPerChunk);
  const keys = new Set();
  const wants = [];
  for (let c = 0; c < chunks && wants.length < count; c += Math.max(1, Math.floor(chunks / 50))) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIST, `search/d/${c}.bin`))));
    for (const [, title, , , , , soldOut] of rows) {
      const key = releaseKey(title);
      const words = title.split(/\s+/).length;
      if (soldOut || !key || keys.has(key) || words < 3 || words > 12 || !(nowRow(key)?.[0] > 0)) continue;
      keys.add(key);
      wants.push({ id: 900000 + wants.length, key, title });
      if (wants.length >= count) break;
    }
  }
  if (wants.length < count) throw new Error(`only ${wants.length} records in stock found in dist/: build the site with data first`);
  return wants;
}

/** The body of api.discogs.com/users/<user>/wants, one page. */
export const discogsPage = (wants) => ({
  pagination: { page: 1, pages: 1, per_page: 100, items: wants.length },
  wants: wants.map((w) => ({ id: w.id, rating: 0, basic_information: { id: w.id, title: w.title, artists: [], labels: [], thumb: '' } })),
});
