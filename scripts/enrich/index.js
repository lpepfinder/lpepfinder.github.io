import fs from 'node:fs';
import path from 'node:path';
import { config } from '../lib/config.js';
import { readJson, writeJson } from '../lib/json.js';
import { DATA, GENERATED } from '../lib/paths.js';
import { getJson } from '../lib/http.js';
import { profile } from './artist.js';
import { count } from './http.js';
import { due } from './due.js';

/**
 * npm run enrich: artist profiles from open sources into generated/enrich/artists.json (docs/sources.md).
 * The artists come from generated/site-data.json when there is one (after npm run index), else from the live
 * site's /api/artists.json and each artist's JSON. At most config.enrich.artistsPerRun profiles per run, for at
 * most maxMinutes, saved as it goes: a run cut short keeps what it did. The Enrich workflow keeps the file in the
 * "data" release (enrich.json.gz) and Deploy builds the artist pages with it.
 */
// listings that aren't records (merch) never name an album
const opts = { ...config.enrich, exclude: new RegExp(`${config.products.exclude}|\\bpatch(es)?\\b`, 'i') };
export const OUT = path.join(GENERATED, 'enrich', 'artists.json');
const overrides = readJson(path.join(DATA, 'enrich', 'artists.json'), {});
const cache = readJson(OUT, { version: 1, artists: {} });

async function artists() {
  const local = path.join(GENERATED, 'site-data.json');
  if (fs.existsSync(local)) {
    return readJson(local).artists.map((a) => ({ slug: a.slug, name: a.name, listings: a.records.map((r) => r.title) }));
  }
  const api = await getJson(new URL('/api/artists.json', config.baseUrl).href);
  if (!api.ok) throw new Error(`artists: ${api.status || api.error}`);
  return api.data.artists.map((a) => ({ slug: a.slug, name: a.name, json: a.json }));
}

async function listings(a) {
  if (a.listings) return a.listings;
  const res = await getJson(a.json);
  return res.ok ? res.data.records.map((r) => r.title) : [];
}

const all = await artists();
// ENRICH_LIMIT: fewer for a trial run
const todo = due(all, cache.artists, overrides, opts).slice(0, Number(process.env.ENRICH_LIMIT) || opts.artistsPerRun);
const stop = Date.now() + opts.maxMinutes * 6e4;
const save = () => writeJson(OUT, { ...cache, updatedAt: new Date().toISOString() });
const tally = {};
console.log(`enrich: ${all.length} artists, ${todo.length} due`);
for (const [i, a] of todo.entries()) {
  if (Date.now() > stop) { console.log('enrich: time is up'); break; }
  try {
    const p = await profile({ name: a.name, listings: await listings(a) }, overrides[a.slug], opts);
    cache.artists[a.slug] = { ...p, ...(overrides[a.slug]?.mbid ? { override: overrides[a.slug].mbid } : {}) };
    tally[p.status] = (tally[p.status] || 0) + 1;
  } catch (e) {
    console.error(`enrich: ${a.slug}: ${e.message}`);
    tally.error = (tally.error || 0) + 1;
  }
  if (i % 25 === 24) save();
}
save();
console.log('enrich:', JSON.stringify(tally), 'requests:', JSON.stringify(Object.fromEntries(count)));
