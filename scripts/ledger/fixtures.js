/** Test helpers for the ledger tests. */
import { applyDay, emptyLedger } from './diff.js';
import { offerKey } from './keys.js';

export const settings = { eventDays: 14, newShopCrawls: 2, lowPriceDays: 90, goneSearchDays: 90, goneKeepDays: 365 };
export const urlOf = (shop, p) => `https://${shop}${p}`;
export const offer = (shop, p, extra = {}) => ({
  offerKey: offerKey(shop, p), releaseKey: 'abcdef123456', shop, path: p, title: `Artist – ${p}`,
  price: 2000, currency: 'EUR', available: true, ...extra,
});
export const run = (ledger, offers, day) => applyDay(ledger, offers, day, { settings, urlOf });
/** "event:shop/path" of each event, sorted. */
export const kinds = (events) => events.map((e) => `${e[2]}:${e[7]}${e[6].slice(-3)}`).sort();

/** A ledger where shop "a.com" has had two crawls, so it is past the new-shop guard. */
export function settled(offers) {
  const ledger = emptyLedger();
  run(ledger, offers, '2026-11-01');
  run(ledger, offers, '2026-11-02');
  return ledger;
}
