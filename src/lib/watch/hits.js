/**
 * "Available now" of the watchlist: each watched record in stock, with the shops that have it,
 * filtered and sorted the way a collector asks: what's new, cheapest, rarest, best rated.
 * Pure, shared by the page and the tests.
 *   items   watchlist items (store.js); rows: merged `now` entries per item key (wants.js)
 *   shopIds index -> shop id (w/shops.json); shops: Map id -> { name, country, currency, shipsTo }
 *   value(cents, currency) -> comparable cents (euro); reachOf(shop) -> reach.js value
 *   filters { ships: hide shops known not to ship, customs: same country or zone only, max: comparable cents }
 */
import { noCustoms } from './reach.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function hits({ items, rows, shopIds, shops, value, reachOf, filters = {} }) {
  const out = [];
  for (const [key, it] of Object.entries(items)) {
    const row = rows[key];
    if (!row?.[0]) continue;
    const pairs = row[4] || [];
    let offers = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const id = shopIds[pairs[i]];
      const shop = shops.get(id) || { name: id };
      const currency = shop.currency || row[3];
      offers.push({ id, shop, cents: pairs[i + 1], currency, value: value(pairs[i + 1], currency), reach: reachOf(shop) });
    }
    if (!offers.length) offers.push({ id: null, shop: null, cents: row[2], currency: row[3], value: value(row[2], row[3]), reach: 'unknown' });
    if (filters.ships) offers = offers.filter((o) => o.reach !== 'no');
    if (filters.customs) offers = offers.filter((o) => noCustoms(o.reach));
    if (it.m != null) offers = offers.filter((o) => o.value <= it.m);
    if (filters.max != null) offers = offers.filter((o) => o.value <= filters.max);
    if (!offers.length) continue;
    offers.sort((a, b) => a.value - b.value);
    out.push({ key, it, offers, best: offers[0], copies: row[0], found: it.f || it.a || '' });
  }
  return out;
}

const SORTS = {
  new: (a, b) => b.found.localeCompare(a.found) || a.best.value - b.best.value,
  price: (a, b) => a.best.value - b.best.value,
  'price-desc': (a, b) => b.best.value - a.best.value,
  rare: (a, b) => a.copies - b.copies || a.best.value - b.best.value,
  rating: (a, b) => (b.it.r || 0) - (a.it.r || 0) || a.best.value - b.best.value,
  title: (a, b) => collator.compare(a.it.t || '', b.it.t || ''),
};
export const SORT_NAMES = Object.keys(SORTS);

export const sortHits = (list, sort) => [...list].sort(SORTS[sort] || SORTS.new);

/**
 * Shops by how much of the list one order covers: [{ id, shop, reach, hits: [{ key, it, offer }], total }]
 * total: sum of comparable prices; most records first, then no customs fees, then cheapest.
 */
export function baskets(list) {
  const byShop = new Map();
  for (const h of list) {
    for (const o of h.offers) {
      if (!o.id) continue;
      if (!byShop.has(o.id)) byShop.set(o.id, { id: o.id, shop: o.shop, reach: o.reach, hits: [], total: 0, cents: 0 });
      const b = byShop.get(o.id);
      b.hits.push({ key: h.key, it: h.it, offer: o });
      b.total += o.value;
      b.cents += o.cents ?? 0;
    }
  }
  return [...byShop.values()].sort((a, b) => b.hits.length - a.hits.length || noCustoms(b.reach) - noCustoms(a.reach) || a.total - b.total);
}
