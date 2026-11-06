import { load, update, today } from '../lib/watch/store.js';
import { due, check } from '../lib/watch/check.js';
import { state } from '../lib/watch/diff.js';
import * as data from '../lib/watch/data.js';
import { catalogKeys, mergeRows } from '../lib/watch/wants.js';
import { hits, sortHits, baskets } from '../lib/watch/hits.js';
import { reach } from '../lib/watch/reach.js';
import config from '../../data/watch.json' with { type: 'json' };
import { changesByDay, hitRow, shopRow } from './watch-views.js';
import { WatchShopPane } from './watch-shop-pane.js';
import { WatchRecordPane } from './watch-record-pane.js';
import { t, tn, formatNumber, formatDay } from './i18n.js';
import { rates, currency, region, comparable, CURRENCY_EVENT } from './viewer.js';
import { convert } from '../lib/currency.js';
import { readFilters, saveFilters } from './watch-filters.js';
import './vf-watch-all.js';
import './vf-watch-import.js';

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const MAX_PAST = 100;
const VIEWS = ['available', 'now', 'changes', 'all'];

/**
 * <vf-watch-page status="idle|checking|done" view="available|now|changes|all" empty>: a start screen
 * while the list is empty (Discogs import); else a header (summary, Discogs and "Prices in" sheets),
 * tabs with counts, filter chips (sort, ships to me, no customs, max price) and four views (?view=…):
 * records in stock (<vf-watch-available>, new ones first, a record's copies open in the detail pane),
 * shops by how many of your records they have (<vf-watch-now>, a shop opens in a sheet or the right pane),
 * changes by day, and every record (<vf-watch-all>, with backup and share).
 * Wants imported from Discogs also match by catalog number (wants.js).
 * Current states come from the `now` shards, fetched once per data build with a progress bar.
 * Changes are marked seen when the page is left.
 */
export class VfWatchPage extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector(':scope > output');
    this.summary = this.querySelector('vf-watch-summary');
    this.progress = this.querySelector(':scope > vf-progress');
    this.views = Object.fromEntries(VIEWS.map((v) => [v, this.querySelector(`vf-watch-${v}`)]));
    this.form = this.querySelector('vf-watch-filters form');
    this.search = this.getAttribute('search') || '/';
    this.views.all.setAttribute('search', this.search);
    this.shops = new Map();
    this.zones = [];
    this.rows = {};
    this.rates = {};
    this.shopIds = [];
    this.limit = config.pageSize;
    this.pane = new WatchShopPane(this.views.now, this);
    this.record = new WatchRecordPane(this.views.available, this);
    this.discogsButton = this.querySelector('button[name="discogs"]');
    this.discogsButton.addEventListener('click', () => this.querySelector('vf-sheet[name="discogs"]').open());
    addEventListener('vf-watch-imported', () => this.labelDiscogs());
    this.labelDiscogs();
    this.currencyButton = this.querySelector('button[name="currency"]');
    this.currencyButton.addEventListener('click', () => this.querySelector('vf-sheet[name="currency"]').open());
    this.labelCurrency();
    this.setupFilters();
    this.views.available.querySelector('vf-watch-hits > button[name="more"]').addEventListener('click', () => {
      this.limit += config.pageSize;
      this.renderAvailable(true);
    });
    this.querySelector(':scope > nav').addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      history.pushState(null, '', a.href);
      this.show(true);
    });
    addEventListener('popstate', () => this.show(false));
    addEventListener(data.PROGRESS, (e) => this.step(e.detail));
    addEventListener(CURRENCY_EVENT, () => { this.labelCurrency(); this.renderChanges(); this.renderHits(); });
    const leave = () => this.markSeen();
    addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
    // "new" means found in stock since the visit before this one, at least the last config.newDays days
    const visit = load().visit;
    this.newSince = [visit, daysAgo(config.newDays)].filter(Boolean).sort()[0];
    update((list) => { list.fresh = 0; if (list.visit !== today()) list.visit = today(); });
    this.show(false);
    this.views.all.refresh();
    this.renderChanges();
    this.renderSummary();
    this.refresh();
  }

  /** Sort and filters: kept in this browser, applied as they change. */
  setupFilters() {
    const saved = readFilters();
    for (const [name, value] of Object.entries(saved)) {
      const field = this.form.elements[name];
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = !!value; else field.value = value ?? '';
    }
    this.form.addEventListener('submit', (e) => e.preventDefault());
    this.form.addEventListener('input', () => {
      saveFilters(this.filterValues());
      this.limit = config.pageSize;
      this.renderHits();
    });
    this.labelMax();
  }

  filterValues() {
    const f = this.form.elements;
    return { sort: f.sort.value, ships: f.ships.checked, customs: f.customs.checked, max: f.max.value };
  }

  /** The max price is typed in the "Prices in" currency (euros in shop mode); compared in euro cents. */
  maxValue(raw) {
    const n = parseFloat(String(raw).replace(',', '.'));
    if (!(n > 0)) return null;
    const cents = Math.round(n * 100);
    const cur = currency() || 'EUR';
    return cur === 'EUR' ? cents : convert(cents, cur, 'EUR', this.rates) ?? cents;
  }

  labelMax() {
    this.form.querySelector('vf-currency-code').textContent = currency() || 'EUR';
  }

  /** The view in the URL; focus its heading when the reader picked it. */
  show(focus) {
    const view = new URLSearchParams(location.search).get('view');
    const current = VIEWS.includes(view) ? view : VIEWS[0];
    this.setAttribute('view', current);
    for (const v of VIEWS) this.views[v].hidden = v !== current;
    for (const a of this.querySelectorAll(':scope > nav a')) {
      if (new URL(a.href).searchParams.get('view') === current) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    this.pane?.fromUrl();
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
    const { items } = load();
    const keys = Object.keys(items);
    const [table, cat] = await Promise.all([rates(), data.cat(keys.map((k) => items[k].c).filter(Boolean)), this.loadShops()]);
    this.rates = table;
    // wants found by catalog number under other titles: their keys count as the want's
    const extra = catalogKeys(items, cat);
    const all = [...new Set([...keys, ...Object.values(extra).flat()])];
    const [rows, shopIds] = await Promise.all([all.length ? data.now(all) : {}, data.shops()]);
    const value = (cents, cur) => comparable(cents, cur, table);
    this.rows = Object.fromEntries(keys.map((k) => [k, mergeRows([rows[k], ...(extra[k] || []).map((x) => rows[x])], value)]).filter(([, r]) => r));
    this.shopIds = shopIds;
    const { refreshed } = load();
    if (refreshed !== today() || keys.some((k) => !items[k].s)) {
      update((list) => {
        for (const [key, it] of Object.entries(list.items)) {
          const next = state(this.rows[key]);
          // found again: in stock now, out of stock at the last check
          if (it.s && !it.s[0] && next[0]) it.f = today();
          it.s = next;
          if (extra[key]) it.x = extra[key]; else delete it.x;
        }
        list.refreshed = today();
      });
    }
    this.progress.hidden = true;
    this.renderChanges();
    this.renderHits();
    this.views.all.refresh();
    this.renderSummary();
    this.setAttribute('status', 'done');
    if (keys.length) this.live.textContent = t('watchPage.checked');
  }

  /** Shop names, links, countries and shipping from the search index; customs zones. */
  async loadShops() {
    if (this.shops.size) return;
    const [rows, regions] = await Promise.all([
      fetch('/search/shops.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/regions.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    this.zones = regions?.zones || [];
    this.shops = new Map(rows.map(([id, name, origin, country, currency, , shipsTo]) => [id, { name, origin, country, currency, shipsTo: shipsTo || [] }]));
  }

  /** Records in stock under the filters, sorted; the shops view groups the same records by shop. */
  renderHits() {
    const f = this.filterValues();
    this.labelMax();
    const list = hits({
      items: load().items, rows: this.rows, shopIds: this.shopIds, shops: this.shops,
      value: (cents, cur) => comparable(cents, cur, this.rates),
      reachOf: (shop) => reach(shop, region, this.zones),
      filters: { ships: f.ships, customs: f.customs, max: this.maxValue(f.max) },
    });
    this.hits = sortHits(list, f.sort);
    this.renderAvailable(false);
    const groups = baskets(this.hits);
    const box = this.views.now;
    box.querySelector('vf-watch-shops ul').replaceChildren(...groups.map((b) => shopRow(b, this.rates)));
    box.setAttribute('count', groups.length);
    this.pane.set(groups);
    this.renderTabs(groups.length);
  }

  /**
   * Records in stock. Sorted by newest, those found since the last visit get their own section first;
   * the rest come a page at a time ("Show more" adds the next one and moves the focus to it).
   */
  renderAvailable(more) {
    const box = this.views.available;
    const isNew = (h) => !!h.it.f && h.it.f >= this.newSince;
    const byNew = this.form.elements.sort.value === 'new';
    const fresh = byNew ? this.hits.filter(isNew) : [];
    const rest = byNew ? this.hits.filter((h) => !isNew(h)) : this.hits;
    const [newSection, restSection] = box.querySelectorAll('vf-watch-hits > section');
    const ol = restSection.querySelector('ol');
    const row = (h, index) => hitRow(h, { rates: this.rates, newSince: this.newSince, index });
    if (!more) newSection.querySelector('ol').replaceChildren(...fresh.map(row));
    newSection.hidden = !fresh.length;
    restSection.querySelector('h3').hidden = !fresh.length;
    const from = more ? ol.children.length : 0;
    const rows = rest.slice(from, Math.max(from, this.limit - fresh.length)).map((h, i) => row(h, fresh.length + from + i));
    if (more) ol.append(...rows); else ol.replaceChildren(...rows);
    box.setAttribute('count', this.hits.length);
    const shown = fresh.length + ol.children.length;
    const left = this.hits.length - shown;
    const button = box.querySelector('vf-watch-hits > button[name="more"]');
    button.hidden = left <= 0;
    button.textContent = tn('watchPage.showMore', Math.min(left, config.pageSize));
    box.querySelector('vf-watch-showing').textContent = left > 0
      ? t('watchPage.showing', { shown: formatNumber(shown), total: formatNumber(this.hits.length) }) : '';
    if (more) rows[0]?.querySelector('a')?.focus();
    else this.record.set([...fresh, ...rest].map((h) => h.key));
  }

  /** Counts on the tabs: records in stock, shops, unseen changes, everything watched. */
  renderTabs(shops) {
    const { items, changes } = load();
    const counts = { available: this.hits?.length, now: shops, changes: changes.length || null, all: Object.keys(items).length };
    for (const a of this.querySelectorAll(':scope > nav a[view]')) {
      const n = counts[a.getAttribute('view')];
      const data = a.querySelector('data');
      data.value = n ?? '';
      data.textContent = n ? formatNumber(n) : '';
    }
  }

  /** The Discogs button: "Discogs · username" once a wantlist was imported. */
  labelDiscogs() {
    let user = '';
    try { user = localStorage.getItem('vf.discogs.user') || ''; } catch {}
    this.discogsButton.querySelector('span').textContent = user ? t('watchPage.discogsSynced', { user }) : t('watchPage.discogsButton');
  }

  /** "412 of 10,214 in stock at 96 shops · 7 new". */
  renderSummary() {
    const { items, changes } = load();
    const n = Object.keys(items).length;
    const available = Object.keys(items).filter((k) => this.rows[k]?.[0] > 0 || (!this.rows[k] && items[k].s?.[0] > 0)).length;
    const shops = new Set();
    for (const row of Object.values(this.rows)) if (row[0] && row[4]) for (let i = 0; i < row[4].length; i += 2) shops.add(row[4][i]);
    const fresh = Object.values(items).filter((it) => it.f && it.f >= this.newSince && it.s?.[0]).length;
    const since = changes.map((c) => c[8]).filter(Boolean).sort()[0];
    const parts = [n ? tn('watchPage.summaryStock', n, { available: formatNumber(available), shops: tn('results.shops', shops.size) }) : tn('watchPage.summaryWatched', n)];
    if (fresh) parts.push(tn('watchPage.summaryNew', fresh));
    else if (changes.length && since) parts.push(tn('watchPage.summaryChanges', changes.length, { date: formatDay(since.slice(0, 10)) }));
    this.summary.textContent = parts.join(' · ');
    this.toggleAttribute('empty', !n);
    this.renderTabs(this.views.now.getAttribute('count') * 1 || null);
  }

  renderChanges() {
    const list = load();
    const box = this.views.changes;
    box.querySelector('vf-watch-days').replaceChildren(...changesByDay(list, this.shops, this.rates));
    box.setAttribute('count', list.changes.length + list.past.length);
  }

  /** The currency button: "Prices in · EUR". */
  labelCurrency() {
    // the code alone on the button ("GBP"), the full words for screen readers
    this.currencyButton.querySelector('span').textContent = currency() || t('currency.shop');
    this.currencyButton.setAttribute('aria-label', `${t('currency.label')} · ${currency() || t('currency.shop')}`);
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
