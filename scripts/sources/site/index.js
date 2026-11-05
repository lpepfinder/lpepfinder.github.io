import fs from 'node:fs';
import { pool } from '../../lib/pool.js';
import { ndjsonWriter, writeJson } from '../../lib/json.js';
import { site } from './settings.js';
import { targetShops } from './targets.js';
import { loadSiteState, saveSiteState, shopState, stateFile, outputFile, reportFile } from './store.js';
import { runShop } from './run-shop.js';
import { liveRecords } from './crawler.js';
import { outputRecord } from './record.js';
import { seedFromCommonCrawl } from './commoncrawl.js';

/**
 * Site crawler: records of independent shops without a catalog API, read from their own
 * pages (or public catalog JSON). One shard of the shops per run (SITE_SHARD of SITE_SHARDS),
 * each with its own state and output file, so CI shards never touch each other's data.
 *   env: SITE_SHARD, SITE_SHARDS, SITE_SHOPS (comma-separated ids), SITE_PAGES, SITE_MINUTES
 */
const DAY = 864e5;
const started = Date.now();
const now = new Date(started).toISOString();
const shards = Number(process.env.SITE_SHARDS) || site.shards;
const shard = Number(process.env.SITE_SHARD) || 0;
const only = (process.env.SITE_SHOPS || '').split(',').map((s) => s.trim()).filter(Boolean);
const deadline = started + (Number(process.env.SITE_MINUTES) || site.maxMinutes) * 60_000;
const STATE = stateFile(shard);
const OUT = outputFile(shard);

const state = loadSiteState(STATE);
const shops = targetShops({ shard, shards, only });
const ids = new Set(shops.map((s) => s.id));
if (!only.length) for (const id of Object.keys(state.shops)) if (!ids.has(id)) delete state.shops[id];
console.log(`site shard ${shard}/${shards}: ${shops.length} shops`);

const save = () => saveSiteState(state, STATE);
let lastSave = Date.now();

// Common Crawl seeds, monthly per shop (and at once for new shops)
const ccDue = shops.filter((s) => Date.now() - Date.parse(state.shops[s.id]?.ccAt || 0) > site.commonCrawl.refreshDays * DAY);
if (site.commonCrawl.enabled && ccDue.length) {
  try {
    const result = await seedFromCommonCrawl(
      ccDue.map((s) => ({ id: s.id, origin: new URL(s.state.url).origin, st: shopState(state, s.id) })),
      { deadline: Math.min(deadline, started + site.commonCrawl.maxMinutes * 60_000) },
    );
    const total = Object.values(result.shops).reduce((a, b) => a + b, 0);
    console.log(`commoncrawl: ${total} new URLs for ${Object.keys(result.shops).length} shops from ${result.crawls.join(', ')} in ${result.seconds}s`, only.length ? JSON.stringify(result.shops) : '');
    save();
  } catch (e) {
    console.log(`commoncrawl: failed, crawling without it (${e.message})`);
  }
}

// least recently run first, so a run cut short by the deadline is made up for tomorrow
const order = [...shops].sort((a, b) => (state.shops[a.id]?.lastRunAt || '').localeCompare(state.shops[b.id]?.lastRunAt || ''));
const report = {};
await pool(order, site.concurrency, async (shop) => {
  if (Date.now() > deadline) return;
  report[shop.id] = await runShop(shop, shopState(state, shop.id), { deadline, now });
  const r = report[shop.id];
  console.log(shop.id, r.method || r.skipped || '-', `${r.records} records`, `${r.requests ?? 0} req`, r.stopped || '', `${r.seconds ?? 0}s`);
  if (Date.now() - lastSave > site.checkpointMinutes * 60_000) { save(); lastSave = Date.now(); }
});

const out = ndjsonWriter(OUT + '.tmp');
let records = 0;
for (const shop of shops) {
  const st = state.shops[shop.id];
  if (!st) continue;
  const origin = new URL(shop.state.url).origin;
  for (const [url, entry] of liveRecords(st)) { out.write(outputRecord(shop.id, origin, url, entry)); records++; }
}
await out.close();
fs.renameSync(OUT + '.tmp', OUT);
save();
writeJson(reportFile(shard), { finishedAt: new Date().toISOString(), shard, shards, seconds: Math.round((Date.now() - started) / 1000), records, shops: report }, true);
console.log(`site shard ${shard} done: ${records} records from ${shops.length} shops in ${Math.round((Date.now() - started) / 60000)} min`);
