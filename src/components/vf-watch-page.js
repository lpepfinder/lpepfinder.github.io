import { load, update, today } from '../lib/watch/store.js';
import { due, check } from '../lib/watch/check.js';
import { state } from '../lib/watch/diff.js';
import * as data from '../lib/watch/data.js';
import { changesByDay, byShop, shopGroup } from './watch-views.js';
import { t, tn, formatNumber, formatDay } from './i18n.js';
import './vf-watch-all.js';

const MAX_PAST = 100;
const VIEWS = ['changes', 'now', 'all'];

/**
 * <vf-watch-page status="idle|checking|done" view="changes|now|all">: a summary line, then three
 * views chosen by links (?view=…, aria-current="page"): changes by day (<vf-watch-changes>),
 * records in stock now by shop (<vf-watch-now>), and every record (<vf-watch-all>).
 * Current states come from the `now` shards, fetched once per data build with a progress bar.
 * Changes are marked seen when the page is left.
 */
export class VfWatchPage extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector(':scope > output');
    this.summary = this.querySelector('vf-watch-summary');
    this.progress = this.querySelector('vf-progress');
    this.views = Object.fromEntries(VIEWS.map((v) => [v, this.querySelector(`vf-watch-${v}`)]));
    this.search = this.getAttribute('search') || '/';
    this.views.all.setAttribute('search', this.search);
    this.shops = new Map();
    this.rows = {};
    this.shopIds = [];
    this.querySelector('nav').addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      history.pushState(null, '', a.href);
      this.show(true);
    });
    addEventListener('popstate', () => this.show(false));
    addEventListener(data.PROGRESS, (e) => this.step(e.detail));
    const leave = () => this.markSeen();
    addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
    this.show(false);
    this.views.all.refresh();
    this.renderChanges();
    this.renderSummary();
    this.refresh();
  }

  /** The view in the URL; focus its heading when the reader picked it. */
  show(focus) {
    const view = new URLSearchParams(location.search).get('view');
    const current = VIEWS.includes(view) ? view : VIEWS[0];
    this.setAttribute('view', current);
    for (const v of VIEWS) this.views[v].hidden = v !== current;
    for (const a of this.querySelectorAll('nav a')) {
      if (new URL(a.href).searchParams.get('view') === current) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (focus) this.views[current].querySelector('h2').focus();
  }

  step({ done, total }) {
    this.progress.hidden = done >= total;
    const bar = this.progress.querySelector('progress');
    bar.max = total;
    bar.value = done;
    this.progress.querySelector('label').textContent = t('watchPage.checking', { done: formatNumber(done), total: formatNumber(total) });
  }

  /** Check and load current states; calls queue up (records may be added meanwhile). */
  refresh() {
    this.queue = (this.queue || Promise.resolve()).then(() => this.run());
    return this.queue;
  }

  async run() {
    this.setAttribute('status', 'checking');
    if (due()) await check().catch(() => {});
    const keys = Object.keys(load().items);
    const [rows, shopIds] = await Promise.all([keys.length ? data.now(keys) : {}, data.shops(), this.loadShops()]);
    this.rows = rows;
    this.shopIds = shopIds;
    const { refreshed, items } = load();
    if (refreshed !== today() || keys.some((k) => !items[k].s)) {
      update((list) => {
        for (const [key, it] of Object.entries(list.items)) it.s = state(rows[key]);
        list.refreshed = today();
      });
    }
    this.progress.hidden = true;
    this.renderChanges();
    this.renderNow();
    this.views.all.refresh();
    this.renderSummary();
    this.setAttribute('status', 'done');
    if (keys.length) this.live.textContent = t('watchPage.checked');
  }

  /** Shop names, links and countries from the search index. */
  async loadShops() {
    if (this.shops.size) return;
    const rows = await fetch('/search/shops.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    this.shops = new Map(rows.map(([id, name, origin, country, currency]) => [id, { name, origin, country, currency }]));
  }

  /** "13,000 watched · 312 available now at 87 shops · 24 changes since 2 Nov". */
  renderSummary() {
    const { items, changes } = load();
    const n = Object.keys(items).length;
    const inStock = Object.entries(items).filter(([k, it]) => (this.rows[k] || it.s)?.[0] > 0).length;
    const shops = new Set();
    for (const row of Object.values(this.rows)) if (row[0] && row[4]) for (let i = 0; i < row[4].length; i += 2) shops.add(row[4][i]);
    const since = changes.map((c) => c[8]).filter(Boolean).sort()[0];
    const parts = [tn('watchPage.summaryWatched', n)];
    if (n) parts.push(tn('watchPage.summaryAvailable', inStock, { shops: tn('results.shops', shops.size) }));
    if (changes.length && since) parts.push(tn('watchPage.summaryChanges', changes.length, { date: formatDay(since.slice(0, 10)) }));
    this.summary.textContent = parts.join(' · ');
    this.summary.hidden = !n;
  }

  renderChanges() {
    const list = load();
    const box = this.views.changes;
    box.querySelector('vf-watch-days').replaceChildren(...changesByDay(list, this.shops));
    box.setAttribute('count', list.changes.length + list.past.length);
  }

  renderNow() {
    const groups = byShop(load().items, this.rows, this.shopIds, this.shops);
    const box = this.views.now;
    box.querySelector('vf-watch-shops').replaceChildren(...groups.map((g) => shopGroup(g, this.search)));
    box.setAttribute('count', groups.length);
  }

  markSeen() {
    if (!load().changes.length) return;
    update((list) => {
      list.past = [...list.past, ...list.changes].slice(-MAX_PAST);
      list.changes = [];
    });
  }
}
customElements.define('vf-watch-page', VfWatchPage);
