import { addDays } from './day.js';
import { trackPrice, trimPriceLog } from './price.js';

/**
 * The offer ledger: one row per offer (one shop's listing of one record).
 *   meta    { day, shops: { [shopId]: { crawls, lastCrawl } } }   crawls: distinct crawl-data days of the shop
 *   rows    Map offerKey -> { offerKey, releaseKey, shop, path, title, firstSeen, lastSeen, lastInStock,
 *           price, currency, lowPrice90, status: in|out|gone, discogsRelease?, priceLog? }
 *   events  [{ day, list: [[releaseKey, offerKey, event, priceCents, currency, title, url, shopId], ...] }]
 */
export const emptyLedger = () => ({ meta: { day: null, shops: {} }, rows: new Map(), events: [] });

/** Today's offers by key: a listing seen twice keeps the in-stock, then the cheaper one. */
function byKey(offers) {
  const map = new Map();
  for (const o of offers) {
    const had = map.get(o.offerKey);
    if (!had || (o.available && !had.available) || (o.available === had.available && (o.price ?? Infinity) < (had.price ?? Infinity))) map.set(o.offerKey, o);
  }
  return map;
}

const newRow = (o, day) => ({
  offerKey: o.offerKey, releaseKey: o.releaseKey, shop: o.shop, path: o.path, title: o.title,
  firstSeen: day, lastSeen: day, lastInStock: o.available ? day : null,
  price: o.price ?? null, currency: o.currency || null, lowPrice90: o.price ?? null,
  status: o.available ? 'in' : 'out',
  ...(o.discogsRelease ? { discogsRelease: o.discogsRelease } : {}),
});

/**
 * Apply one day's crawl to the ledger (in place) and return that day's events:
 *   new        first seen, in stock (not during a shop's first `newShopCrawls` crawls: days of crawl
 *              data, so a build that reruns on old data, e.g. a push before the daily crawl, doesn't count)
 *   restock    in stock again after sold out or gone
 *   soldout    was in stock, now listed as unavailable
 *   price-down in stock both days, cheaper today (same currency)
 *   gone       listing missing from a shop that was crawled today
 * Shops without any record today (not crawled, failed) keep their rows as they are.
 * offers: [{ offerKey, releaseKey, shop, path, title, price, currency, available, discogsRelease }]
 * urlOf(shopId, path): product URL for events.
 * crawlDays: Map shopId -> UTC day of the shop's crawl data (null: not freshly crawled, e.g. records carried
 * over after a failure). Shops missing from it count as crawled on `day`.
 */
export function applyDay(ledger, offers, day, { settings, urlOf, crawlDays = new Map() }) {
  const { rows, meta } = ledger;
  if (meta.day && meta.day >= day) throw new Error(`ledger is already at ${meta.day}; cannot apply ${day}`);
  const today = byKey(offers);
  const crawled = new Set([...today.values()].map((o) => o.shop));
  // crawl count per shop including today's data, counted once per crawl-data day
  const crawls = new Map([...crawled].map((id) => {
    const had = meta.shops[id] || { crawls: 0, lastCrawl: null };
    const on = crawlDays.has(id) ? crawlDays.get(id) : day;
    const fresh = on && (!had.lastCrawl || on > had.lastCrawl);
    return [id, fresh ? { crawls: had.crawls + 1, lastCrawl: on } : had];
  }));
  const events = [];
  const emit = (row, event) => events.push([row.releaseKey, row.offerKey, event, row.price, row.currency, row.title, urlOf(row.shop, row.path), row.shop]);

  for (const o of today.values()) {
    const row = rows.get(o.offerKey);
    if (!row) {
      const added = newRow(o, day);
      rows.set(o.offerKey, added);
      const guarded = crawls.get(o.shop).crawls <= settings.newShopCrawls;
      if (o.available && !guarded) emit(added, 'new');
      continue;
    }
    const was = row.status;
    const before = { price: row.price, currency: row.currency };
    Object.assign(row, { title: o.title, releaseKey: o.releaseKey, path: o.path, lastSeen: day, status: o.available ? 'in' : 'out' });
    if (o.discogsRelease) row.discogsRelease = o.discogsRelease;
    if (o.available) row.lastInStock = day;
    trackPrice(row, o.price ?? null, o.currency || null, day, settings.lowPriceDays);
    if (o.available && was !== 'in') emit(row, 'restock');
    else if (!o.available && was === 'in') emit(row, 'soldout');
    else if (o.available && before.price != null && row.price != null && before.currency === row.currency && row.price < before.price) emit(row, 'price-down');
  }

  const keepFrom = addDays(day, -settings.goneKeepDays);
  for (const [key, row] of rows) {
    if (today.has(key)) continue;
    if (row.lastSeen < keepFrom) { rows.delete(key); continue; }
    if (row.status !== 'gone' && crawled.has(row.shop)) {
      row.status = 'gone';
      emit(row, 'gone');
    }
    trimPriceLog(row, day, settings.lowPriceDays);
  }

  for (const [id, c] of crawls) meta.shops[id] = c;
  meta.day = day;
  const eventsFrom = addDays(day, -settings.eventDays);
  ledger.events = [{ day, list: events }, ...ledger.events.filter((e) => e.day > eventsFrom && e.day < day)];
  return events;
}
