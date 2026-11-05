import { load, EVENT } from '../lib/watch/store.js';
import { due, check } from '../lib/watch/check.js';
import { tn, t } from './i18n.js';

/**
 * <vf-watchlist> in the header of every page: the link to /watch/ with the number of
 * unseen changes (<vf-watch-count count="2">, hidden at 0). Runs the daily check, at most
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

  render() {
    const n = load().changes.length;
    this.count.setAttribute('count', n);
    this.count.textContent = n || '';
    this.link.setAttribute('aria-label', n ? tn('watch.navCount', n) : t('watch.nav'));
  }
}
customElements.define('vf-watchlist', VfWatchlist);
