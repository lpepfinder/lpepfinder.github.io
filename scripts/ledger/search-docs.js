import { addDays } from './day.js';
import { offerFields } from './offer-fields.js';

/**
 * What the ledger adds to the search index:
 * - lastInStock on today's sold-out docs (when the ledger saw them in stock)
 * - firstSeen, wasPrice and lowPrice90 on every doc it knows (offer-fields.js)
 * - gone offers (removed from the shop) as sold-out docs, for goneSearchDays after they were last seen
 * Returns the extra docs; today's docs get their fields set in place.
 */
export function ledgerDocs(ledger, docs, shops, settings) {
  const day = ledger.meta.day;
  for (const d of docs) {
    const row = ledger.rows.get(d.offerKey);
    if (!row) continue;
    if (d.available === false && row.lastInStock) d.lastInStock = row.lastInStock;
    Object.assign(d, offerFields(row, d, d.currency || shops.get(d.shop)?.state?.currency || null, day, settings));
  }
  const from = addDays(day, -settings.goneSearchDays);
  const gone = [];
  for (const row of ledger.rows.values()) {
    if (row.status !== 'gone' || row.lastSeen < from) continue;
    const shop = shops.get(row.shop);
    if (!shop || shop.disabled) continue;
    const doc = {
      shop: row.shop, title: row.title, vendor: null, price: row.price, currency: row.currency, path: row.path,
      image: null, available: false, lastInStock: row.lastInStock, offerKey: row.offerKey, releaseKey: row.releaseKey,
    };
    gone.push(Object.assign(doc, offerFields(row, doc, row.currency, day, settings)));
  }
  return gone;
}
