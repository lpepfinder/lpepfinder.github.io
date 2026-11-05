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
 *   search/shops.json         [[id, name, origin, country, currency], ...]
 *   search/d/<n>.json         docs chunk: [[shop, title, priceCents, path, image, currency, soldOut?, lastInStock?], ...]
 *                             (soldOut is 1 for sold-out records, left out when in stock; lastInStock
 *                             is the "YYYY-MM-DD" day a sold-out record was last seen in stock, when known)
 *   search/i/<shard>.json     { token: "base36 id deltas joined by ." }
 *   search/meta.json          counts and settings the browser needs
 */
export function buildSearchIndex({ docs, shops, outDir, docsPerChunk, maxDocFrequency = 0.2 }) {
  const shopIds = [...new Set(docs.map((d) => d.shop))];
  const shopIndex = new Map(shopIds.map((id, i) => [id, i]));
  const shopRows = shopIds.map((id) => {
    const s = shops.get(id);
    const origin = new URL(s.state.url || s.url).origin;
    return [id, s.name || cleanShopName(s.state.name || '') || id, origin, s.state.country || s.country || null, s.state.currency || null];
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
    const rows = docs.slice(c * docsPerChunk, (c + 1) * docsPerChunk)
      .map((d) => {
        const row = [shopIndex.get(d.shop), d.title, d.price, d.path, d.image || 0, d.currency !== shopRows[shopIndex.get(d.shop)][4] ? d.currency : 0];
        return d.available === false ? [...row, 1, ...(d.lastInStock ? [d.lastInStock] : [])] : row;
      });
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
