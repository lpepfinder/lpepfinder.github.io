import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile, profiles } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { currencyChoice, CURRENCY_EVENT } from './viewer.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';

/**
 * <vf-more-settings>: the settings of this browser in the More tab as rows (account, profile, language, prices
 * in), each showing its value and opening its own sheet (savoir app-shell, as joblist's Menu). A link to
 * /more/#account or /more/#profiles opens that sheet.
 */
export class VfMoreSettings extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const row = e.target.closest('section > ul > li > button[value]');
      if (row) this.open(row.value);
    });
    listen(this, window, SYNC_EVENT, () => this.render());
    listen(this, window, CURRENCY_EVENT, () => this.render());
    this.render();
    const asked = location.hash.slice(1);
    if (asked && this.sheet(asked)) this.open(asked);
  }

  disconnectedCallback() { unlisten(this); }

  sheet(name) { return this.querySelector(`vf-sheet[name="${CSS.escape(name)}"]`); }

  open(name) { this.sheet(name)?.open(); }

  value(name, text) {
    const data = this.querySelector(`section button[value="${name}"] > data`);
    if (data) data.textContent = text;
  }

  render() {
    const account = currentAccount();
    const sync = syncState();
    this.value('account', account
      ? [`@${account.handle}`, sync?.state === 'offline' || sync?.state === 'error' ? t(`account.sync.${sync.state}`) : null, sync?.waiting ? tn('account.waiting', sync.waiting) : null].filter(Boolean).join(' · ')
      : t('account.signedOutShort'));
    const { list } = profiles();
    const name = currentProfile()?.name || t('profiles.default');
    this.value('profiles', list.length > 1 ? `${name} · ${tn('profiles.count', list.length)}` : name);
    const code = currencyChoice();
    this.value('currency', code === 'shop' ? t('currency.shop') : code);
  }
}
customElements.define('vf-more-settings', VfMoreSettings);
