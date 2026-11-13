import { t, tn, formatDay, countryName } from './i18n.js';
import { el, attrs } from './dom.js';
import { change } from './watch-render.js';
import { price } from './price.js';
import { origin } from './release-parts.js';
import { hrefFor } from './selection.js';
import { cover } from './cover.js';
import { splitTitle } from '../lib/search/title.js';
import { sourceBadges } from './watch-render.js';

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

/** Labels of a hit: new, only copy, where it comes from (Discogs, a radio), the collector's Discogs rating. */
function badges(h, isNew) {
  const out = [];
  if (isNew) out.push(attrs(el('vf-badge', { textContent: t('watchPage.badgeNew') }), { kind: 'new' }));
  if (h.copies === 1) out.push(attrs(el('vf-badge', { textContent: t('watchPage.badgeOnly') }), { kind: 'rare' }));
  out.push(...sourceBadges(h.it));
  if (h.it.r) out.push(attrs(el('vf-badge', { textContent: '★'.repeat(h.it.r), title: t('watchPage.rating', { rating: h.it.r }) }), { kind: 'rating' }));
  return out;
}

/** "Sorry State Records 🇺🇸 +11": where the cheapest copy is, and how many other shops have one. */
function where(h) {
  const { shop, reach } = h.best;
  const more = h.offers.length - 1;
  return [
    el('span', { textContent: shop?.name || '' }),
    shop?.country ? origin(shop.country) : null,
    more > 0 ? el('span', { textContent: tn('watchPage.moreShops', more) }) : null,
    reach === 'local' || reach === 'zone' ? el('span', { textContent: t('watchPage.noCustoms') }) : null,
  ];
}

/** The row's price: the converted figure; the shop's own price as its tooltip (like search rows). */
function rowPrice(h, rates) {
  const tag = price(h.best.cents, h.best.currency, rates, { from: h.offers.length > 1 });
  const small = tag.querySelector('small');
  if (small) { tag.title = small.textContent; small.remove(); }
  return tag;
}

/**
 * One record in stock, as a search result row (<vf-release>, release.css): cover, artist and title,
 * labels and where, cheapest price. It links to ?record=<key>, the copies in the detail pane.
 */
export function hitRow(h, { rates, newSince, index }) {
  const isNew = !!h.it.f && h.it.f >= newSince;
  const { artist, title } = splitTitle(h.it.t || t('watchPage.unknownTitle', { key: h.key }));
  return el('li', {}, attrs(el('vf-release', {},
    el('a', { href: hrefFor(h.key, 'record') },
      cover(h.it.i, index),
      el('vf-name', {}, artist && el('vf-artist', { textContent: artist }), artist && el('span', { textContent: ' – ' }), el('vf-title', { textContent: title })),
      el('vf-meta', {}, ...badges(h, isNew), ...where(h)),
      rowPrice(h, rates))),
  { release: h.key, stock: 'in', new: String(isNew), reach: h.best.reach }));
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
      el('a', { href: `?view=available&record=${r.key}`, textContent: r.it.t || r.key }),
      r.offer.cents != null ? price(r.offer.cents, r.offer.currency, rates) : null))),
    el('p', {}, el('strong', { textContent: t('watchPage.total') }), ' ', price(b.cents, b.shop?.currency, rates)),
  ].filter(Boolean);
}
