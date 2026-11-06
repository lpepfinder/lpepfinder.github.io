import { add, update, load } from '../lib/watch/store.js';
import { fetchWantlist, fromCsv, DiscogsError } from '../lib/watch/discogs.js';
import { wantRecords } from '../lib/watch/wants.js';
import { afterWatch } from './vf-toast.js';
import { t, tn, formatNumber } from './i18n.js';

const USER = 'vf.discogs.user';
const read = () => { try { return localStorage.getItem(USER) || ''; } catch { return ''; } };
const remember = (u) => { try { localStorage.setItem(USER, u); } catch {} };
const page = () => document.querySelector('vf-watch-page');

/**
 * <vf-watch-import status="idle|loading|done|error">: a Discogs wantlist into the watchlist, by
 * username (public wantlist, read page by page, usable while it loads) or from the CSV export.
 * Importing the same username again syncs: wants removed on Discogs leave the watchlist.
 * Open by default while the watchlist is empty.
 */
export class VfWatchImport extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector('details');
    this.form = this.querySelector('form');
    this.user = this.form.elements.user;
    this.live = this.querySelector('output');
    this.progress = this.querySelector('vf-progress');
    this.user.value = read();
    if (!Object.keys(load().items).length) this.details.open = true;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.fromDiscogs(); });
    this.querySelector('input[name="csv"]').addEventListener('change', (e) => this.fromFile(e.target));
  }

  /** Add one batch of wants; returns how many were new. */
  add(wants) {
    const n = add(wantRecords(wants));
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
    const wants = fromCsv(await file.text().catch(() => ''));
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
