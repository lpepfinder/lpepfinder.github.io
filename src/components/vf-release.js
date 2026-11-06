import { t, tn, countryName } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { el, attrs } from './dom.js';
import { cover } from './cover.js';
import { price } from './price.js';
import { kind, line, watch, selectKey } from './release-parts.js';
import { hrefFor } from './selection.js';

const country = (cc) => cc && el('abbr', { title: countryName(cc), textContent: cc });

/** Quiet meta line: "6 shops · LP · 2 sold out", or "Hard Wax · DE · LP" for a single copy. */
function meta(v) {
  if (v.offers.length === 1) {
    const o = v.offers[0];
    return line(o.shop.name, country(o.shop.country), kind(o), !v.inStock && t('soldOut'));
  }
  return line(tn('results.shops', v.shops), v.formats.map((f) => t(`formats.${f}`)).join(' / '),
    v.soldOut && (v.inStock ? tn('results.soldOutCount', v.soldOut) : t('soldOut')));
}

/**
 * <vf-release release="<key>" stock="in|out" offers="6">: one record across shops, a row that links
 * to ?r=<key> (the detail with its copies); the Watch toggle sits next to it.
 * Set `view` to { group, view, rates, covers, index }.
 */
export class VfRelease extends HTMLElement {
  set view({ group, view: v, rates, covers, index }) {
    if (!this.link) {
      this.link = el('a');
      this.append(this.link);
    }
    const key = selectKey(group);
    const { artist, title } = splitTitle(group.offers[0].title);
    const image = covers ? v.offers.find((o) => o.image)?.image : undefined;
    this.link.href = hrefFor(key);
    this.link.replaceChildren(...[
      covers && cover(image, index),
      el('h3', {}, artist && el('vf-artist', { textContent: artist }), el('vf-title', { textContent: title })),
      price(v.cheapest.price, v.cheapest.currency, rates, { from: v.offers.length > 1 }),
      meta(v),
    ].filter(Boolean));
    const toggle = watch(group, v);
    if (toggle && this.querySelector(':scope > vf-watch')?.getAttribute('action') !== toggle.getAttribute('action')) {
      this.querySelector(':scope > vf-watch')?.remove();
      this.append(toggle);
    }
    attrs(this, { release: key, stock: v.inStock ? 'in' : 'out', offers: v.offers.length });
  }
}
customElements.define('vf-release', VfRelease);
