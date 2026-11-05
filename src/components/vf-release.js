import { t, tn, formatDay, countryName } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { el, attrs } from './dom.js';
import { cover } from './cover.js';
import { price } from './price.js';
import { region } from './viewer.js';
import './vf-watch.js';

/** "LP · Used · Near mint (NM)". */
const kind = (o) => [o.format && t(`formats.${o.format}`), o.used && t('conditionUsed'),
  o.grade && `${t(`grades.${o.grade.id}`)} (${o.grade.code})`].filter(Boolean).join(' · ');
const country = (cc) => cc && el('abbr', { title: countryName(cc), textContent: cc });
/** Regional indicator letters: "JP" → 🇯🇵. */
const flag = (cc) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** <vf-origin local="true">🇯🇵 Ships from Japan</vf-origin>; local when it is the viewer's country. */
function origin(cc) {
  if (!cc) return null;
  return attrs(el('vf-origin', {}, el('span', { ariaHidden: 'true', textContent: flag(cc) }), ' ', t('results.shipsFrom', { country: countryName(cc) })),
    { country: cc, local: String(cc === region) });
}

/** "Sold out · last seen in stock <time>12 Oct</time>", with the date where the translation puts it. */
function soldOut(o) {
  if (!o.lastInStock) return [t('soldOut')];
  const [before, after = ''] = t('lastInStock', { date: '\u0000' }).split('\u0000');
  return [`${t('soldOut')} · ${before}`, el('time', { dateTime: o.lastInStock, textContent: formatDay(o.lastInStock) }), after];
}

/** <p> of the parts that are set, joined by " · "; a part may be a list of nodes. */
function line(...parts) {
  const p = el('p');
  parts.map((x) => [].concat(x).filter(Boolean)).filter((x) => x.length)
    .forEach((nodes, i) => p.append(...(i ? [' · '] : []), ...nodes));
  return p;
}

/** Quiet meta line: "6 shops · LP · 2 sold out", or "Hard Wax · DE · LP" for a single copy. */
function meta(v) {
  if (v.offers.length === 1) {
    const o = v.offers[0];
    return line(o.shop.name, country(o.shop.country), kind(o), !v.inStock && t('soldOut'));
  }
  return line(tn('results.shops', v.shops), v.formats.map((f) => t(`formats.${f}`)).join(' / '),
    v.soldOut && (v.inStock ? tn('results.soldOutCount', v.soldOut) : t('soldOut')));
}

/** One copy: shop (the link), where it ships from, format and condition or "Sold out", price. */
function offer(o, rates) {
  return el('li', {}, attrs(el('vf-offer', {},
    el('a', { href: o.url, rel: 'nofollow', textContent: o.shop.name }),
    price(o.price, o.currency, rates),
    line(origin(o.shop.country), o.available ? kind(o) : soldOut(o)),
  ), { stock: o.available ? 'in' : 'out', country: o.shop.country || null, format: o.format || null, condition: o.used ? 'used' : 'new' }));
}

function watch(group, v) {
  if (!group.watchKey) return null;
  const o = v.cheapest;
  const node = el('vf-watch');
  const values = { key: group.watchKey, label: o.title, action: v.inStock ? 'watch' : 'notify', url: o.url, shop: o.shop.name, price: o.price, currency: o.currency };
  for (const [k, val] of Object.entries(values)) if (val != null) node.setAttribute(k, val);
  return node;
}

/**
 * <vf-release stock="in|out" offers="6">: one record across shops. A compact row (the <summary>)
 * opens with the native <details> into the copies; the Watch toggle sits next to it.
 * Set `view` to { group, view, rates, covers, index }; the <details> (and its open state) is kept on updates.
 */
export class VfRelease extends HTMLElement {
  set view({ group, view: v, rates, covers, index }) {
    if (!this.details) {
      this.summary = el('summary');
      this.offers = el('ul');
      this.details = el('details', {}, this.summary, this.offers);
      this.append(this.details);
    }
    const { artist, title } = splitTitle(group.offers[0].title);
    const image = covers ? v.offers.find((o) => o.image)?.image : undefined;
    this.summary.replaceChildren(...[
      covers && cover(image, index),
      el('h3', {}, artist && el('vf-artist', { textContent: artist }), el('vf-title', { textContent: title })),
      price(v.cheapest.price, v.cheapest.currency, rates, { from: v.offers.length > 1 }),
      meta(v),
    ].filter(Boolean));
    this.offers.setAttribute('aria-label', t('results.offersLabel', { title: group.offers[0].title }));
    this.offers.replaceChildren(...v.offers.map((o) => offer(o, rates)));
    const toggle = watch(group, v);
    if (toggle && this.querySelector(':scope > vf-watch')?.getAttribute('action') !== toggle.getAttribute('action')) {
      this.querySelector(':scope > vf-watch')?.remove();
      this.append(toggle);
    }
    attrs(this, { stock: v.inStock ? 'in' : 'out', offers: v.offers.length });
  }
}
customElements.define('vf-release', VfRelease);
