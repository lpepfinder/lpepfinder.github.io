import { accounts, currentAccount } from '../lib/atproto/accounts.js';
import { scoped } from '../lib/watch/profiles.js';
import { SYNC_EVENT, boot, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';
import { handleOf } from '../lib/watch/radio.js';

/**
 * <vf-account state="out|in" sync="syncing|synced|offline|error">: sign in with Bluesky (More tab), and the
 * account of the current profile with its sync state (and the changes waiting to be sent) and Sign out.
 * What is synced is public: the form says so.
 */
export class VfAccount extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.status = this.querySelector('vf-account-status');
    this.live = this.querySelector('output');
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.signIn(); });
    this.querySelector('button[name="signout"]').addEventListener('click', () => this.signOut());
    this.publish = this.querySelector('fieldset[name="publish"]');
    this.publish.addEventListener('change', (e) => this.setPublish(e.target.name, e.target.checked, e.target));
    listen(this, window, SYNC_EVENT, (e) => this.showSync(e.detail));
    this.showSync(syncState());
  }

  disconnectedCallback() { unlisten(this); }

  showSync(s) {
    this.syncInfo = s;
    if (s) this.setAttribute('sync', s.state); else this.removeAttribute('sync');
    this.render();
  }

  render() {
    const account = currentAccount();
    this.setAttribute('state', account ? 'in' : 'out');
    const s = this.syncInfo;
    this.status.textContent = account ? [t('account.signedIn', { handle: account.handle }), s && t(`account.sync.${s.state}`), s?.waiting ? tn('account.waiting', s.waiting) : null].filter(Boolean).join(' · ') : '';
    if (!account) return;
    this.publish.querySelector('a').href = `${this.publish.querySelector('a').pathname}?h=${encodeURIComponent(account.handle)}`;
    // the switches read their settings without loading the account code
    let on = {};
    try { on = JSON.parse(localStorage.getItem(scoped('vf.publish'))) || {}; } catch {}
    for (const box of this.publish.querySelectorAll('input')) box.checked = !!on[box.name];
  }

  /** Publish a list on the account, or take it down; a session from before publishing existed must sign in again. */
  async setPublish(kind, on, box) {
    box.disabled = true;
    this.live.textContent = t(on ? 'account.publishing' : 'account.unpublishing');
    try {
      await (await import('../lib/atproto/publish.js')).setPublish(kind, on);
      this.live.textContent = t(on ? 'account.published' : 'account.unpublished');
    } catch (e) {
      console.error(e);
      this.live.textContent = t(e.code === 'scope' ? 'account.publishScope' : 'account.publishError');
    }
    box.disabled = false;
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
    this.showSync(null);
  }
}
customElements.define('vf-account', VfAccount);
boot();
