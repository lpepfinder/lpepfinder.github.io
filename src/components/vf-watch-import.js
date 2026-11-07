import { add, update } from '../lib/watch/store.js';
import { scoped } from '../lib/watch/profiles.js';
import { listen, unlisten } from './dom.js';
import { fetchWantlist, fetchCollection, fromCsv, isCollectionCsv, DiscogsError } from '../lib/watch/discogs.js';
import { setOwned } from '../lib/watch/owned.js';
import { wantRecords } from '../lib/watch/wants.js';
import { afterWatch } from './vf-toast.js';
import { t, tn, formatNumber } from './i18n.js';

// the Discogs account of the current profile (profiles.js)
const USER = () => scoped('vf.discogs.user');
const read = () => { try { return localStorage.getItem(USER()) || ''; } catch { return ''; } };
const remember = (u) => { try { localStorage.setItem(USER(), u); } catch {} };
const page = () => document.querySelector('vf-watch-page');

/**
 * <vf-watch-import status="idle|loading|done|error">: a Discogs wantlist into the watchlist, by
 * username (public wantlist, read page by page, usable while it loads) or from the CSV export.
 * Importing the same username again syncs: wants removed on Discogs leave the watchlist.
 * Fires "vf-watch-imported" on window when a username was imported (the page labels its Discogs button).
 */
export class VfWatchImport extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.user = this.form.elements.user;
    this.live = this.querySelector('output');
    this.progress = this.querySelector('vf-progress');
    this.user.value = read();
    // the page has two import forms (start screen, Discogs sheet): a username imported in one fills the other
    listen(this, window, 'vf-watch-imported', () => { if (!this.user.value) this.user.value = read(); });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.fromDiscogs(); });
    this.querySelector('button[name="collection"]').addEventListener('click', () => this.fromCollection());
    this.querySelector('input[name="csv"]').addEventListener('change', (e) => this.fromFile(e.target));
  }

  /** Add one batch of wants; returns how many were new. */
  add(wants) {
    // `d`: kept by Discogs, re-imported from the username on any device, not written to a Bluesky account
    const n = add(wantRecords(wants).map((r) => ({ ...r, fields: { ...r.fields, d: 1 } })));
    if (n) afterWatch();
    return n;
  }

  async fromDiscogs() {
    const user = this.user.value.trim();
    if (!user || this.getAttribute('status') === 'loading') return;
    this.setAttribute('status', 'loading');
    this.live.textContent = t('watchPage.discogsLoading', { user });
    const ids = new Set();
    let added = 0;
    try {
      await fetchWantlist(user, {
        onPage: (wants, { page: n, pages }) => {
          for (const w of wants) if (w.id) ids.add(w.id);
          added += this.add(wants);
          this.step(n, pages, ids.size);
          // the first page is shown at once; the rest when everything is in
          if (n === 1) page()?.refresh();
        },
      });
      // a sync: wants removed on Discogs leave the list (records watched from the search stay)
      let removed = 0;
      update((list) => {
        for (const [key, it] of Object.entries(list.items)) if (it.w && !ids.has(it.w)) { delete list.items[key]; removed++; }
      });
      remember(user);
      dispatchEvent(new Event('vf-watch-imported'));
      this.setAttribute('status', 'done');
      this.live.textContent = [tn('watchPage.discogsDone', ids.size, { user }), tn('watchPage.imported', added), removed ? tn('watchPage.discogsRemoved', removed) : null].filter(Boolean).join(' ');
    } catch (e) {
      this.setAttribute('status', 'error');
      const code = e instanceof DiscogsError ? e.code : 'network';
      this.live.textContent = t(`watchPage.discogsError.${code}`, { user });
    }
    this.progress.hidden = true;
    page()?.refresh();
  }

  /** The collection ("haves"): marked in search, hidden in Dig on request. A new import replaces the old one. */
  async fromCollection() {
    const user = this.user.value.trim();
    if (!user) { this.user.focus(); this.user.reportValidity(); return; }
    if (this.getAttribute('status') === 'loading') return;
    this.setAttribute('status', 'loading');
    this.live.textContent = t('watchPage.collectionLoading', { user });
    let count = 0;
    try {
      await fetchCollection(user, {
        onPage: (records, { page: n, pages }) => {
          count += setOwned(records, { replace: n === 1 });
          this.step(n, pages, count);
        },
      });
      remember(user);
      this.setAttribute('status', 'done');
      this.live.textContent = tn('watchPage.collectionDone', count, { user });
    } catch (e) {
      this.setAttribute('status', 'error');
      const code = e instanceof DiscogsError ? e.code : 'network';
      this.live.textContent = t(`watchPage.discogsError.${code}`, { user });
    }
    this.progress.hidden = true;
  }

  step(n, pages, count) {
    this.progress.hidden = n >= pages;
    const bar = this.progress.querySelector('progress');
    bar.max = pages;
    bar.value = n;
    this.progress.querySelector('label').textContent = t('watchPage.discogsProgress', { count: formatNumber(count) });
  }

  async fromFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => '');
    // a collection export marks owned records; a wantlist export adds wants
    if (isCollectionCsv(text)) {
      const owned = fromCsv(text) || [];
      this.setAttribute('status', 'done');
      this.live.textContent = tn('watchPage.collectionDone', setOwned(owned, { replace: true }), { user: file.name });
      input.value = '';
      return;
    }
    const wants = fromCsv(text);
    if (!wants) {
      this.setAttribute('status', 'error');
      this.live.textContent = t('watchPage.csvError');
    } else {
      this.setAttribute('status', 'done');
      this.live.textContent = `${tn('watchPage.discogsFile', wants.length)} ${tn('watchPage.imported', this.add(wants))}`;
      page()?.refresh();
    }
    input.value = '';
  }
}
customElements.define('vf-watch-import', VfWatchImport);
