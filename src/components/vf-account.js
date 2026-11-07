import { accounts, currentAccount } from '../lib/atproto/accounts.js';
import { EVENT as PROFILE_EVENT } from '../lib/watch/profiles.js';
import { SYNC_EVENT, boot } from './atproto-boot.js';
import { t } from './i18n.js';
import { listen, unlisten } from './dom.js';
import { handleOf } from '../lib/watch/radio.js';

/**
 * <vf-account state="out|in" sync="syncing|synced|error">: sign in with Bluesky (More tab), and the account
 * of the current profile with its sync state and Sign out. What is synced is public: the form says so.
 */
export class VfAccount extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.status = this.querySelector('vf-account-status');
    this.live = this.querySelector('output');
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.signIn(); });
    this.querySelector('button[name="signout"]').addEventListener('click', () => this.signOut());
    listen(this, window, PROFILE_EVENT, () => this.render());
    listen(this, window, SYNC_EVENT, (e) => { this.setAttribute('sync', e.detail); this.render(); });
    this.render();
  }

  disconnectedCallback() { unlisten(this); }

  render() {
    const account = currentAccount();
    this.setAttribute('state', account ? 'in' : 'out');
    this.status.textContent = account ? t('account.signedIn', { handle: account.handle }) + (this.getAttribute('sync') ? ` · ${t(`account.sync.${this.getAttribute('sync')}`)}` : '') : '';
  }

  async signIn() {
    const handle = handleOf(this.form.elements.handle.value);
    if (!handle) return;
    this.setAttribute('busy', '');
    this.live.textContent = t('account.going');
    try {
      await (await import('../lib/atproto/session.js')).signIn(handle);
    } catch (e) {
      console.error(e);
      this.live.textContent = t('account.error', { handle });
      this.removeAttribute('busy');
    }
  }

  async signOut() {
    const account = currentAccount();
    if (!account) return;
    await (await import('../lib/atproto/session.js')).signOut(account.did);
    this.live.textContent = t('account.signedOut', { handle: account.handle });
    this.removeAttribute('sync');
    this.render();
  }
}
customElements.define('vf-account', VfAccount);
boot();
