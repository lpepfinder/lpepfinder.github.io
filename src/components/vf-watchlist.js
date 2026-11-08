import { load, EVENT } from '../lib/watch/store.js';
import { due, check } from '../lib/watch/check.js';
import { tn, t } from './i18n.js';

/**
 * <vf-watchlist> in the tab bar of every page: the profile tab (/me/, with the watchlist) with the number of
 * unseen changes (<vf-watch-count count="2">, hidden at 0), or of records just added. Runs the daily check, at most
 * once a day and only with a non-empty list. status="checking|done".
 */
export class VfWatchlist extends HTMLElement {
  connectedCallback() {
    this.link = this.querySelector('a');
    this.count = this.querySelector('vf-watch-count');
    this.render = this.render.bind(this);
    addEventListener(EVENT, this.render);
    this.render();
    if (!due()) return;
    this.setAttribute('status', 'checking');
    const run = () => check().catch(() => {}).finally(() => this.setAttribute('status', 'done'));
    'requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 500);
  }

  disconnectedCallback() { removeEventListener(EVENT, this.render); }

  /** Unseen changes; without any, the records added since the last visit as "+2" (kind="added"). */
  render() {
    const list = load();
    const n = list.changes.length;
    const added = n ? 0 : list.fresh || 0;
    this.count.setAttribute('count', n || added);
    this.count.setAttribute('kind', added ? 'added' : 'changes');
    this.count.textContent = n || (added ? `+${added}` : '');
    // the accessible name starts with the visible tab label
    const label = this.link.querySelector('span')?.textContent || t('watch.nav');
    if (n || added) this.link.setAttribute('aria-label', `${label}, ${n ? tn('watch.changesShort', n) : tn('watch.addedShort', added)}`);
    else this.link.removeAttribute('aria-label');
  }
}
customElements.define('vf-watchlist', VfWatchlist);
