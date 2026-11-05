/**
 * Changes for watched releases, from the data files built daily:
 *   /w/d/<date>.json  [[releaseKey, offerKey, event, priceCents, currency, title, url, shopId], …]
 *   /w/now/<xxx>.json { releaseKey: [inStock, soldOut, minCents, currency, title, url] }
 * A change is an event row with its date appended.
 */

const nextDay = (d) => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);

/** Day from which events must be read for an item: after it was added, and after the last check. */
export const since = (item, last) => (last && last > item.a ? last : item.a);

/**
 * Which watched keys the daily files cover (events after their start day), and which
 * need a `now` shard: no state yet (the first time), or a gap longer than the files kept.
 */
export function plan(items, last, dates) {
  const first = dates[0];
  const events = new Map();
  const shards = [];
  for (const [key, item] of Object.entries(items)) {
    const from = since(item, last);
    const gap = !first || nextDay(from) < first;
    if (gap || !item.s) shards.push(key);
    if (!gap) events.set(key, from);
  }
  const from = Math.min(...[...events.values()].map(Date.parse));
  return { events, shards, dates: dates.filter((d) => Date.parse(d) > from) };
}

/** Event rows of one day that concern watched keys still to read on that day. */
export const fromEvents = (rows, date, events) =>
  (rows || []).filter((r) => events.has(r[0]) && date > events.get(r[0])).map((r) => [...r.slice(0, 8), date]);

/** One change per release from two states (after a long absence). */
export function fromState(key, old, now, date) {
  if (!old || !now) return null;
  const [inStock, , min, currency, title, url] = now;
  const event = !old[0] && inStock ? 'restock'
    : old[0] && !inStock ? 'soldout'
    : inStock && min != null && old[2] != null && min < old[2] ? 'price-down' : null;
  return event && [key, null, event, min, currency, title, url, null, date];
}

/** [inStock, soldOut, minCents, currency] kept with the item. */
export const state = (row) => (row ? row.slice(0, 4) : [0, 0, null, null]);
