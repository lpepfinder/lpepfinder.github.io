import { t, formatPrice, formatDay, countryName } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { detectFormat } from '../lib/search/format.js';
import { thumb, absolute } from '../lib/thumb.js';
import { releaseKey } from '../lib/search/release-key.js';
import './vf-watch.js';

const EAGER = 4;

function cover(image, index) {
  const original = absolute(image);
  const src = thumb(image);
  if (!src) return el('vf-cover');
  const eager = index < EAGER;
  const img = el('img', { src, alt: '', decoding: 'async', width: 56, height: 56, referrerPolicy: 'no-referrer', loading: eager ? 'eager' : 'lazy', fetchPriority: eager ? 'auto' : 'low' });
  // resized variant missing on this shop: fall back to the original once
  if (src !== original) img.addEventListener('error', () => { img.src = original; }, { once: true });
  return img;
}

/** " · last seen in stock <time>12 Oct 2026</time>", with the date where the translation puts it. */
function lastSeen(day) {
  if (!day) return [];
  const [before, after = ''] = t('lastInStock', { date: '\u0000' }).split('\u0000');
  return [` · ${before}`, el('time', { dateTime: day, textContent: formatDay(day) }), after];
}

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

/** Watch toggle for the release of a record ("Notify me" when sold out); null without a key. */
function watchToggle(r) {
  const key = releaseKey(r.title);
  if (!key) return null;
  const watch = el('vf-watch');
  const values = { key, label: r.title, action: r.available === false ? 'notify' : 'watch', url: r.url, shop: r.shop.name, price: r.price, currency: r.currency };
  for (const [k, v] of Object.entries(values)) if (v != null) watch.setAttribute(k, v);
  return watch;
}

/**
 * One record offered by one shop: a real link in a heading, meta in a <dl>, a watch toggle.
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
    if (r.available === false) meta.prepend(el('dt', { textContent: t('resultStock') }), el('dd', {}, t('soldOut'), ...lastSeen(r.lastInStock)));
    this.replaceChildren(
      cover(r.image, this.index),
      el('h3', {}, link),
      el('vf-price', {}, el('data', { value: r.price ?? '', textContent: formatPrice(r.price, r.currency) })),
      meta,
      ...[watchToggle(r)].filter(Boolean),
    );
  }
}
customElements.define('vf-result', VfResult);
