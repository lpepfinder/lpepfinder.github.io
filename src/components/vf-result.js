import { t, formatPrice, countryName } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';

const thumb = (src) => {
  if (!src) return null;
  const url = src.startsWith('//') ? 'https:' + src : src;
  return url.includes('cdn.shopify.com') ? url + (url.includes('?') ? '&' : '?') + 'width=160' : url;
};

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

/**
 * One record offered by one shop: a real link in a heading, meta in a <dl>.
 * Attributes for CSS: country.
 */
export class VfResult extends HTMLElement {
  set record(r) {
    const { artist, title } = splitTitle(r.title);
    const cc = r.shop.country || '';
    if (cc) this.setAttribute('country', cc);
    const link = el('a', { href: r.url, rel: 'nofollow' });
    if (artist) link.append(el('vf-artist', { textContent: artist }), ' ');
    link.append(el('vf-title', { textContent: title }));
    const src = thumb(r.image);
    const meta = el('dl', {},
      el('dt', { textContent: t('resultShop') }), el('dd', { textContent: r.shop.name }));
    if (cc) meta.append(el('dt', { textContent: t('resultCountry') }), el('dd', {}, el('abbr', { title: countryName(cc), textContent: cc })));
    this.replaceChildren(
      ...(src ? [el('img', { src, alt: '', loading: 'lazy', decoding: 'async', width: 56, height: 56 })] : []),
      el('h3', {}, link),
      el('vf-price', {}, el('data', { value: r.price ?? '', textContent: formatPrice(r.price, r.currency) })),
      meta,
    );
  }
}
customElements.define('vf-result', VfResult);
