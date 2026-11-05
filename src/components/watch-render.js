import { t, tn, lang, formatPrice, formatNumber } from './i18n.js';

/** DOM for the watch page: one change (<vf-change>), one watched record (<vf-watch-item>). */
export const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
};
const attrs = (node, values) => {
  for (const [k, v] of Object.entries(values)) node.setAttribute(k, v);
  return node;
};
const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' });
const link = (href, text, rel) => (href ? el('a', { href, rel, textContent: text }) : text);

/** A change row [key, offerKey, event, priceCents, currency, title, url, shopId, date]; shops: id → { name, country }. */
export function change(row, shops, seen) {
  const [, , event, price, currency, title, url, shopId, date] = row;
  const shop = shops.get(shopId);
  const where = [shop?.name || shopId, shop?.country].filter(Boolean).join(' · ');
  return el('li', {}, attrs(el('vf-change', {},
    el('vf-event', { textContent: t(`watchPage.event.${event}`) }),
    el('h3', {}, link(url, title, 'nofollow')),
    price != null ? el('vf-price', {}, el('data', { value: price, textContent: formatPrice(price, currency) })) : null,
    el('p', {}, where && `${where} · `, el('time', { dateTime: date, textContent: day.format(new Date(date)) })),
  ), { event, seen: String(seen) }));
}

/** Stock attribute of a stored state: in | out | none, or unknown before the first check. */
export const stock = (s) => (!s ? 'unknown' : s[0] ? 'in' : s[1] ? 'out' : 'none');

function stateText(s) {
  const kind = stock(s);
  if (kind === 'in') return t('watchPage.stateIn', { count: formatNumber(s[0]), price: formatPrice(s[2], s[3]) });
  if (kind === 'out') return tn('watchPage.stateOut', s[1]);
  return kind === 'none' ? t('watchPage.stateNone') : '';
}

/** A watched release: title linking to a search for it, its state, a Remove button (value = key). */
export function item(key, it, search) {
  const title = it.t || t('watchPage.unknownTitle', { key });
  const remove = el('button', { type: 'button', name: 'remove', value: key, textContent: t('watchPage.remove') });
  remove.setAttribute('aria-label', t('watchPage.removeLabel', { title }));
  return el('li', {}, attrs(el('vf-watch-item', {},
    el('h3', {}, link(it.t && `${search}?q=${encodeURIComponent(it.t)}`, title)),
    el('p', { textContent: stateText(it.s) }),
    remove,
  ), { stock: stock(it.s) }));
}
