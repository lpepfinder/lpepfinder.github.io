import fs from 'node:fs';
import path from 'node:path';
import { addDays } from './day.js';
import { catnosIn, catShard, firstWordTag } from '../../src/lib/watch/catno.js';

/**
 * Static files for the browser watchlist (public/w/):
 *   now/<first 3 hex of releaseKey>.json  { releaseKey: [inStockCount, soldOutCount, minPriceCents, currency, shops?] }
 *                                         price of the cheapest offer in stock, else of the sold-out one seen last
 *                                         (no title or url: the browser keeps those when a record is watched);
 *                                         shops, when in stock: [shopIndex, priceCents, …] flat pairs, cheapest first,
 *                                         at most `watchShops` shops (index into shops.json)
 *   shops.json                            [shopId, …] for the shop indexes of the `now` files (same build)
 *   d/<YYYY-MM-DD>.json                   [[releaseKey, offerKey, event, priceCents, currency, title, url, shopId], ...]
 *                                         the last `watchDays` days of events (a browser away longer reads `now`)
 *   index.json                            { dates: ["YYYY-MM-DD", ...] oldest first, builtAt }
 *   cat/<first 2 chars>.json              { catno: ["releaseKey:tag", ...] } catalog numbers (src/lib/watch/catno.js) found
 *                                         in titles and SKUs of offers in stock; tag: 4 hex of the listing's first word,
 *                                         so the browser can check the match against a want's artist
 * An offer is in stock when the last crawl listed it as available; sold out when it is out of stock,
 * gone, or no longer crawled, for goneSearchDays after it was last seen (like the search index).
 */
export function summarize(ledger, shops, { goneSearchDays, watchShops = 12 }) {
  const { day } = ledger.meta;
  const from = addDays(day, -goneSearchDays);
  const byRelease = new Map();
  for (const row of ledger.rows.values()) {
    if (!row.releaseKey || row.lastSeen < from) continue;
    const shop = shops.get(row.shop);
    if (!shop || shop.disabled) continue;
    const inStock = row.status === 'in' && row.lastSeen === day;
    let r = byRelease.get(row.releaseKey);
    if (!r) byRelease.set(row.releaseKey, (r = { in: 0, out: 0, pick: null, pickIn: false, shops: new Map() }));
    if (inStock) {
      r.in++;
      const best = r.shops.get(row.shop);
      if (best === undefined || (row.price ?? Infinity) < (best ?? Infinity)) r.shops.set(row.shop, row.price ?? null);
      if (!r.pickIn || (row.price ?? Infinity) < (r.pick.price ?? Infinity)) Object.assign(r, { pick: row, pickIn: true });
    } else {
      r.out++;
      if (!r.pickIn && (!r.pick || latest(row, r.pick))) r.pick = row;
    }
  }
  const now = new Map();
  for (const [key, r] of byRelease) {
    const entry = [r.in, r.out, r.pick.price ?? null, r.pick.currency || null];
    if (r.shops.size) entry.push([...r.shops].sort((a, b) => (a[1] ?? Infinity) - (b[1] ?? Infinity)).slice(0, watchShops));
    now.set(key, entry);
  }
  return now;
}

const latest = (a, b) => a.lastSeen > b.lastSeen || (a.lastSeen === b.lastSeen && (a.lastInStock || '') > (b.lastInStock || ''));

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};

export function writeWatchFiles({ ledger, shops, outDir, settings, docs = [] }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const shards = new Map();
  const shopIds = [];
  const shopIndex = new Map();
  const indexOf = (id) => {
    if (!shopIndex.has(id)) shopIndex.set(id, shopIds.push(id) - 1);
    return shopIndex.get(id);
  };
  for (const [key, entry] of summarize(ledger, shops, settings)) {
    const value = entry.length > 4 ? [...entry.slice(0, 4), entry[4].flatMap(([id, price]) => [indexOf(id), price])] : entry;
    const shard = key.slice(0, 3);
    if (!shards.has(shard)) shards.set(shard, {});
    shards.get(shard)[key] = value;
  }
  for (const [shard, obj] of shards) write(path.join(outDir, 'now', `${shard}.json`), obj);
  write(path.join(outDir, 'shops.json'), shopIds);
  // releases without a key (too short titles) can't be watched
  const days = [...ledger.events].sort((a, b) => a.day.localeCompare(b.day)).slice(-(settings.watchDays || Infinity));
  for (const e of days) write(path.join(outDir, 'd', `${e.day}.json`), e.list.filter((x) => x[0]));
  write(path.join(outDir, 'index.json'), { dates: days.map((e) => e.day), builtAt: new Date().toISOString() });
  const catnos = writeCatalogNumbers(docs, path.join(outDir, 'cat'));
  return { catnos, releases: [...shards.values()].reduce((n, o) => n + Object.keys(o).length, 0), shards: shards.size, days: days.length };
}

/** cat/ files: catalog number -> release keys of offers in stock that carry it. Returns how many numbers. */
export function writeCatalogNumbers(docs, dir) {
  const byShard = new Map();
  let count = 0;
  for (const d of docs) {
    if (!d.releaseKey || d.available === false) continue;
    const tag = firstWordTag(d.title);
    if (!tag) continue;
    for (const c of catnosIn(`${d.title} ${d.extra || ''}`)) {
      const s = catShard(c);
      if (!byShard.has(s)) byShard.set(s, new Map());
      const shard = byShard.get(s);
      if (!shard.has(c)) { shard.set(c, new Set()); count++; }
      shard.get(c).add(`${d.releaseKey}:${tag}`);
    }
  }
  for (const [s, shard] of byShard) write(path.join(dir, `${s}.json`), Object.fromEntries([...shard].map(([c, v]) => [c, [...v]])));
  return count;
}
