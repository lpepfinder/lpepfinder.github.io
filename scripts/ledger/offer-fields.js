import { addDays } from './day.js';

/**
 * What the ledger adds to one search doc (null when unknown):
 *   firstSeen   "YYYY-MM-DD" day the offer was first seen
 *   wasPrice    cents before the last price change, when that change was a drop in the last `priceDropDays` days,
 *               of at most `maxDrop` (a share of the old price: a bigger "drop" is a pricing error, £2,299 → £16.99)
 *   lowPrice90  lowest price (cents) of the last `lowPriceDays` days, only when lower than the doc's price
 * Prices only when the ledger row has the doc's price and currency: otherwise they are about another listing.
 */
export function offerFields(row, doc, currency, day, { priceDropDays = 14, maxDrop = 0.7 } = {}) {
  const fields = { firstSeen: row?.firstSeen || null, wasPrice: null, lowPrice90: null };
  if (!row || doc.price == null || row.price !== doc.price || row.currency !== currency) return fields;
  const log = row.priceLog || [];
  if (log.length >= 2) {
    const [[, before], [changed, now]] = log.slice(-2);
    if (now < before && (before - now) / before <= maxDrop && changed > addDays(day, -priceDropDays)) fields.wasPrice = before;
  }
  if (row.lowPrice90 != null && row.lowPrice90 < doc.price) fields.lowPrice90 = row.lowPrice90;
  return fields;
}
