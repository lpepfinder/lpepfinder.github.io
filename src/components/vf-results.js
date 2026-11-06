import { t, tn, formatNumber } from './i18n.js';
import { addToGroups, groupView, orderGroups, totals } from '../lib/search/group.js';
import { region, rates, comparable, currency, CURRENCY_EVENT } from './viewer.js';
import { el, attrs, listen, unlisten } from './dom.js';
import './vf-filters.js';
import './vf-release.js';
import './vf-ad.js';
import { ReleaseDetail } from './release-detail.js';
import { selectKey } from './release-parts.js';

/**
 * <vf-results> renders search results, grouped by release, into its server-rendered markup.
 * Attribute status="idle|loading|done|empty|error" drives the CSS; covers="on|off".
 * Only the <output> is live, and it holds a short status text, never the list.
 * Fires "more" (show more) and "retry" (index error) events.
 */
export class VfResults extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  connectedCallback() {
    // after client-side navigation, the new page's elements upgrade parent first: ready the ones used here
    customElements.upgrade(this);
    this.heading = this.querySelector('vf-results-bar h2');
    this.countLine = this.querySelector('vf-results-bar p');
    this.filters = this.querySelector('vf-filters');
    this.note = this.querySelector('vf-note[reason="filtered"]');
    this.live = this.querySelector('output');
    this.list = this.querySelector('ol');
    this.moreButton = this.querySelector('button[name="more"]');
    this.empty = this.querySelector('vf-empty[reason="no-match"] h2');
    this.groups = new Map();
    this.ad = this.querySelector('template[data-ad="results"]');
    this.adEvery = Number(this.getAttribute('ad-every')) || 24;
    this.details = new ReleaseDetail(this);
    this.moreButton.addEventListener('click', () => this.dispatchEvent(new Event('more')));
    this.shareButton = this.querySelector('vf-sheet[name="filters"] button[name="share"]');
    this.filterSheet = this.querySelector('vf-sheet[name="filters"]');
    this.filterButtons = [...this.querySelectorAll('button[name="filters"]')];
    for (const b of this.filterButtons) b.addEventListener('click', () => this.filterSheet.open());
    this.showButton = this.filterSheet.querySelector('footer button[value="close"]');
    this.native = !!navigator.share && matchMedia('(pointer: coarse)').matches;
    if (this.native) this.shareButton.textContent = t('results.shareLink');
    this.shareButton.addEventListener('click', () => this.share());
    this.querySelector('button[name="retry"]')?.addEventListener('click', () => this.dispatchEvent(new Event('retry')));
    listen(this, window, CURRENCY_EVENT, () => { if (this.groups.size) this.render(true); });
    this.filters.addEventListener('filters', () => {
      this.render(true);
      this.live.textContent = this.countLine.textContent;
    });
  }

  set status(value) {
    this.setAttribute('status', value);
    this.setAttribute('aria-busy', String(value === 'loading'));
  }

  idle() {
    this.list.replaceChildren();
    this.live.textContent = '';
    this.status = 'idle';
  }

  loading() {
    this.list.replaceChildren();
    this.moreButton.hidden = true;
    this.live.textContent = t('searching');
    this.status = 'loading';
  }

  /** New result set: heading, empty list. total: matched copies. */
  start(query, total) {
    this.total = total;
    this.shown = 0;
    this.groups = new Map();
    this.list.replaceChildren();
    this.details.reset();
    this.querySelector('vf-suggest').hidden = true;
    this.heading.textContent = t('results.heading', { query });
    this.empty.textContent = t('emptyTitle', { query });
    this.live.textContent = total ? '' : this.empty.textContent;
    this.status = total ? 'done' : 'empty';
  }

  /** A link with ?r=: open its release once loaded (more: load the next page, hasMore: () => bool). */
  restore(more, hasMore) { return this.details.restore(more, hasMore); }

  /** Add one page of records: new releases are appended, known ones grow in place. Returns the first new row. */
  async append(records, shown) {
    this.rates = await rates();
    this.shown = shown;
    const { added, grown } = addToGroups(this.groups, records);
    const first = this.render(false, new Set([...added, ...grown]));
    this.moreButton.hidden = shown >= this.total;
    this.live.textContent = t('showingOf', { shown: formatNumber(shown), total: formatNumber(this.total) });
    return first;
  }

  options() {
    const f = this.filters.value;
    const value = (o) => comparable(o.price, o.currency, this.rates);
    return { filters: f, sort: { country: region, near: f.near, value } };
  }

  /**
   * Draw the groups. full: every row, in order (after a filter change). Otherwise only `changed`
   * groups: visible rows update in place, new ones are appended. Returns the summary of the first appended (else updated) row.
   */
  render(full, changed = new Set()) {
    const { filters, sort } = this.options();
    this.setAttribute('covers', filters.covers ? 'on' : 'off');
    const views = [];
    const byFormat = new Map();
    for (const group of this.groups.values()) {
      const view = groupView(group, filters, sort);
      if (view) views.push({ group, ...view });
      for (const o of group.offers) if (o.format && (!filters.inStock || o.available)) byFormat.set(o.format, (byFormat.get(o.format) || 0) + 1);
    }
    const ordered = orderGroups(views, filters.near);
    const fresh = [];
    const touched = [];
    ordered.forEach((v, index) => {
      if (!full && !changed.has(v.group)) return;
      if (!v.group.row) {
        v.group.row = el('vf-release');
        this.details.add(selectKey(v.group), v.group);
      }
      v.group.row.view = { group: v.group, view: v, rates: this.rates, covers: filters.covers, index };
      (v.group.row.isConnected ? touched : fresh).push(v.group.row);
    });
    if (full) this.list.replaceChildren(...ordered.map((v) => el('li', {}, v.group.row)));
    else this.list.append(...fresh.map((row) => el('li', {}, row)));
    this.placeAds();
    this.filters.counts(byFormat);
    this.count(views);
    this.details.draw();
    return full ? null : (fresh[0] || touched[0])?.querySelector(':scope > a');
  }

  /** With an ad unit configured: one fixed-height <vf-ad> after every `ad-every` rows (a page). */
  placeAds() {
    if (!this.ad) return;
    const rows = [...this.list.children].filter((li) => !li.hasAttribute('role'));
    for (let i = this.adEvery - 1; i < rows.length - 1; i += this.adEvery) {
      if (rows[i].nextElementSibling?.hasAttribute('role')) continue;
      rows[i].after(attrs(el('li', {}, this.ad.content.cloneNode(true)), { role: 'none' }));
    }
  }

  /** "312 records · 1,204 copies at 87 shops", and how many were found in all while more can be loaded. */
  count(views) {
    const n = totals(views);
    const line = t('results.countLine', { records: tn('results.records', n.records), copies: tn('results.copies', n.copies), shops: tn('results.shops', n.shops) });
    this.countLine.textContent = this.shown < this.total ? t('results.countPartial', { line, total: formatNumber(this.total) }) : line;
    this.labelFilters(n.records);
    this.note.hidden = views.length > 0;
  }

  /** "Filters · 2" in the results bar, "Filters · 2 · EUR" on the phone pill, "Show 312 records" in the sheet. */
  labelFilters(records) {
    const active = this.filters.active;
    const [bar, pill] = this.filterButtons;
    bar.querySelector('span').textContent = [t('results.filters'), active && formatNumber(active)].filter(Boolean).join(' · ');
    pill.querySelector('span').textContent = [t('results.filters'), active && formatNumber(active), currency()].filter(Boolean).join(' · ');
    this.showButton.textContent = tn('results.showRecords', records);
  }

  /** On an empty result: "Did you mean <a>tatsuro yamashita</a>?" and "Without “x”: <a>12 copies</a>". */
  suggest({ spelling, without }) {
    const box = this.querySelector('vf-suggest');
    const href = (q) => {
      const url = new URL(location.href);
      url.searchParams.set('q', q);
      return url.pathname + url.search;
    };
    const sentence = (text, link) => {
      const [before, after = ''] = text.split('\u0000');
      return el('p', {}, before, link, after);
    };
    box.replaceChildren(...[
      spelling && sentence(t('results.didYouMean', { query: '\u0000' }), el('a', { href: href(spelling), textContent: spelling })),
      without && sentence(t('results.without', { word: without.word, link: '\u0000' }), el('a', { href: href(without.query), textContent: tn('results.copies', without.count) })),
    ].filter(Boolean));
    box.hidden = !box.childElementCount;
    if (!box.hidden) this.live.textContent = [`${this.empty.textContent}.`, ...[...box.children].map((p) => p.textContent)].join(' ');
  }

  /** Copy link (or the share sheet on phones) for this search, with its filters. */
  async share() {
    try {
      if (this.native) return await navigator.share({ title: document.title, url: location.href });
      await navigator.clipboard.writeText(location.href);
      this.live.textContent = t('results.linkCopied');
    } catch { /* dismissed or blocked: nothing to say */ }
  }

  error() {
    this.live.textContent = t('indexError');
    this.status = 'error';
  }

  /** Focus the heading of the current state (after an explicit search). */
  focusHeading() {
    const where = { done: 'vf-results-bar', empty: 'vf-empty[reason="no-match"]', error: 'vf-empty[reason="index-error"]' };
    const selector = where[this.getAttribute('status')];
    if (selector) this.querySelector(`${selector} h2`).focus();
  }
}
customElements.define('vf-results', VfResults);
