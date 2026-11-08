import { sources, checkDiscogs, freshness, checkRadio, radioFreshness, EVENT } from '../lib/watch/sources.js';
import { EVENT as PROFILE_EVENT, scoped } from '../lib/watch/profiles.js';
import { currentAccount } from '../lib/atproto/accounts.js';
import { SYNC_EVENT } from './atproto-boot.js';
import { el, attrs, listen, unlisten } from './dom.js';
import { t, tn, formatAgo } from './i18n.js';

const icon = (name) => attrs(el('vf-icon'), { name });

/**
 * <vf-watch-sources>: where the lists come from and whether they are up to date, one <vf-source> each:
 *   <vf-source kind="wants|collection|radio|bluesky" state="current|changed|old|new|syncing|error">
 * Discogs lists show their count, when they were read and what changed on Discogs since (checked at most daily,
 * sources.js), with Resync when they changed or are old; a Radio4000 radio (the signed-in account's own, or the
 * last one read) offers to find records when it has tracks not read yet; the Bluesky account shows its last sync.
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
      if (button?.value === 'radio') this.readRadio();
      else if (button) this.resync(button.value);
    });
    this.render();
    this.check();
  }

  async check() {
    this.checking?.abort();
    this.checking = new AbortController();
    const { signal } = this.checking;
    await Promise.all([
      checkDiscogs({ signal }).catch(() => {}),
      checkRadio({ handle: currentAccount()?.handle, signal }).catch(() => {}),
    ]);
  }

  render() {
    const s = sources();
    const rows = ['wants', 'collection'].map((kind) => this.discogsRow(kind, s)).filter(Boolean);
    const radio = this.radioRow(s);
    if (radio) rows.push(radio);
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

  /** The radio: offered when it has tracks never read (a signed-in DJ's own), resync when tracks were added. */
  radioRow(s) {
    const f = radioFreshness(s);
    if (!f) return null;
    const notes = f.state === 'new' ? [t('sources.radioNew')]
      : [f.state === 'changed' ? t('sources.radioAdded') : t('sources.current'), f.n == null ? null : tn('sources.tracks', f.n), t('sources.read', { ago: formatAgo(f.at) })];
    const action = f.state === 'current' ? null
      : attrs(el('button', { type: 'button', name: 'resync', value: 'radio' }, icon(f.state === 'new' ? 'search' : 'refresh'), t(f.state === 'new' ? 'radio.find' : 'sources.resync')), { kind: 'secondary' });
    return this.row('radio', f.state, 'play', t('sources.radio', { handle: f.handle }), notes, action);
  }

  /** The radio's reading in the sheet, with its matches to review. */
  readRadio() {
    const page = this.closest('vf-watch-page') || document;
    const sheet = page.querySelector('vf-sheet[name="discogs"]');
    const importer = sheet?.querySelector('vf-radio-import');
    if (!importer) return;
    sheet.open();
    importer.scrollIntoView({ block: 'start' });
    importer.read(sources().radio.handle);
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
