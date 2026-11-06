import { convert } from '../../src/lib/currency.js';

/**
 * Data-quality rules for catalog docs (pure: settings, rates and helpers come in as arguments).
 * Each reason has an action:
 *   exclude   the listing is not a record for sale: left out of search, Dig, watchlist and the ledger
 *   no-price  the listing is fine but its price is wrong: shown without a price, so it can't be the
 *             "cheapest" offer, a price drop or a low price
 * Conservative on purpose: only what is clearly wrong (thresholds in data/config.json "quality").
 */
export const REASONS = {
  'no-title': 'exclude',
  'test-listing': 'exclude',
  'not-record': 'exclude',
  'shop-price-low': 'no-price',
  'shop-price-high': 'no-price',
  'price-low': 'no-price',
  'price-high': 'no-price',
};

/** Price in euros (a number), null without price, currency or rate. */
export const priceEur = (cents, currency, rates) => {
  const eur = convert(cents, currency, 'EUR', rates);
  return eur == null ? null : eur / 100;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * Shops whose prices look like another currency (a Japanese shop serving dollars labelled JPY: ¥19 for an LP):
 * median price in euros under shopMinMedianEur or over shopMaxMedianEur, with at least shopMinRecords priced docs.
 * currencyOf(doc): the doc's currency (its own or its shop's).
 * Returns Map shopId -> { shop, currency, records, medianEur, reason }.
 */
export function suspectShops(docs, { rates, settings, currencyOf }) {
  const byShop = new Map();
  for (const d of docs) {
    const eur = priceEur(d.price, currencyOf(d), rates);
    if (eur == null) continue;
    const s = byShop.get(d.shop) || byShop.set(d.shop, { prices: [], currencies: new Set() }).get(d.shop);
    s.prices.push(eur);
    s.currencies.add(currencyOf(d));
  }
  const suspect = new Map();
  for (const [shop, s] of byShop) {
    if (s.prices.length < settings.shopMinRecords) continue;
    const medianEur = Math.round(median(s.prices) * 100) / 100;
    const reason = medianEur < settings.shopMinMedianEur ? 'shop-price-low' : medianEur > settings.shopMaxMedianEur ? 'shop-price-high' : null;
    if (reason) suspect.set(shop, { shop, currency: [...s.currencies].join(','), records: s.prices.length, medianEur, reason });
  }
  return suspect;
}

/**
 * Reason a doc is flagged (a key of REASONS), or null when it is fine. Listing rules first, then prices.
 * ctx: { rates, settings, currency (the doc's), suspect (from suspectShops), testTitle (RegExp), isMusic(text) }
 */
export function checkDoc(doc, { rates, settings, currency, suspect, testTitle, isMusic }) {
  const title = String(doc.title || '').trim();
  if (!title) return 'no-title';
  if (testTitle.test(title)) return 'test-listing';
  if (!isMusic(`${title} ${doc.type || ''}`)) return 'not-record';
  if (doc.price == null) return null;
  if (suspect.has(doc.shop)) return suspect.get(doc.shop).reason;
  const eur = priceEur(doc.price, currency, rates);
  if (eur == null) return null;
  if (eur < settings.minEur) return 'price-low';
  if (eur > settings.maxEur) return 'price-high';
  return null;
}
