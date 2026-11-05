import { addDays } from './day.js';
import { productUrl } from './keys.js';
import { detectFormat } from '../../src/lib/search/format.js';

/** Newest day first; inside a day shops take turns, so one shop's big upload doesn't fill the list. */
function interleave(items) {
  const byDay = new Map();
  for (const it of items) {
    if (!byDay.has(it.day)) byDay.set(it.day, new Map());
    const shops = byDay.get(it.day);
    if (!shops.has(it.shop)) shops.set(it.shop, []);
    shops.get(it.shop).push(it);
  }
  const out = [];
  for (const day of [...byDay.keys()].sort().reverse()) {
    const queues = [...byDay.get(day).values()].map((q) => q.sort((a, b) => a.title.localeCompare(b.title)));
    const max = Math.max(...queues.map((q) => q.length));
    for (let i = 0; i < max; i++) for (const q of queues) if (i < q.length) out.push(q[i]);
  }
  return out;
}

/** { count, items: [index, ...] } for one scope, the first `cap` items kept. */
const scope = (list, cap) => ({ count: list.length, items: list.slice(0, cap) });

function group(order, key, cap) {
  const groups = {};
  for (const i of order) {
    const k = key(i);
    if (k) (groups[k] ||= []).push(i);
  }
  return Object.fromEntries(Object.entries(groups).map(([k, list]) => [k, scope(list, cap)]));
}

/**
 * New arrivals for the pages and feeds (generated/new-arrivals.json): records with a `new` event in
 * the last `days` days that are still in stock today, newest first. Each item is stored once in `items`;
 * the scopes (all, countries, formats, byShop) give the total count and the indexes of the first items.
 */
export function buildNewArrivals({ ledger, docs, shops, settings }) {
  const { days, pageItems, shopItems, feedItems } = settings;
  const day = ledger.meta.day;
  const from = addDays(day, -(days - 1));
  const inStock = new Map(docs.filter((d) => d.available !== false).map((d) => [d.offerKey, d]));
  const seen = new Set();
  const found = [];
  for (const { day: when, list } of ledger.events) {
    if (when < from) continue;
    for (const [releaseKey, offerKey, event] of list) {
      const d = event === 'new' && !seen.has(offerKey) && inStock.get(offerKey);
      if (!d) continue;
      seen.add(offerKey);
      const shop = shops.get(d.shop);
      const { format, used } = detectFormat(d.title);
      found.push({
        day: when, offerKey, releaseKey, title: d.title, price: d.price ?? null, currency: d.currency || shop.state.currency || null,
        url: productUrl(shop, d.path), image: d.image || null, shop: d.shop,
        country: (shop.state.country || shop.country || '').toUpperCase() || null, format, used,
      });
    }
  }
  const items = interleave(found);
  const order = items.map((_, i) => i);
  const cap = Math.max(pageItems, feedItems);
  return compact({
    day, days, builtAt: new Date().toISOString(), total: items.length,
    shops: new Set(items.map((it) => it.shop)).size,
    items,
    all: scope(order, cap),
    countries: group(order, (i) => items[i].country, cap),
    formats: group(order, (i) => items[i].format, cap),
    byShop: group(order, (i) => items[i].shop, Math.max(shopItems, feedItems)),
  });
}

/** Only the items some scope shows, re-indexed: keeps the file small. */
function compact(data) {
  const keep = new Map();
  const remap = (s) => ({ count: s.count, items: s.items.map((i) => (keep.has(i) ? keep.get(i) : keep.set(i, keep.size).get(i))) });
  const out = {
    ...data,
    all: remap(data.all),
    countries: Object.fromEntries(Object.entries(data.countries).map(([k, s]) => [k, remap(s)])),
    formats: Object.fromEntries(Object.entries(data.formats).map(([k, s]) => [k, remap(s)])),
    byShop: Object.fromEntries(Object.entries(data.byShop).map(([k, s]) => [k, remap(s)])),
  };
  out.items = [...keep.keys()].map((i) => data.items[i]);
  return out;
}
