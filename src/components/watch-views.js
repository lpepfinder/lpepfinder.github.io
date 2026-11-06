import { t, tn, formatDay, countryName } from './i18n.js';
import { el, attrs } from './dom.js';
import { change } from './watch-render.js';
import { price } from './price.js';
import { origin } from './release-parts.js';
import { hrefFor } from './selection.js';

/**
 * The views of the watch page, as DOM: changes by day, records in stock (hits.js) and shops
 * by how much of the list they have (baskets, hits.js).
 * shops: Map id → { name, origin, country, currency, shipsTo } (from /search/shops.json).
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

const recordHref = (search, it, key) => `${search}?q=${encodeURIComponent(it.t || '')}&r=${key}`;

/** Labels of a hit: new, only copy, the collector's Discogs rating. */
function badges(h, isNew) {
  const out = [];
  if (isNew) out.push(attrs(el('vf-badge', { textContent: t('watchPage.badgeNew') }), { kind: 'new' }));
  if (h.copies === 1) out.push(attrs(el('vf-badge', { textContent: t('watchPage.badgeOnly') }), { kind: 'rare' }));
  if (h.it.r) out.push(attrs(el('vf-badge', { textContent: '★'.repeat(h.it.r), title: t('watchPage.rating', { rating: h.it.r }) }), { kind: 'rating' }));
  return out;
}

/** Where the cheapest copy is: shop, its flag, "+ 3 more shops"; no customs is said in words. */
function where(h) {
  const { shop, reach } = h.best;
  const more = h.offers.length - 1;
  return el('p', {},
    shop?.origin ? el('a', { href: shop.origin, rel: 'nofollow', textContent: shop.name }) : (shop?.name || ''),
    shop ? ' ' : null, shop ? origin(shop.country) : null,
    more > 0 ? ` · ${tn('watchPage.moreShops', more)}` : '',
    reach === 'local' || reach === 'zone' ? ` · ${t('watchPage.noCustoms')}` : '');
}

/** One record in stock: title (its detail in the search: every copy, with links), cheapest price, where, badges. */
export function hitRow(h, { search, rates, newSince }) {
  const isNew = !!h.it.f && h.it.f >= newSince;
  return el('li', {}, attrs(el('vf-watch-hit', {},
    el('h3', {}, el('a', { href: recordHref(search, h.it, h.key), textContent: h.it.t || t('watchPage.unknownTitle', { key: h.key }) })),
    price(h.best.cents, h.best.currency, rates, { from: h.offers.length > 1 }),
    where(h),
    el('vf-badges', {}, ...badges(h, isNew)),
  ), { new: String(isNew), reach: h.best.reach }));
}

/** One shop of "By shop": a row linking to ?view=now&shop=<id>: name, flag, how many of your records, their total. */
export function shopRow(b, rates) {
  return el('li', {}, attrs(el('vf-watch-shop', {},
    el('a', { href: hrefFor(b.id, 'shop') },
      el('h3', { textContent: b.shop?.name || b.id }),
      origin(b.shop?.country),
      el('span', { textContent: tn('results.records', b.hits.length) }),
      price(b.cents, b.shop?.currency, rates))),
  { shop: b.id, reach: b.reach, count: b.hits.length }));
}

/** The shop's detail: name and place, "Visit shop", its records from your list (cheapest first) and their total. */
export function shopDetail(b, search, rates) {
  const sorted = [...b.hits].sort((x, y) => x.offer.value - y.offer.value);
  const place = [b.shop?.country && countryName(b.shop.country), tn('results.records', b.hits.length),
    b.reach === 'local' || b.reach === 'zone' ? t('watchPage.noCustoms') : b.reach === 'no' ? t('watchPage.noShipping') : null];
  return [
    el('hgroup', {},
      el('h2', { id: 'watch-shop-title', tabIndex: -1, textContent: b.shop?.name || b.id }),
      el('p', { textContent: place.filter(Boolean).join(' · ') })),
    b.shop?.origin ? el('p', {}, el('a', { href: b.shop.origin, rel: 'nofollow', textContent: t('watchPage.visitShop', { shop: b.shop.name }) })) : null,
    el('ul', {}, ...sorted.map((r) => el('li', {},
      el('a', { href: recordHref(search, r.it, r.key), textContent: r.it.t || r.key }),
      r.offer.cents != null ? price(r.offer.cents, r.offer.currency, rates) : null))),
    el('p', {}, el('strong', { textContent: t('watchPage.total') }), ' ', price(b.cents, b.shop?.currency, rates)),
  ].filter(Boolean);
}
