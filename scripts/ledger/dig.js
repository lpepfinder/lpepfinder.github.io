import { addDays } from './day.js';
import { productUrl } from './keys.js';
import { interleave } from './new-arrivals.js';
import { detectFormat } from '../../src/lib/search/format.js';

export const CRATES = ['new', 'restock', 'drop'];

/**
 * The Dig crates for the browser (public/dig.json), records still in stock today:
 *   new      new arrivals (new-arrivals.js: the ledger's new events and the shops' own dates)
 *   restock  back in stock in the last `days` days (ledger events)
 *   drop     cheaper by at least `dropMin` after a recent drop (wasPrice of the ledger), biggest drop first
 * Each crate newest first with shops taking turns, at most `perCrate` records:
 *   { day, builtAt, shops: [[id, name, country, shipsTo]], items: [[crate, day, title, cents, currency, url, image,
 *     shopIndex, format, wasCents]] } (format: "" when unknown, wasCents: 0 unless a drop)
 * docs: today's catalog docs with offerKey and the ledger's wasPrice (search-docs.js); arrivals: new-arrivals.json.
 */
export function buildDig({ ledger, docs, shops, arrivals, settings }) {
  const { days, perCrate, dropMin } = settings;
  const day = ledger.meta.day;
  const from = addDays(day, -(days - 1));
  const inStock = new Map(docs.filter((d) => d.available !== false && d.price != null).map((d) => [d.offerKey, d]));
  const shopRows = [];
  const shopIndex = new Map();
  const indexOf = (id) => {
    if (!shopIndex.has(id)) {
      const s = shops.get(id);
      shopIndex.set(id, shopRows.push([id, s.name || s.state?.name || id, (s.state?.country || s.country || '').toUpperCase() || null, s.shipsTo || s.state?.shipsTo || []]) - 1);
    }
    return shopIndex.get(id);
  };
  const row = (crate, when, d, was = 0) => {
    const shop = shops.get(d.shop);
    return [crate, when, d.title, d.price, d.currency || shop.state?.currency || null, productUrl(shop, d.path), d.image || null,
      indexOf(d.shop), detectFormat(d.title).format || '', was];
  };
  const crate = (list) => interleave(list).slice(0, perCrate);

  const fresh = crate(arrivals.items.map((a) => inStock.get(a.offerKey) && { day: a.day, shop: a.shop, title: a.title, d: inStock.get(a.offerKey) }).filter(Boolean));
  const seen = new Set();
  const back = [];
  for (const { day: when, list } of ledger.events) {
    if (when < from) continue;
    for (const [, offerKey, event] of list) {
      const d = event === 'restock' && !seen.has(offerKey) && inStock.get(offerKey);
      if (d) { seen.add(offerKey); back.push({ day: when, shop: d.shop, title: d.title, d }); }
    }
  }
  const drops = [...inStock.values()]
    .filter((d) => d.wasPrice && (d.wasPrice - d.price) / d.wasPrice >= dropMin)
    .sort((a, b) => (b.wasPrice - b.price) / b.wasPrice - (a.wasPrice - a.price) / a.wasPrice)
    // one "day" for all: shops take turns, the biggest drops of each shop first
    .map((d, i) => ({ day: day, shop: d.shop, title: String(i).padStart(8, '0'), d }));
  const items = [
    ...fresh.map((x) => row('new', x.day, x.d)),
    ...crate(back).map((x) => row('restock', x.day, x.d)),
    ...crate(drops).map((x) => row('drop', day, x.d, x.d.wasPrice)),
  ];
  return { day, builtAt: new Date().toISOString(), shops: shopRows, items };
}
