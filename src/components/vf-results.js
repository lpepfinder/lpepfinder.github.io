import { t, tn, formatNumber } from './i18n.js';
import { addToGroups, groupView, orderGroups, totals } from '../lib/search/group.js';
import { region, rates, comparable } from './viewer.js';
import { el } from './dom.js';
import './vf-filters.js';
import './vf-release.js';

/**
 * <vf-results> renders search results, grouped by release, into its server-rendered markup.
 * Attribute status="idle|loading|done|empty|error" drives the CSS; covers="on|off".
 * Only the <output> is live, and it holds a short status text, never the list.
 * Fires "more" (show more) and "retry" (index error) events.
 */
export class VfResults extends HTMLElement {
  connectedCallback() {
    this.heading = this.querySelector('vf-results-bar h2');
    this.countLine = this.querySelector('vf-results-bar p');
    this.filters = this.querySelector('vf-filters');
    this.note = this.querySelector('vf-note[reason="filtered"]');
    this.live = this.querySelector('output');
    this.list = this.querySelector('ol');
    this.moreButton = this.querySelector('button[name="more"]');
    this.empty = this.querySelector('vf-empty[reason="no-match"] h2');
    this.groups = new Map();
    this.moreButton.addEventListener('click', () => this.dispatchEvent(new Event('more')));
    this.querySelector('button[name="retry"]')?.addEventListener('click', () => this.dispatchEvent(new Event('retry')));
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
    this.heading.textContent = t('results.heading', { query });
    this.empty.textContent = t('emptyTitle', { query });
    this.live.textContent = total ? '' : this.empty.textContent;
    this.status = total ? 'done' : 'empty';
  }

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
      if (!v.group.row) v.group.row = el('vf-release');
      v.group.row.view = { group: v.group, view: v, rates: this.rates, covers: filters.covers, index };
      (v.group.row.isConnected ? touched : fresh).push(v.group.row);
    });
    if (full) this.list.replaceChildren(...ordered.map((v) => el('li', {}, v.group.row)));
    else this.list.append(...fresh.map((row) => el('li', {}, row)));
    this.filters.counts(byFormat);
    this.count(views);
    return full ? null : (fresh[0] || touched[0])?.querySelector('summary');
  }

  /** "312 records · 1,204 copies at 87 shops", and how many were found in all while more can be loaded. */
  count(views) {
    const n = totals(views);
    const line = t('results.countLine', { records: tn('results.records', n.records), copies: tn('results.copies', n.copies), shops: tn('results.shops', n.shops) });
    this.countLine.textContent = this.shown < this.total ? t('results.countPartial', { line, total: formatNumber(this.total) }) : line;
    this.note.hidden = views.length > 0;
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
