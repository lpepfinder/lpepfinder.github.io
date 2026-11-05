import { ndjsonReader } from '../lib/json.js';
import { loadShops, loadState } from '../lib/shops.js';
import { displayTitle, cleanTitle, normalize } from '../lib/text.js';
import { detectFormat } from '../../src/lib/search/format.js';

// vinyl before CD and tape for the same title
const formatRank = (title) => {
  const f = detectFormat(title).format;
  return f === 'cd' || f === 'mc' ? 2 : f ? 0 : 1;
};

/**
 * Load crawled products and give them doc ids in title order ("Artist – Title"
 * first), so one artist's records share a few d/ chunks and a query loads
 * 1-4 chunks instead of one per result. Records in stock come first, sold-out
 * ones (available: false) after them, each part in title order.
 * Shop diversity is done by the client (src/lib/search/rank.js).
 * byShop keeps each shop's newest first; shopFiles lists the product files each shop's records came from.
 */
export async function loadCatalog(productFiles) {
  const state = loadState();
  const shops = new Map(loadShops().map((s) => [s.id, { ...s, state: state[s.id] || {} }]));
  const byShop = new Map();
  const shopFiles = new Map();
  for (const file of productFiles) {
    for await (const p of ndjsonReader(file)) {
      if (!shops.has(p.shop) || shops.get(p.shop).disabled || !p.title) continue;
      if (!byShop.has(p.shop)) { byShop.set(p.shop, []); shopFiles.set(p.shop, new Set()); }
      shopFiles.get(p.shop).add(file);
      byShop.get(p.shop).push({ ...p, title: displayTitle(cleanTitle(p.title), p.vendor), available: p.available !== false });
    }
  }
  for (const list of byShop.values()) list.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return { docs: sortDocs([...byShop.values()].flat()), shops, byShop, shopFiles };
}

/** Doc id order: in stock first, then sold out; each part in title order. */
export function sortDocs(docs) {
  return docs
    .map((d) => ({ d, key: normalize(d.title), rank: formatRank(d.title) }))
    .sort((a, b) => (b.d.available - a.d.available) || (a.key < b.key ? -1 : a.key > b.key ? 1 : a.rank - b.rank || a.d.shop.localeCompare(b.d.shop) || (a.d.price ?? 0) - (b.d.price ?? 0)))
    .map((x) => x.d);
}
