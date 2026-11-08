import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile, profiles } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { currencyChoice, CURRENCY_EVENT } from './viewer.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';

/**
 * <vf-settings-rows>: the settings of this browser in the Settings tab as rows (account, profile, language, prices
 * in, moving to another device), each showing its value and opening its own sheet (savoir app-shell, as joblist's
 * Menu). A link to /settings/#account, #profiles or #transfer opens that sheet.
 */
export class VfSettingsRows extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const row = e.target.closest('section > ul > li > button[value]');
      if (row) this.open(row.value);
    });
    listen(this, window, SYNC_EVENT, () => this.render());
    listen(this, window, CURRENCY_EVENT, () => this.render());
    this.render();
    const asked = location.hash.slice(1);
    if (asked === 'transfer' || (asked && this.sheet(asked))) this.open(asked);
  }

  disconnectedCallback() { unlisten(this); }

  sheet(name) { return this.querySelector(`vf-sheet[name="${CSS.escape(name)}"]`); }

  open(name) {
    // moving to another device is part of the profiles sheet: open it at its export button
    if (name === 'transfer') {
      this.sheet('profiles')?.open();
      const button = this.querySelector('vf-profiles button[name="export"]');
      button?.scrollIntoView({ block: 'center' });
      button?.focus();
      return;
    }
    this.sheet(name)?.open();
  }

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
customElements.define('vf-settings-rows', VfSettingsRows);
