import fs from 'node:fs';
import path from 'node:path';
import { addToGroups } from './search/group.js';
import { selectKey } from './search/select-key.js';
import { convert } from './currency.js';

/**
 * Build-time release groups for static pages (artist pages): the same grouping as the search
 * (one release key, every copy across shops), from catalog records. Groups come cheapest first.
 */
let rates;
const euroRates = () => (rates ??= (() => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'rates.json'), 'utf8')).rates || {}; } catch { return {}; }
})());

/** A catalog record in the shape of SearchClient.records(): what the browser's detail reads. */
export const clientRecord = (r, shopsById) => {
  const shop = shopsById.get(r.shop);
  return {
    title: r.title, price: r.price ?? null, image: r.image || null, available: r.available !== false, lastInStock: null,
    url: r.url, currency: r.currency || null, shop: { id: r.shop, name: shop?.name || r.shop, country: shop?.country || null },
  };
};

/** Comparable value of a copy: euro cents when a rate is known, else its own cents. */
export const value = (o) => (o.price == null ? Infinity : convert(o.price, o.currency, 'EUR', euroRates()) ?? o.price);

/** [{ key, group, cheapest, shops, formats }] of the records, cheapest release first. */
export function releaseGroups(records) {
  const groups = new Map();
  addToGroups(groups, records);
  return [...groups.values()].map((group) => {
    const offers = [...group.offers].sort((a, b) => value(a) - value(b));
    return {
      key: selectKey(group), group, offers, cheapest: offers[0],
      shops: new Set(offers.map((o) => o.shop.id)).size,
      inStock: offers.filter((o) => o.available).length,
      formats: [...new Set(offers.map((o) => o.format).filter(Boolean))],
    };
  }).sort((a, b) => value(a.cheapest) - value(b.cheapest));
}
