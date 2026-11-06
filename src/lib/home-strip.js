import { newArrivals } from './new-arrivals.js';

/**
 * Records for the home page's strip of covers: this week's new arrivals, or, when the week has
 * none yet, the latest records of the shops (one shop after the other, with covers first).
 * Returns { fresh: bool, count, records }.
 */
export function homeStrip(catalog, limit) {
  const week = newArrivals().all(limit);
  if (week.count) return { fresh: true, count: week.count, records: week.records };
  const lists = catalog.visible.map((s) => [...(s.latest || [])].sort((a, b) => !!b.image - !!a.image)).filter((l) => l.length);
  const records = [];
  for (let i = 0; records.length < limit && lists.some((l) => l[i]); i++) {
    for (const l of lists) if (l[i] && records.length < limit) records.push(l[i]);
  }
  return { fresh: false, count: records.length, records };
}
