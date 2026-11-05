import fs from 'node:fs';
import { crawlableShops } from '../lib/shops.js';
import { ndjsonWriter, ndjsonReader, writeJson } from '../lib/json.js';
import { files } from '../lib/paths.js';
import { pool, semaphore } from '../lib/pool.js';
import { config } from '../lib/config.js';
import { adapters } from '../platforms/index.js';

/**
 * Crawl every healthy Shopify/WooCommerce shop into generated/products.ndjson.gz.
 * Shops that fail this run keep their products from the previous run.
 */
const c = config.crawl;
const only = process.argv[2];
const shops = crawlableShops().filter((s) => !only || s.id.includes(only)).slice(0, Number(process.env.CRAWL_LIMIT) || undefined);
const limits = Object.fromEntries(Object.entries(c.platformConcurrency).map(([k, n]) => [k, semaphore(n)]));
const tmp = files.products + '.tmp';
const out = ndjsonWriter(tmp);
const report = {};
const started = Date.now();

async function crawlShop(shop) {
  const { platform, crawlDelay, currency, musicRatio = 1 } = shop.state;
  const t0 = Date.now();
  let count = 0;
  try {
    await limits[platform](async () => {
      const opts = {
        maxPages: c.maxPages[platform],
        maxRequests: c.maxRequestsPerShop,
        country: shop.state.country || shop.country || null,
        delayMs: Math.max(c.delayMs[platform] ?? 500, (crawlDelay || 0) * 1000),
        inStockOnly: c.inStockOnly,
        deadline: t0 + c.maxMinutesPerShop * 60_000,
        strict: musicRatio < config.products.strictBelowRatio,
      };
      for await (const p of adapters[platform].crawl({ ...shop, url: shop.state.url || shop.url }, opts)) {
        out.write({ shop: shop.id, ...p, currency: p.currency || currency || null });
        count++;
      }
    });
    report[shop.id] = { count, seconds: Math.round((Date.now() - t0) / 1000) };
  } catch (e) {
    report[shop.id] = { count, error: e.message, seconds: Math.round((Date.now() - t0) / 1000) };
  }
  console.log(shop.id, platform, count, report[shop.id].error || '', `${report[shop.id].seconds}s`);
}

await pool(shops, c.concurrency, crawlShop);

// shops rate-limited on their first page get one more, slower try at the end
const limited = shops.filter((s) => /_429$/.test(report[s.id]?.error || ''));
if (limited.length) {
  console.log(`retrying ${limited.length} rate-limited shops one at a time`);
  await pool(limited, c.retryPassConcurrency, crawlShop);
}

// carry over products of shops that failed now but worked before
const failed = new Set(Object.entries(report).filter(([, r]) => r.error && !r.count).map(([id]) => id));
if (fs.existsSync(files.products)) {
  for await (const p of ndjsonReader(files.products)) {
    if (failed.has(p.shop) || (only && !p.shop.includes(only))) { out.write(p); if (report[p.shop]) report[p.shop].carried = (report[p.shop].carried || 0) + 1; }
  }
}
await out.close();
fs.renameSync(tmp, files.products);
const total = Object.values(report).reduce((n, r) => n + r.count + (r.carried || 0), 0);
writeJson(files.crawlReport, { finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), total, shops: report }, true);
console.log(`crawl done: ${total} products from ${shops.length} shops in ${Math.round((Date.now() - started) / 60000)} min`);
