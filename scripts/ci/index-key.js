import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.js';
import { config } from '../lib/config.js';

/**
 * node scripts/ci/index-key.js: the version of the code that shapes the search index, watch files and Dig crates
 * (docs/ci.md). The index bundle in the "data" release records the key it was built with; Deploy rebuilds the
 * index only when the key of the code it deploys differs. Only what the index really depends on counts: the
 * modules `npm run index` imports (followed from ENTRY, so a crawler-only change doesn't count), the data files it
 * reads by path (DATA_FILES), and the config sections it uses. Crawl data, shops, rates and every other setting
 * change daily or don't touch the index: they don't count.
 */
export const ENTRY = 'scripts/index/build.js';
export const DATA_FILES = ['data/release-key.json', 'data/facets.json', 'data/regions.json', 'data/currencies.json'];
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/** The modules a script imports, itself included, following relative imports (JSON imports too). */
export function imports(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = fs.readFileSync(path.join(ROOT, entry), 'utf8');
  for (const m of text.matchAll(IMPORT)) {
    const next = path.normalize(path.join(path.dirname(entry), m[1] || m[2]));
    if (fs.existsSync(path.join(ROOT, next))) imports(next, seen);
  }
  return seen;
}
export const SECTIONS = ['products', 'search', 'ledger', 'quality', 'dig', 'newArrivals', 'seo'];
/**
 * Of these sections, only these settings shape the index; the others are read by the browser, the pages or the
 * crawlers, and changing them must not rebuild it. A `description` never counts.
 */
export const PICK = {
  products: ['include', 'exclude'],
  search: ['docsPerChunk', 'maxArtists'],
  newArrivals: ['days', 'pageItems', 'shopItems', 'feedItems'],
  seo: ['artistMinRecords', 'artistMinShops', 'artistMaxPages', 'artistMaxRecordsPerPage', 'shopLatestRecords'],
};
const section = (s) => {
  const { description, ...settings } = config[s];
  return PICK[s] ? Object.fromEntries(PICK[s].map((k) => [k, settings[k]])) : settings;
};

export function indexKey() {
  const hash = crypto.createHash('sha256');
  for (const f of [...new Set([...imports(ENTRY), ...DATA_FILES])].sort()) {
    hash.update(`${f}\0`).update(fs.readFileSync(path.join(ROOT, f))).update('\0');
  }
  hash.update(JSON.stringify(Object.fromEntries(SECTIONS.map((s) => [s, section(s)]))));
  return hash.digest('hex').slice(0, 16);
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(indexKey());
