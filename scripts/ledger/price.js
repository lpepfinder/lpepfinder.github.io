import { addDays } from './day.js';

/**
 * Price of a row, with a short log of changes ([[day, cents], ...]) kept only while a change
 * is younger than `days`. lowPrice90 is the lowest price in that window.
 */
export function trackPrice(row, price, currency, day, days) {
  if (price == null) return;
  if (row.price == null || currency !== row.currency) {
    Object.assign(row, { price, currency, lowPrice90: price });
    delete row.priceLog;
    return;
  }
  if (price !== row.price) {
    row.priceLog = [...(row.priceLog || [[row.firstSeen, row.price]]), [day, price]];
    row.price = price;
  }
  trimPriceLog(row, day, days);
}

/** Forget the price of a row: today's price was found wrong (scripts/quality), so the old one is not trusted either. */
export function clearPrice(row) {
  Object.assign(row, { price: null, lowPrice90: null });
  delete row.priceLog;
}

/** Drop prices that ended before the window; the entry in effect at its start stays. */
export function trimPriceLog(row, day, days) {
  if (!row.priceLog) { row.lowPrice90 = row.price; return; }
  const from = addDays(day, -days);
  while (row.priceLog.length > 1 && row.priceLog[1][0] <= from) row.priceLog.shift();
  if (row.priceLog.length < 2) delete row.priceLog;
  row.lowPrice90 = row.priceLog ? Math.min(...row.priceLog.map((p) => p[1])) : row.price;
}
