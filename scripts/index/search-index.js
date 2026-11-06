import fs from 'node:fs';
import path from 'node:path';
import { tokenize, shardKey, shardFile, cleanShopName } from '../lib/text.js';

/** Write a static file. No .gz twin: GitHub Pages compresses responses itself. */
export function writeStatic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/**
 * Static inverted index:
 *   search/shops.json         [[id, name, origin, country, currency, lastCrawl, shipsTo, imagePrefix], ...]
 *                             (imagePrefix: start shared by the shop's image URLs, or 0; a row image starting with
 *                             "~" continues it. A row path starting with "~" is origin + "/products/" + the rest)
 *                             (lastCrawl: "YYYY-MM-DD" UTC day of the shop's last successful crawl, null when
 *                             unknown; shipsTo: ISO country codes the shop ships to, "*" for rest of world,
 *                             [] when unknown. Both added later: older files have 5 fields)
 *   search/d/<n>.json         docs chunk: [[shop, title, priceCents, path, image, currency,
 *                               soldOut, lastInStock, firstSeen, wasPrice, lowPrice90], ...]
 *                             0 stands for an absent value, and trailing zeros after `currency` are left out,
 *                             so a row has 6 to 11 fields:
 *                             - soldOut      1 for sold-out records
 *                             - lastInStock  "YYYY-MM-DD" day a sold-out record was last seen in stock
 *                             - firstSeen    "YYYY-MM-DD" day the offer ledger first saw the offer
 *                             - wasPrice     cents before a price drop in the last ledger.priceDropDays (14) days
 *                             - lowPrice90   lowest price (cents) in the last 90 days, only when lower than priceCents
 *                             (firstSeen, wasPrice and lowPrice90 were added later; see scripts/ledger/offer-fields.js)
 *   search/i/<shard>.json     { token: "base36 id deltas joined by ." }
 *   search/meta.json          counts and settings the browser needs
 *   search/artists.json       [[slug, name, recordCount], ...] top artist pages, written by build.js (site-data.js)
 */
export function buildSearchIndex({ docs, shops, outDir, docsPerChunk, maxDocFrequency = 0.2, lastCrawl = {} }) {
  const shopIds = [...new Set(docs.map((d) => d.shop))];
  const shopIndex = new Map(shopIds.map((id, i) => [id, i]));
  const shopRows = shopIds.map((id) => {
    const s = shops.get(id);
    const origin = new URL(s.state.url || s.url).origin;
    return [
      id, s.name || cleanShopName(s.state.name || '') || id, origin, s.state.country || s.country || null, s.state.currency || null,
      lastCrawl[id] || null, s.shipsTo || s.state.shipsTo || [], imagePrefix(docs, id),
    ];
  });
  writeStatic(path.join(outDir, 'shops.json'), JSON.stringify(shopRows));

  const postings = new Map();
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    for (const t of tokenize(`${d.title} ${d.vendor || ''} ${d.extra || ''}`)) {
      let list = postings.get(t);
      if (!list) postings.set(t, (list = []));
      list.push(i);
    }
  }
  for (let c = 0; c * docsPerChunk < docs.length; c++) {
    const rows = docs.slice(c * docsPerChunk, (c + 1) * docsPerChunk).map((d) => docRow(d, shopIndex.get(d.shop), shopRows));
    writeStatic(path.join(outDir, 'd', `${c}.json`), JSON.stringify(rows));
  }

  const maxDf = Math.max(1000, docs.length * maxDocFrequency);
  const shards = new Map();
  // words in more than 20% of records carry no meaning; the client skips them in queries
  const common = [];
  for (const [token, ids] of postings) {
    if (ids.length > maxDf) { common.push(token); continue; }
    const key = shardFile(shardKey(token));
    if (!shards.has(key)) shards.set(key, {});
    let prev = 0;
    shards.get(key)[token] = ids.map((id) => { const d = id - prev; prev = id; return d.toString(36); }).join('.');
  }
  for (const [key, obj] of shards) writeStatic(path.join(outDir, 'i', `${key}.json`), JSON.stringify(obj));

  // docs are sorted in stock first: ids from soldOutFrom on are sold out
  const soldOutFrom = docs.findIndex((d) => d.available === false);
  const meta = { docs: docs.length, soldOutFrom: soldOutFrom < 0 ? docs.length : soldOutFrom, shops: shopRows.length, docsPerChunk, tokens: postings.size - common.length, common, shards: shards.size, builtAt: new Date().toISOString() };
  writeStatic(path.join(outDir, 'meta.json'), JSON.stringify(meta));
  return meta;
}

const FIXED_FIELDS = 6;

/** Longest start shared by a shop's image URLs (cut at a "/"), so rows store only the end. */
function imagePrefix(docs, shopId) {
  let prefix = null;
  for (const d of docs) {
    if (d.shop !== shopId || !d.image) continue;
    if (prefix === null) { prefix = d.image; continue; }
    let i = 0;
    while (i < prefix.length && prefix[i] === d.image[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix.length < 16) return 0;
  }
  if (!prefix) return 0;
  const cut = prefix.slice(0, prefix.lastIndexOf('/') + 1);
  return cut.length >= 16 ? cut : 0;
}

const compactPath = (p) => (p?.startsWith('/products/') ? '~' + p.slice(10) : p);
const compactImage = (img, prefix) => (img && prefix && img.startsWith(prefix) ? '~' + img.slice(prefix.length) : img || 0);

/** One d/ row (see buildSearchIndex): absent values are 0, trailing ones after the fixed fields left out. */
export function docRow(d, shopIdx, shopRows) {
  const soldOut = d.available === false;
  const row = [
    shopIdx, d.title, d.price, compactPath(d.path), soldOut ? 0 : compactImage(d.image, shopRows[shopIdx][7]), d.currency !== shopRows[shopIdx][4] ? d.currency : 0,
    soldOut ? 1 : 0, (soldOut && d.lastInStock) || 0, d.firstSeen || 0, d.wasPrice || 0, d.lowPrice90 || 0,
  ];
  let end = row.length;
  while (end > FIXED_FIELDS && row[end - 1] === 0) end--;
  return row.slice(0, end);
}
