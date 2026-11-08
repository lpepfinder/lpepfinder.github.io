import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { readJson, writeJson } from '../lib/json.js';
import { files } from '../lib/paths.js';

/**
 * node scripts/crawl/merge.js <dir>: the catalog crawl's shards (products-crawl-<k>.ndjson.gz and
 * crawl-report-<k>.json in <dir>, one per runner, docs/ci.md) joined into generated/products.ndjson.gz and
 * generated/crawl-report.json, the files everything downstream reads. Gzip files are joined as they are (a
 * file of several gzip members reads as one). Refuses to write when a shard is missing, so a lost runner never
 * drops a quarter of the shops: the previous files stay.
 */
const dir = process.argv[2];
const shards = Number(process.env.CRAWL_SHARDS);
if (!dir || !shards) throw new Error('usage: CRAWL_SHARDS=<n> node scripts/crawl/merge.js <dir>');
const parts = [...Array(shards).keys()].map((k) => ({
  products: path.join(dir, `products-crawl-${k}.ndjson.gz`), report: path.join(dir, `crawl-report-${k}.json`),
}));
const missing = parts.flatMap((p) => [p.products, p.report]).filter((f) => !fs.existsSync(f));
if (missing.length) throw new Error(`missing shards, nothing merged: ${missing.join(', ')}`);

const tmp = `${files.products}.tmp`;
const out = fs.createWriteStream(tmp);
for (const p of parts) await pipeline(fs.createReadStream(p.products), out, { end: false });
await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
fs.renameSync(tmp, files.products);

const reports = parts.map((p) => readJson(p.report));
writeJson(files.crawlReport, {
  finishedAt: reports.map((r) => r.finishedAt).sort().pop(),
  seconds: Math.max(...reports.map((r) => r.seconds)),
  total: reports.reduce((n, r) => n + r.total, 0),
  shards,
  shops: Object.assign({}, ...reports.map((r) => r.shops)),
}, true);
const left = reports.reduce((n, r) => n + Object.values(r.shops).filter((s) => s.skipped).length, 0);
console.log(`merged ${shards} shards: ${reports.reduce((n, r) => n + r.total, 0)} products, ${left} shops left for the next run`);
