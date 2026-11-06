import { SearchClient } from '../lib/search/client.js';
import { t } from './i18n.js';
import { addRecent } from './recent.js';
import './vf-results.js';
import { listen, unlisten } from './dom.js';
import config from '../../data/config.json' with { type: 'json' };

/** Slices one page may load at most, so a query of one record in thousands of copies stays bounded. */
const MAX_SLICES = 10;

/**
 * <vf-search> enhances a server-rendered GET form. When the page has a
 * <vf-results> region it runs the query in the browser; elsewhere the form
 * simply submits to the home page.
 */
export class VfSearch extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  connectedCallback() {
    // "/" focuses the search box (keyboards), unless the reader is typing somewhere
    listen(this, document, 'keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      this.querySelector('input[name="q"]').focus();
    });
    this.results = document.querySelector('vf-results');
    // after client-side navigation, the new page's elements upgrade parent first: ready the ones used here
    if (this.results) customElements.upgrade(this.results);
    if (!this.results) return;
    this.client = new SearchClient(this.getAttribute('index') || '/search/');
    this.form = this.querySelector('form');
    this.input = this.form.querySelector('input[name="q"]');
    this.per = Number(this.getAttribute('per-page')) || 30;
    this.releasesPer = Number(this.getAttribute('releases-per-page')) || 24;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(this.typing); this.run(this.input.value, { push: true, submitted: true }); });
    // results as you type: after a short pause, from config.search.typeMinChars characters; the first search
    // from the home page is one history step (Back returns home), later keystrokes only update the address
    this.input.addEventListener('input', () => {
      clearTimeout(this.typing);
      const q = this.input.value.trim();
      if (q === this.query || (q && q.length < config.search.typeMinChars)) return;
      this.typing = setTimeout(() => this.run(q, { push: !this.query, replace: !!this.query, typed: true }), config.search.typeDelayMs);
    });
    this.results.addEventListener('more', () => this.more(true));
    this.results.addEventListener('retry', () => { this.client = new SearchClient(this.client.base); this.run(this.input.value, { submitted: true }); });
    // back/forward: search again only when the query changed (not for ?r= of a release)
    listen(this, window, 'vf-popstate', () => {
      if ((new URLSearchParams(location.search).get('q') || '').trim() !== this.query) this.fromUrl();
    });
    this.fromUrl();
  }

  fromUrl() {
    const q = new URLSearchParams(location.search).get('q') || '';
    this.input.value = q;
    this.run(q, {});
  }

  async run(query, { push = false, replace = false, submitted = false, typed = false }) {
    const q = query.trim();
    this.query = q;
    // a newer search started while this one waited for the index: this one's results are dropped
    const id = (this.runs = (this.runs || 0) + 1);
    const current = () => id === this.runs;
    if (push || replace) {
      const url = new URL(location.href);
      q ? url.searchParams.set('q', q) : url.searchParams.delete('q');
      url.searchParams.delete('r');
      if (push) history.pushState(null, '', url); else history.replaceState(history.state, '', url);
    }
    this.setAttribute('status', q ? 'loading' : 'idle');
    document.querySelector('vf-app')?.setAttribute('mode', q ? 'results' : 'home');
    if (!q) { this.results.idle(); return; }
    document.title = t('searchTitle', { query: q });
    this.results.loading();
    try {
      const ids = await this.client.rank(await this.client.match(q), q, this.per);
      if (!current()) return;
      this.ids = ids;
      this.shown = 0;
      this.results.checked = this.client.meta?.builtAt;
      this.results.start(q, this.ids.length);
      if (this.ids.length) {
        await this.more(false);
        await this.results.restore(() => this.more(false), () => this.shown < this.ids.length);
      }
      else {
        const hint = await this.client.suggest(q).catch(() => ({}));
        if (current()) this.results.suggest(hint);
      }
    } catch (err) {
      if (!current()) return;
      console.error(err);
      this.results.error();
    }
    if (!current()) return;
    this.setAttribute('status', this.results.getAttribute('status'));
    if (submitted) { this.input.blur(); this.results.focusHeading(); }
    // a search typed and left there counts too, but not each keystroke
    clearTimeout(this.settle);
    const record = () => { if (this.ids?.length) addRecent(q); window.umami?.track?.('search', { q, results: this.ids?.length ?? -1 }); };
    if (typed) this.settle = setTimeout(() => { if (current()) record(); }, config.search.typeSettleMs);
    else record();
  }

  /**
   * Next page: slices of `per-page` records (regrouped by release) until the page adds
   * `releases-per-page` releases or the matches run out, so a page is never one popular record.
   * After "show more", focus the first new row.
   */
  async more(focus) {
    const before = this.results.groups.size;
    const run = this.runs;
    let first = null;
    for (let i = 0; i < MAX_SLICES && this.shown < this.ids.length && run === this.runs; i++) {
      const slice = this.ids.slice(this.shown, this.shown + this.per);
      this.shown += slice.length;
      first ??= await this.results.append(await this.client.records(slice), this.shown);
      if (this.results.groups.size - before >= this.releasesPer) break;
    }
    if (focus) first?.focus();
  }
}
customElements.define('vf-search', VfSearch);
