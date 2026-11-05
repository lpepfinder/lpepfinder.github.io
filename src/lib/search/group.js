import { releaseKey } from './release-key.js';
import { detectFormat } from './format.js';

/**
 * Search results grouped by release: every copy of one record (same release key) across shops
 * is one group. Records without a key stay alone. Groups keep the order they first appeared
 * in, which is the rank order (diversified by shop) of the client.
 */

/** Add loaded records to `groups` (Map key → { key, watchKey, offers }); returns the new groups and the ones that grew. */
export function addToGroups(groups, records) {
  const added = [];
  const grown = new Set();
  for (const r of records) {
    const watchKey = releaseKey(r.title);
    const key = watchKey || `url:${r.url}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, watchKey, offers: [] };
      groups.set(key, g);
      added.push(g);
    } else if (!added.includes(g)) grown.add(g);
    g.offers.push({ ...r, ...detectFormat(r.title) });
  }
  return { added, grown: [...grown] };
}

/**
 * Order of the copies: in stock first; then, with `near`, the viewer's country; then the cheapest
 * (value: comparable price); the viewer's country breaks ties.
 */
export function sortOffers(offers, { country = null, near = false, value }) {
  const local = (o) => Number(!!country && o.shop.country === country);
  return [...offers].sort((a, b) => (b.available - a.available)
    || (near ? local(b) - local(a) : 0)
    || value(a) - value(b)
    || local(b) - local(a));
}

/**
 * What one group shows with the current filters, or null when no copy is left.
 * filters: { inStock: bool, formats: Set of format ids (empty: all) }; sort: options of sortOffers.
 */
export function groupView(group, filters, sort) {
  let offers = group.offers;
  if (filters.inStock) offers = offers.filter((o) => o.available);
  if (filters.formats?.size) offers = offers.filter((o) => filters.formats.has(o.format));
  if (!offers.length) return null;
  offers = sortOffers(offers, sort);
  const inStock = offers.filter((o) => o.available);
  const pool = inStock.length ? inStock : offers;
  const cheapest = pool.reduce((a, b) => (sort.value(b) < sort.value(a) ? b : a));
  return {
    offers,
    cheapest,
    inStock: inStock.length,
    soldOut: offers.length - inStock.length,
    shops: new Set(offers.map((o) => o.shop.id)).size,
    formats: [...new Set(offers.map((o) => o.format).filter(Boolean))],
    local: inStock.some((o) => sort.country && o.shop.country === sort.country),
  };
}

/** Groups in rank order; with `near`, those with a copy in stock in the viewer's country first. */
export const orderGroups = (views, near) => (near ? [...views.filter((v) => v.local), ...views.filter((v) => !v.local)] : views);

/** Totals for the count line: records (groups), copies and shops of what is shown. */
export function totals(views) {
  const shops = new Set();
  let copies = 0;
  for (const v of views) {
    copies += v.offers.length;
    for (const o of v.offers) shops.add(o.shop.id);
  }
  return { records: views.length, copies, shops: shops.size };
}
