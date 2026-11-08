import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile, profiles } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';

/**
 * <vf-shell-account>: the account control of the shell (savoir app-shell), one link to More's account sheet.
 * On the rail: the profile in use and its account, or "Sign in" for a single local profile, with the sync state
 * when it isn't simply synced (state="offline|error|syncing", the changes waiting). On phones it stays hidden and
 * the More tab's <vf-sync-count> shows the changes waiting instead.
 */
export class VfShellAccount extends HTMLElement {
  connectedCallback() {
    this.link = this.querySelector('a');
    this.badge = this.closest('nav')?.querySelector('vf-sync-count');
    this.render = this.render.bind(this);
    addEventListener(SYNC_EVENT, this.render);
    this.render();
  }

  disconnectedCallback() { removeEventListener(SYNC_EVENT, this.render); }

  render() {
    const account = currentAccount();
    const many = profiles().list.length > 1;
    const sync = account ? syncState() : null;
    const name = account || many ? currentProfile()?.name || t('profiles.default') : t('account.signIn');
    const note = account
      ? [`@${account.handle}`, sync && sync.state !== 'synced' ? t(`account.sync.${sync.state}`) : null].filter(Boolean).join(' · ')
      : many ? t('profiles.local') : '';
    this.link.querySelector('vf-icon').setAttribute('name', account ? 'bluesky' : 'person');
    this.link.querySelector('span').textContent = name;
    this.link.querySelector('small').textContent = note;
    this.link.title = [name, note].filter(Boolean).join(' · ');
    this.link.hash = account || many ? 'profiles' : 'account';
    this.setAttribute('state', sync?.state || (account ? 'synced' : 'local'));
    this.hidden = false;
    const waiting = sync?.waiting || 0;
    if (this.badge) {
      this.badge.hidden = !waiting && sync?.state !== 'offline';
      this.badge.textContent = waiting ? String(waiting) : '';
      this.badge.title = waiting ? tn('account.waiting', waiting) : sync?.state === 'offline' ? t('account.sync.offline') : '';
    }
  }
}
customElements.define('vf-shell-account', VfShellAccount);
