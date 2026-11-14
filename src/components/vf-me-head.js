import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile, scoped } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';
import config from '../../data/atproto.json' with { type: 'json' };

/**
 * <vf-me-head>: the top of /me/: the profile's picture (its account's Bluesky avatar, read once from the public
 * app view; else its initial), the profile in use as the title, and under it its account and sync state
 * ("@you · synced · 3 changes waiting") or "Local, in this browser". Its ⋯ menu (vf-menu): Prices in and Share
 * (vf-watch-page opens their sheets), the profiles in Settings, Sync with Bluesky while signed out, and the public
 * page once a list is published.
 */
export class VfMeHead extends HTMLElement {
  connectedCallback() {
    listen(this, window, SYNC_EVENT, () => this.render());
    this.render();
    this.avatar();
  }

  /** The account's avatar in place of the initial; nothing changes when it can't be read. */
  async avatar() {
    const account = currentAccount();
    if (!account) return;
    try {
      const res = await fetch(`${config.services.appview}/xrpc/app.bsky.actor.getProfile?${new URLSearchParams({ actor: account.did })}`);
      const url = res.ok ? (await res.json()).avatar : null;
      if (url) this.querySelector('vf-avatar').replaceChildren(Object.assign(document.createElement('img'), { src: url, alt: '' }));
    } catch {}
  }

  disconnectedCallback() { unlisten(this); }

  render() {
    const account = currentAccount();
    const sync = account ? syncState() : null;
    const name = currentProfile()?.name || t('profiles.default');
    this.querySelector('h1').textContent = name;
    const initial = this.querySelector('vf-avatar > span');
    if (initial) initial.textContent = [...name.replace(/^@/, '')][0]?.toUpperCase() || '';
    this.querySelector('p').textContent = account
      ? [`@${account.handle}`, sync ? t(`account.sync.${sync.state}`) : null, sync?.waiting ? tn('account.waiting', sync.waiting) : null].filter(Boolean).join(' · ')
      : t('profiles.local');
    this.setAttribute('state', sync?.state || (account ? 'synced' : 'local'));
    const signIn = this.querySelector('a[name="sign-in"]')?.closest('li');
    if (signIn) signIn.hidden = !!account;
    let published = {};
    try { published = JSON.parse(localStorage.getItem(scoped('vf.publish'))) || {}; } catch {}
    const page = this.querySelector('a[name="public"]');
    if (page) {
      page.closest('li').hidden = !account || !Object.values(published).some(Boolean);
      if (account) page.search = `?h=${encodeURIComponent(account.handle)}`;
    }
  }
}
customElements.define('vf-me-head', VfMeHead);
