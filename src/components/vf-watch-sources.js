import { sources, checkDiscogs, freshness, EVENT } from '../lib/watch/sources.js';
import { EVENT as PROFILE_EVENT, scoped } from '../lib/watch/profiles.js';
import { currentAccount } from '../lib/atproto/accounts.js';
import { SYNC_EVENT } from './atproto-boot.js';
import { el, attrs, listen, unlisten } from './dom.js';
import { t, tn, formatAgo } from './i18n.js';

const icon = (name) => attrs(el('vf-icon'), { name });

/**
 * <vf-watch-sources>: where the lists come from and whether they are up to date, one <vf-source> each:
 *   <vf-source kind="wants|collection|bluesky" state="current|changed|old|syncing|error">
 * Discogs lists show their count, when they were read and what changed on Discogs since (checked at most daily,
 * sources.js), with Resync when they changed or are old; the Bluesky account shows its last sync.
 * Resync runs the import of the Discogs sheet, opened so its progress shows.
 */
export class VfWatchSources extends HTMLElement {
  disconnectedCallback() { unlisten(this); this.checking?.abort(); }

  connectedCallback() {
    this.list = this.querySelector('ul');
    const render = () => this.render();
    listen(this, window, EVENT, render);
    listen(this, window, PROFILE_EVENT, () => { this.render(); this.check(); });
    listen(this, window, SYNC_EVENT, (e) => { this.sync = e.detail; this.render(); });
    this.list.addEventListener('click', (e) => {
      const button = e.target.closest('button[name="resync"]');
      if (button) this.resync(button.value);
    });
    this.render();
    this.check();
  }

  async check() {
    this.checking?.abort();
    this.checking = new AbortController();
    await checkDiscogs({ signal: this.checking.signal }).catch(() => {});
  }

  render() {
    const s = sources();
    const rows = ['wants', 'collection'].map((kind) => this.discogsRow(kind, s)).filter(Boolean);
    const account = currentAccount();
    if (account) rows.push(this.blueskyRow(account, s));
    this.list.replaceChildren(...rows.map((row) => el('li', {}, row)));
    this.hidden = !rows.length;
  }

  discogsRow(kind, s) {
    const f = freshness(kind, s);
    if (!f) return null;
    // what matters first: what changed on Discogs, or that it is up to date
    const notes = [
      f.state === 'changed' ? tn(f.diff > 0 ? 'sources.more' : 'sources.fewer', Math.abs(f.diff)) : f.state === 'current' ? t('sources.current') : null,
      f.n == null ? null : tn('sources.count', f.n), t('sources.read', { ago: formatAgo(f.at) }),
    ];
    return this.row(kind, f.state, kind === 'wants' ? 'star' : 'shelf', t(`sources.${kind}`, { user: s.discogs.user }), notes,
      f.state === 'current' ? null : attrs(el('button', { type: 'button', name: 'resync', value: kind }, icon('refresh'), t('sources.resync')), { kind: 'secondary' }));
  }

  blueskyRow(account, s) {
    const state = this.sync === 'syncing' ? 'syncing' : this.sync === 'error' ? 'error' : 'current';
    const notes = [state === 'current' && s.bluesky?.at ? t('sources.synced', { ago: formatAgo(s.bluesky.at) }) : t(`account.sync.${this.sync || 'syncing'}`)];
    // with a list published, its public page is one tap away
    let published = {};
    try { published = JSON.parse(localStorage.getItem(scoped('vf.publish'))) || {}; } catch {}
    const page = Object.values(published).some(Boolean)
      ? attrs(el('a', { href: `${this.getAttribute('user-page') || '/u/'}?h=${encodeURIComponent(account.handle)}` }, icon('person'), t('sources.publicPage')), { kind: 'secondary' })
      : null;
    return this.row('bluesky', state, 'bluesky', t('sources.bluesky', { handle: account.handle }), notes, page);
  }

  row(kind, state, name, label, notes, action) {
    return attrs(el('vf-source', {}, icon(name), el('strong', {}, label), el('small', {}, notes.filter(Boolean).join(' · ')), action), { kind, state });
  }

  /** The Discogs sheet's import, for the profile's username, with its progress in view. */
  resync(kind) {
    const page = this.closest('vf-watch-page') || document;
    const sheet = page.querySelector('vf-sheet[name="discogs"]');
    const importer = sheet?.querySelector('vf-watch-import');
    if (!importer) return;
    importer.user.value = sources().discogs?.user || importer.user.value;
    sheet.open();
    if (kind === 'collection') importer.fromCollection(); else importer.fromDiscogs();
  }
}
customElements.define('vf-watch-sources', VfWatchSources);
