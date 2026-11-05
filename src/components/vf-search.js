import { SearchClient } from '../lib/search/client.js';
import { t } from './i18n.js';
import './vf-results.js';

/**
 * <vf-search> enhances a server-rendered GET form. When the page has a
 * <vf-results> region it runs the query in the browser; elsewhere the form
 * simply submits to the home page.
 */
export class VfSearch extends HTMLElement {
  connectedCallback() {
    this.results = document.querySelector('vf-results');
    if (!this.results) return;
    this.client = new SearchClient(this.getAttribute('index') || '/search/');
    this.form = this.querySelector('form');
    this.input = this.form.querySelector('input[name="q"]');
    this.per = Number(this.getAttribute('per-page')) || 30;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.run(this.input.value, { push: true, submitted: true }); });
    this.results.addEventListener('more', () => this.more(true));
    this.results.addEventListener('retry', () => { this.client = new SearchClient(this.client.base); this.run(this.input.value, { submitted: true }); });
    window.addEventListener('popstate', () => this.fromUrl());
    this.fromUrl();
  }

  fromUrl() {
    const q = new URLSearchParams(location.search).get('q') || '';
    this.input.value = q;
    this.run(q, {});
  }

  async run(query, { push = false, submitted = false }) {
    const q = query.trim();
    if (push) {
      const url = new URL(location.href);
      q ? url.searchParams.set('q', q) : url.searchParams.delete('q');
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
      this.results.start(q, this.ids.length, this.client.soldOut(this.ids));
      await this.more(false);
    } catch (err) {
      console.error(err);
      this.results.error();
    }
    this.setAttribute('status', this.results.getAttribute('status'));
    if (submitted) { this.input.blur(); this.results.focusHeading(); }
    window.umami?.track?.('search', { q, results: this.ids?.length ?? -1 });
  }

  /** Next page of records; after "show more", focus the first new result. */
  async more(focus) {
    const slice = this.ids.slice(this.shown, this.shown + this.per);
    if (!slice.length) return;
    this.shown += slice.length;
    const first = this.results.append(await this.client.records(slice), this.shown);
    if (focus) first?.focus();
  }
}
customElements.define('vf-search', VfSearch);
