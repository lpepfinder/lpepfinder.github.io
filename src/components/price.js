import { t, formatPrice } from './i18n.js';
import { currency, toViewer } from './viewer.js';
import { el } from './dom.js';

/**
 * <vf-price>: the shop's price in tabular figures, and "≈ €24" (muted, in <small>) when the shop
 * sells in another currency than the viewer's and a rate is known. `from` prefixes "from …".
 */
export function price(cents, cur, rates, { from = false } = {}) {
  if (cents == null) return el('vf-price');
  const text = formatPrice(cents, cur);
  const approx = cur && cur !== currency ? toViewer(cents, cur, rates) : null;
  return el('vf-price', {},
    el('data', { value: cents, textContent: from ? t('results.from', { price: text }) : text }),
    approx != null ? el('small', { textContent: t('results.approx', { price: formatPrice(approx, currency) }) }) : null);
}
