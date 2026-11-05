import { load, update, remove, today, EVENT } from '../lib/watch/store.js';
import { due, check } from '../lib/watch/check.js';
import { state } from '../lib/watch/diff.js';
import * as data from '../lib/watch/data.js';
import { change, item, stock } from './watch-render.js';
import { t, tn } from './i18n.js';

const MAX_PAST = 100;
const ORDER = { in: 0, out: 1, none: 2, unknown: 3 };

/**
 * <vf-watch-page status="idle|checking|done">: the changes since the last visit
 * (<vf-watch-changes count>) and the watched records (<vf-watch-items count>) with their
 * current state from the `now` shards. Changes are marked seen when the page is left.
 */
export class VfWatchPage extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector(':scope > output');
    this.changes = this.querySelector('vf-watch-changes');
    this.items = this.querySelector('vf-watch-items');
    this.progress = this.items.querySelector('progress');
    this.search = this.getAttribute('search') || '/';
    this.shops = new Map();
    this.renderItems = this.renderItems.bind(this);
    addEventListener(EVENT, this.renderItems);
    this.items.addEventListener('click', (e) => {
      const button = e.target.closest('button[name="remove"]');
      if (button) this.remove(button);
    });
    const leave = () => this.markSeen();
    addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
    this.renderItems();
    this.renderChanges();
    this.refresh();
  }

  /** Check and load current states; calls queue up (records may be added meanwhile). */
  refresh() {
    this.queue = (this.queue || Promise.resolve()).then(() => this.run());
    return this.queue;
  }

  async run() {
    this.setAttribute('status', 'checking');
    if (due()) await check().catch(() => {});
    const { items, refreshed } = load();
    const all = Object.keys(items);
    // once a day for all records, else only for records added without a state
    const keys = new Set(refreshed === today() ? all.filter((k) => !items[k].s) : all);
    if (keys.size) {
      this.progress.hidden = false;
      const found = await data.now([...keys], (done, total) => { this.progress.max = total; this.progress.value = done; });
      update((list) => {
        for (const [key, it] of Object.entries(list.items)) {
          if (!keys.has(key)) continue;
          it.s = state(found[key]);
          if (!it.t && found[key]) it.t = found[key][4];
        }
        list.refreshed = today();
      });
      this.progress.hidden = true;
    }
    await this.loadShops();
    this.renderChanges();
    this.setAttribute('status', 'done');
    if (all.length) this.live.textContent = t('watchPage.checked');
  }

  /** Shop names and countries from the search index, for the change rows. */
  async loadShops() {
    const list = load();
    if (![...list.changes, ...list.past].some((c) => c[7])) return;
    const rows = await fetch('/search/shops.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    this.shops = new Map(rows.map(([id, name, , country]) => [id, { name, country }]));
  }

  renderChanges() {
    const { changes, past } = load();
    const [now, earlier] = this.changes.querySelectorAll('ol');
    now.replaceChildren(...[...changes].reverse().map((c) => change(c, this.shops, false)));
    earlier.replaceChildren(...[...past].reverse().map((c) => change(c, this.shops, true)));
    this.changes.setAttribute('count', changes.length);
    this.changes.setAttribute('earlier', past.length);
  }

  renderItems() {
    const entries = Object.entries(load().items)
      .sort(([, a], [, b]) => ORDER[stock(a.s)] - ORDER[stock(b.s)] || (b.a || '').localeCompare(a.a || ''));
    this.items.querySelector('ol').replaceChildren(...entries.map(([key, it]) => item(key, it, this.search)));
    this.items.querySelector('h2').textContent = tn('watchPage.listTitle', entries.length);
    this.items.setAttribute('count', entries.length);
  }

  remove(button) {
    const li = button.closest('li');
    const next = [...li.parentElement.children].indexOf(li);
    const title = load().items[button.value]?.t || '';
    remove(button.value);
    this.live.textContent = t('watchPage.removed', { title });
    const buttons = this.items.querySelectorAll('button[name="remove"]');
    (buttons[Math.min(next, buttons.length - 1)] || this.items.querySelector('h2')).focus();
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
