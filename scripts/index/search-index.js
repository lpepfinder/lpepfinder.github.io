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
 *   search/d/<n>.json         docs chunk: [[shop, title, priceCents, path, image], ...]
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
    for (const t of tokenize(`${d.title} ${d.vendor || ''}`)) {
      let list = postings.get(t);
      if (!list) postings.set(t, (list = []));
      list.push(i);
    }
  }
  for (let c = 0; c * docsPerChunk < docs.length; c++) {
    const rows = docs.slice(c * docsPerChunk, (c + 1) * docsPerChunk)
      .map((d) => [shopIndex.get(d.shop), d.title, d.price, d.path, d.image || 0, d.currency !== shopRows[shopIndex.get(d.shop)][4] ? d.currency : 0]);
    writeStatic(path.join(outDir, 'd', `${c}.json`), JSON.stringify(rows));
  }

  const maxDf = Math.max(1000, docs.length * maxDocFrequency);
  const shards = new Map();
  let dropped = 0;
  for (const [token, ids] of postings) {
    if (ids.length > maxDf) { dropped++; continue; }
    const key = shardFile(shardKey(token));
    if (!shards.has(key)) shards.set(key, {});
    let prev = 0;
    shards.get(key)[token] = ids.map((id) => { const d = id - prev; prev = id; return d.toString(36); }).join('.');
  }
  for (const [key, obj] of shards) writeStatic(path.join(outDir, 'i', `${key}.json`), JSON.stringify(obj));

  const meta = { docs: docs.length, shops: shopRows.length, docsPerChunk, tokens: postings.size - dropped, shards: shards.size, builtAt: new Date().toISOString() };
  writeStatic(path.join(outDir, 'meta.json'), JSON.stringify(meta));
  return meta;
}
