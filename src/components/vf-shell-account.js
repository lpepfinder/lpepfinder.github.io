import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile, profiles } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';

/**
 * <vf-shell-account> in the tab bar (savoir app-shell: one account control): the profile tab carries the name of
 * the profile in use ("Me" for a single local profile) and its account's icon; the Settings tab's <vf-sync-count>
 * shows the changes waiting to reach the account, or a dot while offline.
 */
export class VfShellAccount extends HTMLElement {
  connectedCallback() {
    this.me = this.querySelector('a[rel="me"]');
    this.badge = this.querySelector('vf-sync-count');
    this.render = this.render.bind(this);
    addEventListener(SYNC_EVENT, this.render);
    this.render();
  }

  disconnectedCallback() { removeEventListener(SYNC_EVENT, this.render); }

  render() {
    const account = currentAccount();
    const named = account || profiles().list.length > 1;
    const name = named ? currentProfile()?.name || t('profiles.default') : t('profiles.default');
    this.me.querySelector('span').textContent = name;
    this.me.title = account ? `${name} · @${account.handle}` : name;
    this.me.querySelector('vf-icon').setAttribute('name', account ? 'bluesky' : 'person');
    const sync = account ? syncState() : null;
    const waiting = sync?.waiting || 0;
    this.badge.hidden = !waiting && sync?.state !== 'offline';
    this.badge.textContent = waiting ? String(waiting) : '';
    this.badge.title = waiting ? tn('account.waiting', waiting) : sync?.state === 'offline' ? t('account.sync.offline') : '';
  }
}
customElements.define('vf-shell-account', VfShellAccount);
