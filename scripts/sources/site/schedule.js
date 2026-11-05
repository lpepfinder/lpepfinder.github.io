import { site } from './settings.js';

const DAY = 864e5;

/** Next due time `days` from now, spread ±15% so a shop's pages don't all fall due on one day. */
export const revisitDays = (days) => Date.now() + days * DAY * (0.85 + 0.3 * Math.random());

/**
 * How often to re-check a product page: every `revisit.productDays`, or slower when the
 * shop has more records than its daily budget can re-check in that time.
 */
export function productDays(ctx, records) {
  const perDay = Math.max(1, ctx.settings.pagesPerDay * site.productLaneShare);
  const days = Math.max(site.revisit.productDays, Math.ceil(records / perDay));
  ctx.st.productDays = days;
  return days;
}
