import { t, tn, formatDay, formatPrice, countryName } from './i18n.js';
import { region } from './viewer.js';
import { el, attrs } from './dom.js';
import { change } from './watch-render.js';

/**
 * The Changes and Available now views of the watch page, as DOM.
 * shops: Map id → { name, origin, country, currency } (from /search/shops.json).
 */

/** Changes grouped by day, newest first: a <section> with an H3 per day; unseen changes are not marked seen. */
export function changesByDay({ changes, past }, shops) {
  const rows = [...changes.map((c) => [c, false]), ...past.map((c) => [c, true])]
    .sort((a, b) => (b[0][8] || '').localeCompare(a[0][8] || ''));
  const days = new Map();
  for (const [c, seen] of rows) {
    const d = (c[8] || '').slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(change(c, shops, seen, 'h4'));
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

/** One shop: a <details> whose records are drawn the first time it opens (long lists stay cheap). */
export function shopGroup(g, search) {
  const where = [g.shop.name, g.shop.country && countryName(g.shop.country)].filter(Boolean).join(' · ');
  const list = el('ul');
  const details = el('details', {},
    el('summary', {}, el('h3', { textContent: where }), el('span', { textContent: tn('results.records', g.records.length) })),
    g.shop.origin ? el('p', {}, el('a', { href: g.shop.origin, rel: 'nofollow', textContent: t('watchPage.visitShop', { shop: g.shop.name }) })) : null,
    list);
  details.addEventListener('toggle', () => {
    if (!details.open || list.childElementCount) return;
    const sorted = [...g.records].sort((a, b) => collator.compare(a.title, b.title));
    list.append(...sorted.map((r) => el('li', {},
      el('a', { href: `${search}?q=${encodeURIComponent(r.title)}`, textContent: r.title }),
      r.price != null ? el('vf-price', {}, el('data', { value: r.price, textContent: formatPrice(r.price, g.shop.currency) })) : null)));
  });
  return attrs(el('vf-watch-shop', {}, details), { country: g.shop.country || null, count: g.records.length });
}
