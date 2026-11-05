import { t, formatNumber } from './i18n.js';
import './vf-result.js';

/**
 * <vf-results> renders search results into its server-rendered markup.
 * Attribute status="idle|loading|done|empty|error" drives the CSS.
 * Only the <output> is live, and it holds a short status text, never the list.
 * Fires "more" (show more) and "retry" (index error) events.
 */
export class VfResults extends HTMLElement {
  connectedCallback() {
    this.heading = this.querySelector('vf-results-bar h2');
    this.live = this.querySelector('output');
    this.list = this.querySelector('ol');
    this.moreButton = this.querySelector('button[name="more"]');
    this.empty = this.querySelector('vf-empty[reason="no-match"] h2');
    this.moreButton.addEventListener('click', () => this.dispatchEvent(new Event('more')));
    this.querySelector('button[name="retry"]')?.addEventListener('click', () => this.dispatchEvent(new Event('retry')));
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

  /** New result set: count heading, empty list. */
  start(query, total) {
    this.total = total;
    this.list.replaceChildren();
    this.heading.textContent = t('resultsCount', { count: formatNumber(total), query });
    this.empty.textContent = t('emptyTitle', { query });
    this.live.textContent = total ? '' : this.empty.textContent;
    this.status = total ? 'done' : 'empty';
  }

  /** Append one page of records; returns the first new link. */
  append(records, shown) {
    const items = records.map((r) => {
      const result = document.createElement('vf-result');
      result.record = r;
      const li = document.createElement('li');
      li.append(result);
      return li;
    });
    this.list.append(...items);
    this.moreButton.hidden = shown >= this.total;
    this.live.textContent = t('showingOf', { shown: formatNumber(shown), total: formatNumber(this.total) });
    return items[0]?.querySelector('a');
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
