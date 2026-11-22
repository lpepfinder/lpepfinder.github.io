import { currencyChoice, CURRENCY_EVENT } from './viewer.js';
import { t } from './i18n.js';
import { listen, unlisten } from './dom.js';

/**
 * <vf-settings-rows>: the settings of this browser in Settings as rows (language, prices in, moving to another
 * device), each showing its value and opening its own sheet (savoir app-shell, as joblist's Menu). A link to
 * /settings/#transfer (or another sheet's name) opens that sheet.
 */
export class VfSettingsRows extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const row = e.target.closest('section > ul > li > button[value]');
      if (row) this.sheet(row.value)?.open();
    });
    listen(this, window, CURRENCY_EVENT, () => this.render());
    this.render();
    const asked = location.hash.slice(1);
    if (asked) this.sheet(asked)?.open();
  }

  disconnectedCallback() { unlisten(this); }

  /** Its own sheets, or one every page has (the languages, LanguageSheet.astro). */
  sheet(name) { return this.querySelector(`vf-sheet[name="${CSS.escape(name)}"]`) || document.querySelector(`vf-sheet[name="${CSS.escape(name)}"]`); }

  render() {
    const code = currencyChoice();
    const data = this.querySelector('section button[value="currency"] > data');
    if (data) data.textContent = code === 'shop' ? t('currency.shop') : code;
  }
}
customElements.define('vf-settings-rows', VfSettingsRows);
