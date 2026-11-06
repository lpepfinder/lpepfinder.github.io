import { t, tn, formatDay, countryName } from './i18n.js';
import { region } from './viewer.js';
import { el, attrs } from './dom.js';
import { change } from './watch-render.js';
import { price } from './price.js';
import { origin } from './release-parts.js';
import { hrefFor } from './selection.js';

/**
 * The Changes and Available now views of the watch page, as DOM.
 * shops: Map id → { name, origin, country, currency } (from /search/shops.json).
 */

/** Changes grouped by day, newest first: a <section> with an H3 per day; unseen changes are not marked seen. */
export function changesByDay({ changes, past }, shops, rates) {
  const rows = [...changes.map((c) => [c, false]), ...past.map((c) => [c, true])]
    .sort((a, b) => (b[0][8] || '').localeCompare(a[0][8] || ''));
  const days = new Map();
  for (const [c, seen] of rows) {
    const d = (c[8] || '').slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(change(c, shops, seen, 'h4', rates));
  }
  return [...days].map(([d, items]) => el('section', {},
    el('h3', {}, el('time', { dateTime: d, textContent: d ? formatDay(d) : '' })),
    el('ol', {}, ...items)));
}

/**
 * Watched records in stock now, grouped by shop: [{ id, shop, records: [{ key, title, price }] }],
 * the viewer's country first, then by how many records match.
 * rows: { key: now entry with [shopIndex, cents, …] pairs }; shopIds: w/shops.json.
 */
export function byShop(items, rows, shopIds, shops) {
  const groups = new Map();
  for (const [key, row] of Object.entries(rows)) {
    const it = items[key];
    if (!it || !row[0] || !row[4]) continue;
    for (let i = 0; i < row[4].length; i += 2) {
      const id = shopIds[row[4][i]];
      if (!id) continue;
      if (!groups.has(id)) groups.set(id, { id, shop: shops.get(id) || { name: id }, records: [] });
      groups.get(id).records.push({ key, title: it.t || t('watchPage.unknownTitle', { key }), price: row[4][i + 1] });
    }
  }
  const local = (g) => Number(!!region && g.shop.country === region);
  return [...groups.values()].sort((a, b) => local(b) - local(a) || b.records.length - a.records.length);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** One shop of "Available now": a row linking to ?view=now&shop=<id> (name, flag, count), opening its detail. */
export function shopRow(g) {
  return el('li', {}, attrs(el('vf-watch-shop', {},
    el('a', { href: hrefFor(g.id, 'shop') },
      el('h3', { textContent: g.shop.name }),
      origin(g.shop.country),
      el('span', { textContent: tn('results.records', g.records.length) }))),
  { shop: g.id, country: g.shop.country || null, count: g.records.length, local: String(!!region && g.shop.country === region) }));
}

/** The shop's detail: name and place, "Visit shop", the watched records in stock there (A–Z, linking to their detail in the search). */
export function shopDetail(g, search, rates) {
  const sorted = [...g.records].sort((a, b) => collator.compare(a.title, b.title));
  return [
    el('hgroup', {},
      el('h2', { id: 'watch-shop-title', tabIndex: -1, textContent: g.shop.name }),
      el('p', { textContent: [g.shop.country && countryName(g.shop.country), tn('results.records', g.records.length)].filter(Boolean).join(' · ') })),
    g.shop.origin ? el('p', {}, el('a', { href: g.shop.origin, rel: 'nofollow', textContent: t('watchPage.visitShop', { shop: g.shop.name }) })) : null,
    el('ul', {}, ...sorted.map((r) => el('li', {},
      el('a', { href: `${search}?q=${encodeURIComponent(r.title)}&r=${r.key}`, textContent: r.title }),
      r.price != null ? price(r.price, g.shop.currency, rates) : null))),
  ].filter(Boolean);
}
