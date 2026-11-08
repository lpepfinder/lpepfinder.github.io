import { currentAccount } from '../lib/atproto/accounts.js';
import { currentProfile } from '../lib/watch/profiles.js';
import { SYNC_EVENT, syncState } from './atproto-boot.js';
import { t, tn } from './i18n.js';
import { listen, unlisten } from './dom.js';
import config from '../../data/atproto.json' with { type: 'json' };

/**
 * <vf-me-head>: the top of /me/: the profile's picture (its account's Bluesky avatar, read once from the public
 * app view; else its initial), the profile in use as the title, and under it its account and sync state
 * ("@you · synced · 3 changes waiting") or "Local, in this browser". The link opens the profiles in Settings.
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
  }
}
customElements.define('vf-me-head', VfMeHead);
