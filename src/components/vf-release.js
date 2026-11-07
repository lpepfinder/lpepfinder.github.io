import { t, tn } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { el, attrs } from './dom.js';
import { cover } from './cover.js';
import { price } from './price.js';
import { origin, watch, selectKey } from './release-parts.js';
import { region } from './viewer.js';
import { hrefFor } from './selection.js';
import { ownedKeys } from '../lib/watch/owned.js';

/**
 * Glance facts: "6 shops" (or the shop of a single copy), "4 in stock" or "Sold out", the formats,
 * and the viewer's flag when a copy is in stock in their country. Phones show the first one and the flag.
 */
function meta(v, owned) {
  const single = v.offers.length === 1;
  return el('vf-meta', {},
    owned ? attrs(el('vf-badge', { textContent: t('results.owned') }), { kind: 'owned' }) : null,
    el('span', { textContent: single ? v.offers[0].shop.name : tn('results.shops', v.shops) }),
    el('span', { textContent: v.inStock ? tn('results.inStockCount', v.inStock) : t('soldOut') }),
    v.formats.length ? el('span', { textContent: v.formats.map((f) => t(`formats.${f}`)).join(' / ') }) : null,
    v.local ? origin(region) : null);
}

/** The row's price: the converted figure; the shop's own price moves to the title (tooltip). */
function rowPrice(v, rates) {
  const tag = price(v.cheapest.price, v.cheapest.currency, rates, { from: v.offers.length > 1 });
  const small = tag.querySelector('small');
  if (small) {
    tag.title = small.textContent;
    small.remove();
  }
  return tag;
}

/**
 * <vf-release release="<key>" stock="in|out" offers="6" local="true|false" aria-current="true">:
 * one record across shops, a compact row that links to ?r=<key> (the detail with its copies).
 * Two lines on phones (title · price / artist · shops), one line on desktop; the Watch toggle
 * sits beside the row from tablets up (on phones it is in the detail).
 * Set `view` to { group, view, rates, covers, index }.
 */
export class VfRelease extends HTMLElement {
  set view({ group, view: v, rates, covers, index }) {
    if (!this.link) {
      // a server-rendered row (artist pages) is redrawn in place
      this.link = this.querySelector(':scope > a') || this.appendChild(el('a'));
    }
    const key = selectKey(group);
    // in the collector's collection (Discogs "haves", owned.js)
    const owned = !!group.watchKey && ownedKeys().has(group.watchKey);
    const { artist, title } = splitTitle(group.offers[0].title);
    const image = covers ? v.offers.find((o) => o.image)?.image : undefined;
    this.link.href = hrefFor(key);
    this.link.replaceChildren(...[
      covers && cover(image, index),
      el('vf-name', {}, artist && el('vf-artist', { textContent: artist }), artist && el('span', { textContent: ' – ' }), el('vf-title', { textContent: title })),
      meta(v, owned),
      rowPrice(v, rates),
    ].filter(Boolean));
    const toggle = watch(group, v);
    if (toggle && this.querySelector(':scope > vf-watch')?.getAttribute('action') !== toggle.getAttribute('action')) {
      this.querySelector(':scope > vf-watch')?.remove();
      this.append(toggle);
    }
    attrs(this, { release: key, stock: v.inStock ? 'in' : 'out', offers: v.offers.length, local: String(!!v.local), owned: owned ? 'true' : null });
  }
}
customElements.define('vf-release', VfRelease);
