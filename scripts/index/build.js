import fs from 'node:fs';
import path from 'node:path';
import { files, DATA, GENERATED, PUBLIC } from '../lib/paths.js';
import { config } from '../lib/config.js';
import { readJson, writeJson } from '../lib/json.js';
import { loadCatalog, sortDocs } from './catalog.js';
import { buildSearchIndex, writeStatic } from './search-index.js';
import { buildSiteData, artistList } from './site-data.js';
import { today } from '../ledger/day.js';
import { updateLedger } from '../ledger/update.js';
import { crawlDays } from '../ledger/crawl-days.js';
import { ledgerDocs } from '../ledger/search-docs.js';
import { writeWatchFiles } from '../ledger/watch-files.js';
import { buildNewArrivals } from '../ledger/new-arrivals.js';

/**
 * Crawl output -> offer ledger, watchlist files in public/w, static search index in public/search,
 * and data for the page builder (site-data.json, new-arrivals.json).
 */
const outDir = path.join(PUBLIC, 'search');
fs.rmSync(outDir, { recursive: true, force: true });
if (!fs.existsSync(files.products)) {
  console.warn('no generated/products.ndjson.gz yet: building an empty index');
  fs.mkdirSync(GENERATED, { recursive: true });
  fs.writeFileSync(files.products, (await import('node:zlib')).gzipSync(''));
}
const t0 = Date.now();
// shop catalogs (products.ndjson.gz) plus other sources (products-site-<k>.ndjson.gz)
const productFiles = fs.readdirSync(GENERATED).filter((f) => /^products.*\.ndjson\.gz$/.test(f)).map((f) => path.join(GENERATED, f));
const catalog = await loadCatalog(productFiles);

// the ledger dates the crawl by UTC day (LEDGER_DATE overrides it) and gives sold-out records their history
const day = today();
const { ledger, events } = await updateLedger({ docs: catalog.docs, shops: catalog.shops, day, dir: GENERATED, settings: config.ledger, crawlDays: crawlDays(catalog.shopFiles) });
const counts = events.reduce((a, e) => ({ ...a, [e[2]]: (a[e[2]] || 0) + 1 }), {});
console.log('ledger', day, ledger.rows.size, 'offers, events:', counts);
console.log('watchlist files', writeWatchFiles({ ledger, shops: catalog.shops, outDir: path.join(PUBLIC, 'w'), settings: config.ledger }));
const arrivals = buildNewArrivals({ ledger, docs: catalog.docs, shops: catalog.shops, settings: config.newArrivals });
writeJson(path.join(GENERATED, 'new-arrivals.json'), arrivals);
console.log('new arrivals', arrivals.total, 'at', arrivals.shops, 'shops');
// sold-out records: only those the ledger saw in stock (recent sell-outs), so years-old sold-out
// catalogs don't fill the search index; they stay in the ledger
const extra = ledgerDocs(ledger, catalog.docs, catalog.shops, config.ledger);
const docs = sortDocs([...catalog.docs, ...extra].filter((d) => d.available !== false || d.lastInStock));

// each shop's last successful crawl day, kept by the ledger across runs
const lastCrawl = Object.fromEntries(Object.entries(ledger.meta.shops).map(([id, s]) => [id, s.lastCrawl]));
const meta = buildSearchIndex({ ...catalog, docs, outDir, docsPerChunk: config.search.docsPerChunk, lastCrawl });
// customs zones (CMS-editable) for the browser: same zone or import
writeJson(path.join(PUBLIC, 'regions.json'), readJson(path.join(DATA, 'regions.json')));
const siteData = buildSiteData({ ...catalog, seo: config.seo });
writeJson(path.join(GENERATED, 'site-data.json'), siteData);
writeStatic(path.join(outDir, 'artists.json'), JSON.stringify(artistList(siteData.artists, config.search.maxArtists)));
console.log('index built in', Math.round((Date.now() - t0) / 1000), 's', meta, 'artist pages:', siteData.artists.length);
