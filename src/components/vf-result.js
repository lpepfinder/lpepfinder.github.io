import { t, formatPrice, countryName } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { detectFormat } from '../lib/search/format.js';

const EAGER = 4;
const WP_SIZE = /-\d{3,4}x\d{3,4}(\.(?:jpe?g|png|webp))(\?|$)/i;

/** Thumbnail at 2x the 56 px box: Shopify resizes on request, WordPress has a 150x150 size by default. */
export function thumb(src) {
  if (!src) return null;
  const url = src.startsWith('//') ? 'https:' + src : src;
  if (url.includes('cdn.shopify.com')) return url + (url.includes('?') ? '&' : '?') + 'width=112';
  return url.replace(WP_SIZE, '-150x150$1$2');
}

function cover(image, index) {
  const original = image && (image.startsWith('//') ? 'https:' + image : image);
  const src = thumb(image);
  if (!src) return el('vf-cover');
  const eager = index < EAGER;
  const img = el('img', { src, alt: '', decoding: 'async', width: 56, height: 56, referrerPolicy: 'no-referrer', loading: eager ? 'eager' : 'lazy', fetchPriority: eager ? 'auto' : 'low' });
  // resized variant missing on this shop: fall back to the original once
  if (src !== original) img.addEventListener('error', () => { img.src = original; }, { once: true });
  return img;
}

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

/**
 * One record offered by one shop: a real link in a heading, meta in a <dl>.
 * Attributes for CSS: country, format, condition, stock ("out" when sold out). Set `index` (position in the list) before `record`.
 */
export class VfResult extends HTMLElement {
  index = 0;

  set record(r) {
    const { artist, title } = splitTitle(r.title);
    const cc = r.shop.country || '';
    const { format, used } = detectFormat(r.title);
    if (cc) this.setAttribute('country', cc);
    if (format) this.setAttribute('format', format);
    this.setAttribute('condition', used ? 'used' : 'new');
    if (r.available === false) this.setAttribute('stock', 'out');
    const link = el('a', { href: r.url, rel: 'nofollow' });
    if (artist) link.append(el('vf-artist', { textContent: artist }), ' ');
    link.append(el('vf-title', { textContent: title }));
    const meta = el('dl', {},
      el('dt', { textContent: t('resultShop') }), el('dd', { textContent: r.shop.name }));
    const kind = [format && t(`formats.${format}`), used && t('conditionUsed')].filter(Boolean).join(' · ');
    if (kind) meta.prepend(el('dt', { textContent: t('resultFormat') }), el('dd', { textContent: kind }));
    if (cc) meta.append(el('dt', { textContent: t('resultCountry') }), el('dd', {}, el('abbr', { title: countryName(cc), textContent: cc })));
    if (r.available === false) meta.prepend(el('dt', { textContent: t('resultStock') }), el('dd', { textContent: t('soldOut') }));
    this.replaceChildren(
      cover(r.image, this.index),
      el('h3', {}, link),
      el('vf-price', {}, el('data', { value: r.price ?? '', textContent: formatPrice(r.price, r.currency) })),
      meta,
    );
  }
}
customElements.define('vf-result', VfResult);
