import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.js';
import { config } from '../lib/config.js';

/**
 * node scripts/ci/index-key.js: the version of the code that shapes the search index, watch files and Dig crates
 * (docs/ci.md). The index bundle in the "data" release records the key it was built with; Deploy rebuilds the
 * index only when the key of the code it deploys differs. Only what the index really depends on counts: its
 * scripts and the search code (not their tests), the data files it reads, and the config sections it uses.
 * Crawl data, shops, rates and every other setting change daily or don't touch the index: they don't count.
 */
export const INPUTS = [
  'scripts/index', 'scripts/ledger', 'scripts/quality', 'scripts/lib', 'scripts/platforms/filter.js',
  'src/lib/search', 'src/lib/watch/catno.js', 'src/lib/currency.js',
  'data/release-key.json', 'data/facets.json', 'data/regions.json', 'data/currencies.json',
];
export const SECTIONS = ['products', 'search', 'ledger', 'quality', 'dig', 'newArrivals', 'seo'];
/** Of these sections, only these settings shape the index (the others are read by the pages). */
export const PICK = { seo: ['artistMinRecords', 'artistMinShops', 'artistMaxPages', 'artistMaxRecordsPerPage', 'shopLatestRecords'] };
const section = (s) => (PICK[s] ? Object.fromEntries(PICK[s].map((k) => [k, config[s][k]])) : config[s]);

function files(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [p];
  return fs.readdirSync(abs).flatMap((f) => files(path.join(p, f)));
}

export function indexKey() {
  const hash = crypto.createHash('sha256');
  for (const f of INPUTS.flatMap(files).filter((f) => !f.endsWith('.test.js')).sort()) {
    hash.update(`${f}\0`).update(fs.readFileSync(path.join(ROOT, f))).update('\0');
  }
  hash.update(JSON.stringify(Object.fromEntries(SECTIONS.map((s) => [s, section(s)]))));
  return hash.digest('hex').slice(0, 16);
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(indexKey());
