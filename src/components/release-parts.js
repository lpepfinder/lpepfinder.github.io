import { t, formatDay, countryName } from './i18n.js';
import { el, attrs } from './dom.js';
import { price } from './price.js';
import { region } from './viewer.js';
import { hash48 } from '../lib/search/release-key.js';
import './vf-watch.js';

/** Pieces shared by the release row (<vf-release>) and the release detail (<vf-detail>). */

/** The ?r= key of a group: its release key, or "u" + a hash of the URL of a single copy without one. */
export const selectKey = (group) => group.watchKey || `u${hash48(group.offers[0].url)}`;

/** "LP · Used · Near mint (NM)". */
export const kind = (o) => [o.format && t(`formats.${o.format}`), o.used && t('conditionUsed'),
  o.grade && `${t(`grades.${o.grade.id}`)} (${o.grade.code})`].filter(Boolean).join(' · ');

/** Regional indicator letters: "JP" → 🇯🇵. */
export const flag = (cc) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** <vf-origin country="JP" local="true">🇯🇵 <abbr title="Japan">JP</abbr></vf-origin>; local when it is the viewer's country. */
export function origin(cc) {
  if (!cc) return null;
  return attrs(el('vf-origin', { title: t('results.shipsFrom', { country: countryName(cc) }) },
    el('span', { ariaHidden: 'true', textContent: flag(cc) }), ' ',
    el('abbr', { title: countryName(cc), textContent: cc })), { country: cc, local: String(cc === region) });
}

/** "Sold out · last seen in stock <time>12 Oct</time>", with the date where the translation puts it. */
export function soldOut(o) {
  if (!o.lastInStock) return [t('soldOut')];
  const [before, after = ''] = t('lastInStock', { date: '\u0000' }).split('\u0000');
  return [`${t('soldOut')} · ${before}`, el('time', { dateTime: o.lastInStock, textContent: formatDay(o.lastInStock) }), after];
}

/** <p> of the parts that are set, joined by " · "; a part may be a list of nodes. */
export function line(...parts) {
  const p = el('p');
  parts.map((x) => [].concat(x).filter(Boolean)).filter((x) => x.length)
    .forEach((nodes, i) => p.append(...(i ? [' · '] : []), ...nodes));
  return p;
}

/**
 * One copy: the shop (the link out), where it ships from, format and condition or "Sold out", the price,
 * and a link to the shop's page. The product title stays in the link's title: it repeats the release.
 * <vf-offer-notes> is left empty for per-copy facts the index may add (price drops, shipping).
 */
export function offer(o, rates) {
  const about = el('a', { href: `/shop/${o.shop.id}/` }, attrs(el('vf-icon'), { name: 'info' }));
  about.setAttribute('aria-label', t('detail.shopInfo', { shop: o.shop.name }));
  return el('li', {}, attrs(el('vf-offer', {},
    el('a', { href: o.url, rel: 'nofollow', title: o.title, textContent: o.shop.name }),
    origin(o.shop.country),
    line(o.available ? kind(o) : soldOut(o)),
    price(o.price, o.currency, rates),
    el('vf-offer-notes'),
    about,
  ), { stock: o.available ? 'in' : 'out', country: o.shop.country || null, format: o.format || null, condition: o.used ? 'used' : 'new', local: String(!!region && o.shop.country === region) }));
}

/** <vf-watch> for the release, with the copy shown (the cheapest), or null without a release key. */
export function watch(group, v) {
  if (!group.watchKey) return null;
  const o = v.cheapest;
  const node = el('vf-watch');
  const values = { key: group.watchKey, label: o.title, action: v.inStock ? 'watch' : 'notify', url: o.url, shop: o.shop.name, price: o.price, currency: o.currency };
  for (const [k, val] of Object.entries(values)) if (val != null) node.setAttribute(k, val);
  return node;
}
