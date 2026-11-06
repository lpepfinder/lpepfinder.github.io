import { SearchClient } from '../lib/search/client.js';
import { addToGroups, groupView } from '../lib/search/group.js';
import { load } from '../lib/watch/store.js';
import { selected, select, unselect } from './selection.js';
import { comparable, region } from './viewer.js';
import { t } from './i18n.js';
import { el } from './dom.js';
import './vf-sheet.js';
import './vf-detail.js';

const PARAM = 'record';
/** Records of the search index read for one lookup (all copies of a record are neighbours in rank order). */
const LOOKUP = 160;
const modified = (e) => e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
let client = null;

/**
 * Every copy of a watched record, with links to the shops: the search index is queried for its
 * title (and its catalog number) and the copies of its release keys (its own and those its catalog
 * number found) are kept. Null when none is in the index.
 */
export async function lookup(key, it) {
  client ??= new SearchClient();
  const keys = new Set([key, ...(it.x || [])]);
  const queries = [it.t, it.c].filter(Boolean);
  const groups = new Map();
  for (const q of queries) {
    const ids = await client.match(q);
    if (!ids.length) continue;
    const order = await client.rank(ids, q);
    addToGroups(groups, await client.records(order.slice(0, LOOKUP)));
  }
  const offers = [...groups.values()].filter((g) => keys.has(g.watchKey)).flatMap((g) => g.offers);
  const seen = new Set();
  const unique = offers.filter((o) => !seen.has(o.url) && seen.add(o.url));
  return unique.length ? { key, watchKey: key, offers: unique } : null;
}

/**
 * "In stock" of the watch page: a record row opens all its copies (<vf-detail>, as in the search) in a
 * sheet (?record=<key>), docked as the right pane from 64rem, where it previews the first record.
 */
export class WatchRecordPane {
  constructor(box, page) {
    this.page = page;
    this.box = box;
    this.sheet = box.querySelector('vf-sheet[name="watch-record"]');
    this.detail = this.sheet.querySelector('vf-detail');
    this.detail.empty();
    this.keys = [];
    box.addEventListener('click', (e) => {
      const a = e.target.closest('vf-release > a');
      if (!a || modified(e)) return;
      e.preventDefault();
      const key = a.parentElement.getAttribute('release');
      select(key, PARAM);
      this.show(key);
    });
    this.sheet.addEventListener('dismiss', () => unselect(PARAM));
    this.sheet.addEventListener('dock', () => this.fromUrl());
    this.detail.addEventListener('share', () => this.share());
    addEventListener('popstate', () => this.fromUrl());
  }

  /** Keys of the rows shown, in order (after a check, a filter or a currency change). */
  set(keys) {
    this.keys = keys;
    this.fromUrl();
  }

  show(key) {
    const it = load().items[key];
    if (!it) return false;
    for (const row of this.box.querySelectorAll('vf-release[aria-current]')) row.removeAttribute('aria-current');
    this.box.querySelector(`vf-release[release="${CSS.escape(key)}"]`)?.setAttribute('aria-current', 'true');
    this.sheet.open();
    this.draw(key, it);
    return true;
  }

  async draw(key, it) {
    if (this.current === key) return;
    this.current = key;
    this.detail.setAttribute('status', 'loading');
    this.detail.replaceChildren(el('p', { textContent: t('watchPage.loadingCopies') }));
    const group = await lookup(key, it).catch(() => null);
    if (this.current !== key) return;
    if (!group) {
      this.detail.setAttribute('status', 'missing');
      this.detail.replaceChildren(
        el('h2', { id: 'detail-title', tabIndex: -1, textContent: it.t || key }),
        el('p', { textContent: t('watchPage.copiesMissing') }),
        el('p', {}, el('a', { href: this.searchHref(key, it), textContent: t('watchPage.searchIt') })));
      return;
    }
    const value = (o) => comparable(o.price, o.currency, this.page.rates);
    const view = groupView(group, {}, { country: region, near: false, value });
    this.detail.view = { group, view, rates: this.page.rates, value, search: this.page.search };
  }

  searchHref(key, it) { return `${this.page.search}?q=${encodeURIComponent(it.t || '')}&r=${key}`; }

  async share() {
    const it = load().items[this.current];
    if (!it) return;
    const url = new URL(this.searchHref(this.current, it), location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: it.t, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  }

  fromUrl() {
    const key = selected(PARAM);
    if (key && this.page.getAttribute('view') === 'available' && this.show(key)) return;
    this.box.querySelector('vf-release[aria-current]')?.removeAttribute('aria-current');
    const first = this.keys[0];
    if (this.sheet.docked && first) this.draw(first, load().items[first] || {});
    else if (!this.sheet.docked) this.sheet.closeQuietly();
  }
}
