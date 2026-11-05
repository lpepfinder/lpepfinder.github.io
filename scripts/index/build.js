import fs from 'node:fs';
import path from 'node:path';
import { files, GENERATED, PUBLIC } from '../lib/paths.js';
import { config } from '../lib/config.js';
import { writeJson } from '../lib/json.js';
import { loadCatalog, sortDocs } from './catalog.js';
import { buildSearchIndex } from './search-index.js';
import { buildSiteData } from './site-data.js';
import { today } from '../ledger/day.js';
import { updateLedger } from '../ledger/update.js';
import { ledgerDocs } from '../ledger/search-docs.js';

/** Crawl output -> offer ledger, static search index in public/search and data for the page builder. */
const outDir = path.join(PUBLIC, 'search');
fs.rmSync(outDir, { recursive: true, force: true });
if (!fs.existsSync(files.products)) {
  console.warn('no generated/products.ndjson.gz yet: building an empty index');
  fs.mkdirSync(GENERATED, { recursive: true });
  fs.writeFileSync(files.products, (await import('node:zlib')).gzipSync(''));
}
const t0 = Date.now();
// shop catalogs (products.ndjson.gz) plus other sources (products-discogs.ndjson.gz)
const productFiles = fs.readdirSync(GENERATED).filter((f) => /^products.*\.ndjson\.gz$/.test(f)).map((f) => path.join(GENERATED, f));
const catalog = await loadCatalog(productFiles);

// the ledger dates the crawl by UTC day (LEDGER_DATE overrides it) and gives sold-out records their history
const day = today();
const { ledger, events } = await updateLedger({ docs: catalog.docs, shops: catalog.shops, day, dir: GENERATED, settings: config.ledger });
const counts = events.reduce((a, e) => ({ ...a, [e[2]]: (a[e[2]] || 0) + 1 }), {});
console.log('ledger', day, ledger.rows.size, 'offers, events:', counts);
const docs = sortDocs([...catalog.docs, ...ledgerDocs(ledger, catalog.docs, catalog.shops, config.ledger)]);

const meta = buildSearchIndex({ ...catalog, docs, outDir, docsPerChunk: config.search.docsPerChunk });
const siteData = buildSiteData({ ...catalog, seo: config.seo });
writeJson(path.join(GENERATED, 'site-data.json'), siteData);
console.log('index built in', Math.round((Date.now() - t0) / 1000), 's', meta, 'artist pages:', siteData.artists.length);
