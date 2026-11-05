import { t, formatDay } from './i18n.js';
import { currencyChoice, setCurrency, ratesFile, CURRENCY_EVENT } from './viewer.js';

/**
 * <vf-currency>: the "Prices in" menu and the date of the rates ("Rates of 5 Nov, ECB").
 * Every menu on the page shows the same choice; changing one fires CURRENCY_EVENT on window.
 */
export class VfCurrency extends HTMLElement {
  connectedCallback() {
    this.select = this.querySelector('select');
    this.sync = () => { this.select.value = currencyChoice(); };
    this.sync();
    this.select.addEventListener('change', () => setCurrency(this.select.value));
    addEventListener(CURRENCY_EVENT, this.sync);
    ratesFile().then(({ date }) => {
      if (date) this.querySelector('small').textContent = t('currency.rates', { date: formatDay(date) });
    });
  }

  disconnectedCallback() { removeEventListener(CURRENCY_EVENT, this.sync); }
}
customElements.define('vf-currency', VfCurrency);
