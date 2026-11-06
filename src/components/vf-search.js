import { SearchClient } from '../lib/search/client.js';
import { t } from './i18n.js';
import { addRecent } from './recent.js';
import './vf-results.js';

/** Slices one page may load at most, so a query of one record in thousands of copies stays bounded. */
const MAX_SLICES = 10;

/**
 * <vf-search> enhances a server-rendered GET form. When the page has a
 * <vf-results> region it runs the query in the browser; elsewhere the form
 * simply submits to the home page.
 */
export class VfSearch extends HTMLElement {
  connectedCallback() {
    // "/" focuses the search box (keyboards), unless the reader is typing somewhere
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      this.querySelector('input[name="q"]').focus();
    });
    this.results = document.querySelector('vf-results');
    if (!this.results) return;
    this.client = new SearchClient(this.getAttribute('index') || '/search/');
    this.form = this.querySelector('form');
    this.input = this.form.querySelector('input[name="q"]');
    this.per = Number(this.getAttribute('per-page')) || 30;
    this.releasesPer = Number(this.getAttribute('releases-per-page')) || 24;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.run(this.input.value, { push: true, submitted: true }); });
    this.results.addEventListener('more', () => this.more(true));
    this.results.addEventListener('retry', () => { this.client = new SearchClient(this.client.base); this.run(this.input.value, { submitted: true }); });
    // back/forward: search again only when the query changed (not for ?r= of a release)
    window.addEventListener('popstate', () => {
      if ((new URLSearchParams(location.search).get('q') || '').trim() !== this.query) this.fromUrl();
    });
    this.fromUrl();
  }

  fromUrl() {
    const q = new URLSearchParams(location.search).get('q') || '';
    this.input.value = q;
    this.run(q, {});
  }

  async run(query, { push = false, submitted = false }) {
    const q = query.trim();
    this.query = q;
    if (push) {
      const url = new URL(location.href);
      q ? url.searchParams.set('q', q) : url.searchParams.delete('q');
      url.searchParams.delete('r');
      history.pushState(null, '', url);
    }
    this.setAttribute('status', q ? 'loading' : 'idle');
    document.querySelector('vf-app')?.setAttribute('mode', q ? 'results' : 'home');
    if (!q) { this.results.idle(); return; }
    document.title = t('searchTitle', { query: q });
    this.results.loading();
    try {
      this.ids = await this.client.rank(await this.client.match(q), q, this.per);
      this.shown = 0;
      this.results.checked = this.client.meta?.builtAt;
      this.results.start(q, this.ids.length);
      if (this.ids.length) {
        await this.more(false);
        await this.results.restore(() => this.more(false), () => this.shown < this.ids.length);
      }
      else this.results.suggest(await this.client.suggest(q).catch(() => ({})));
    } catch (err) {
      console.error(err);
      this.results.error();
    }
    this.setAttribute('status', this.results.getAttribute('status'));
    if (submitted) { this.input.blur(); this.results.focusHeading(); }
    if (this.ids?.length) addRecent(q);
    window.umami?.track?.('search', { q, results: this.ids?.length ?? -1 });
  }

  /**
   * Next page: slices of `per-page` records (regrouped by release) until the page adds
   * `releases-per-page` releases or the matches run out, so a page is never one popular record.
   * After "show more", focus the first new row.
   */
  async more(focus) {
    const before = this.results.groups.size;
    let first = null;
    for (let i = 0; i < MAX_SLICES && this.shown < this.ids.length; i++) {
      const slice = this.ids.slice(this.shown, this.shown + this.per);
      this.shown += slice.length;
      first ??= await this.results.append(await this.client.records(slice), this.shown);
      if (this.results.groups.size - before >= this.releasesPer) break;
    }
    if (focus) first?.focus();
  }
}
customElements.define('vf-search', VfSearch);
