import { t, formatPrice } from './i18n.js';
import { currency, toViewer } from './viewer.js';
import { el } from './dom.js';

/**
 * <vf-price> in tabular figures. With a "Prices in" currency other than the shop's and a known
 * rate, the converted price is the main figure ("≈ €24") and the shop's price is shown small
 * underneath ("¥3,730 at the shop"). Otherwise, the shop's price alone. `from` prefixes "from …".
 */
export function price(cents, cur, rates, { from = false } = {}) {
  if (cents == null) return el('vf-price');
  const original = formatPrice(cents, cur);
  const converted = toViewer(cents, cur, rates);
  const main = converted == null ? original : t('results.approx', { price: formatPrice(converted, currency()) });
  return el('vf-price', {},
    el('data', { value: converted ?? cents, textContent: from ? t('results.from', { price: main }) : main }),
    converted != null ? el('small', { textContent: t('results.atShop', { price: original }) }) : null);
}
