import { t, tn, formatNumber } from './i18n.js';
import { splitTitle } from '../lib/search/title.js';
import { conditionRange, priceRange } from '../lib/search/condition.js';
import { el, attrs } from './dom.js';
import { cover } from './cover.js';
import { price } from './price.js';
import { offer, watch, selectKey } from './release-parts.js';

/** In-stock copies shown before "Show all". */
const FIRST = 8;
const money = (o, rates) => price(o.price, o.currency, rates).querySelector('data')?.textContent || '';
const day = (iso) => new Intl.DateTimeFormat(document.documentElement.lang || 'en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));

/** "New & used · NM – VG+". */
function condition(offers) {
  const c = conditionRange(offers);
  const words = t(c.mix === 'new' ? 'detail.conditionNew' : c.mix === 'used' ? 'detail.conditionUsed' : 'detail.conditionMixed');
  if (!c.best) return words;
  return `${words} · ${c.best === c.worst ? c.best : t('detail.conditionRange', { best: c.best, worst: c.worst })}`;
}

/**
 * <vf-detail release="<key>" stock="in|out" status="empty|ready">: one release compared across shops
 * (the "compare" level): cover, title, price range, condition, actions (Watch, Share, cheapest copy),
 * copies in stock (the first 8, then "Show all"), and the sold out ones in a closed <details>.
 * Set `view` to { group, view, rates, value, checked }, or call empty(). Fires "share".
 */
export class VfDetail extends HTMLElement {
  set view(data) {
    if (data.group !== this.data?.group) this.all = false;
    this.data = data;
    this.render();
  }

  empty() {
    this.data = null;
    attrs(this, { status: 'empty', release: null, stock: null });
    this.replaceChildren(el('p', { textContent: t('detail.empty') }));
  }

  render() {
    const { group, view: v, rates, value, checked } = this.data;
    const { artist, title } = splitTitle(group.offers[0].title);
    const inStock = v.offers.filter((o) => o.available);
    const sold = v.offers.filter((o) => !o.available);
    const range = priceRange(inStock.length ? inStock : v.offers, value);
    const spread = range.low && range.high && value(range.high) > value(range.low)
      ? t('detail.priceRange', { low: money(range.low, rates), high: money(range.high, rates) }) : '';
    const shown = this.all ? inStock : inStock.slice(0, FIRST);
    const cheapest = inStock.length ? v.cheapest : null;
    this.replaceChildren(...[
      cover(v.offers.find((o) => o.image)?.image, 0),
      el('hgroup', {},
        el('h2', { id: 'detail-title', tabIndex: -1, textContent: title }),
        artist && el('p', { textContent: artist })),
      el('dl', {},
        el('dt', { textContent: t('detail.price') }), el('dd', {}, spread || price(v.cheapest.price, v.cheapest.currency, rates)),
        el('dt', { textContent: t('detail.condition') }), el('dd', { textContent: condition(v.offers) }),
        el('dt', { textContent: t('detail.shops') }), el('dd', { textContent: t('detail.shopsInStock', { shops: tn('results.shops', v.shops), inStock: tn('results.inStockCount', inStock.length) }) })),
      el('menu', {},
        el('li', {}, watch(group, v)),
        el('li', {}, attrs(el('button', { type: 'button', name: 'share', textContent: t('detail.share') }), { kind: 'secondary' })),
        cheapest && el('li', {}, el('a', { href: cheapest.url, rel: 'nofollow', textContent: t('detail.cheapest', { shop: cheapest.shop.name, price: money(cheapest, rates) }) }))),
      inStock.length && el('section', {},
        el('h3', {}, t('detail.inStock'), ' ', el('data', { value: inStock.length, textContent: formatNumber(inStock.length) })),
        el('ul', {}, ...shown.map((o) => offer(o, rates))),
        shown.length < inStock.length && attrs(el('button', { type: 'button', name: 'all', textContent: tn('detail.showAll', inStock.length) }), { kind: 'secondary' })),
      sold.length && el('details', {},
        el('summary', {}, t('detail.soldOut'), ' ', el('data', { value: sold.length, textContent: formatNumber(sold.length) })),
        el('ul', {}, ...sold.map((o) => offer(o, rates)))),
      el('footer', {},
        checked && el('p', {}, ...this.checked(checked)),
        artist && el('p', {}, el('a', { href: `?q=${encodeURIComponent(artist)}`, textContent: t('detail.searchArtist', { artist }) }))),
    ].filter(Boolean));
    this.querySelector('button[name="all"]')?.addEventListener('click', () => this.showAll(shown.length));
    this.querySelector('button[name="share"]').addEventListener('click', () => this.dispatchEvent(new Event('share', { bubbles: true })));
    attrs(this, { status: 'ready', release: selectKey(group), stock: inStock.length ? 'in' : 'out' });
  }

  /** "Prices checked <time>6 Nov</time>", the date where the translation puts it. */
  checked(iso) {
    const [before, after = ''] = t('detail.checked', { date: '\u0000' }).split('\u0000');
    return [before, el('time', { dateTime: iso.slice(0, 10), textContent: day(iso) }), after];
  }

  showAll(from) {
    this.all = true;
    this.render();
    this.querySelectorAll('vf-offer > a[rel]')[from]?.focus();
  }

  focusTitle() { this.querySelector('h2')?.focus(); }
}
customElements.define('vf-detail', VfDetail);
