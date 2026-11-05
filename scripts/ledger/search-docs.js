import { addDays } from './day.js';

/**
 * What the ledger adds to the search index:
 * - lastInStock on today's sold-out docs (when the ledger saw them in stock)
 * - gone offers (removed from the shop) as sold-out docs, for goneSearchDays after they were last seen
 * Returns the extra docs; today's docs get their lastInStock set in place.
 */
export function ledgerDocs(ledger, docs, shops, { goneSearchDays }) {
  for (const d of docs) {
    if (d.available !== false) continue;
    const row = ledger.rows.get(d.offerKey);
    if (row?.lastInStock) d.lastInStock = row.lastInStock;
  }
  const from = addDays(ledger.meta.day, -goneSearchDays);
  const gone = [];
  for (const row of ledger.rows.values()) {
    if (row.status !== 'gone' || row.lastSeen < from) continue;
    const shop = shops.get(row.shop);
    if (!shop || shop.disabled) continue;
    gone.push({
      shop: row.shop, title: row.title, vendor: null, price: row.price, currency: row.currency, path: row.path,
      image: null, available: false, lastInStock: row.lastInStock, offerKey: row.offerKey, releaseKey: row.releaseKey,
    });
  }
  return gone;
}
