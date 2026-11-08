import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';

/**
 * <vf-me-head>: the top of /me/: the profile in use as the title, and under it its account and sync state
 * ("@you · synced · 3 changes waiting") or "Local, in this browser". The link opens the profiles in Settings.
 */
export class VfMeHead extends HTMLElement {
  connectedCallback() {
    listen(this, window, SYNC_EVENT, () => this.render());
    this.render();
  }

  disconnectedCallback() { unlisten(this); }

  render() {
    const account = currentAccount();
    const sync = account ? syncState() : null;
    this.querySelector('h1').textContent = currentProfile()?.name || t('profiles.default');
    this.querySelector('p').textContent = account
      ? [`@${account.handle}`, sync ? t(`account.sync.${sync.state}`) : null, sync?.waiting ? tn('account.waiting', sync.waiting) : null].filter(Boolean).join(' · ')
      : t('profiles.local');
    this.setAttribute('state', sync?.state || (account ? 'synced' : 'local'));
  }
}
customElements.define('vf-me-head', VfMeHead);
