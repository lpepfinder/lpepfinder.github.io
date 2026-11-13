import { SearchClient } from '../lib/search/client.js';
import { addToGroups, groupView } from '../lib/search/group.js';
import { load, update, remove } from '../lib/watch/store.js';
import { currency } from './viewer.js';
import { convert } from '../lib/currency.js';
import { formatPrice } from './i18n.js';
import { toast } from './vf-toast.js';
import { selected, select, unselect, forget } from './selection.js';
import { comparable, region } from './viewer.js';
import { t, formatDay } from './i18n.js';
import { sourcesOf } from '../lib/watch/source.js';
import { el, attrs, listen } from './dom.js';
import { findTrack } from '../lib/watch/radio-tracks.js';
import './vf-sheet.js';
import './vf-detail.js';

const PARAM = 'record';
/** Records of the search index read per step of a lookup, and at most in all: a common title can rank its copies
 *  far down among millions of records, so the lookup reads on until it finds them. */
const LOOKUP = 160;
const LOOKUP_MAX = 1120;
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
  const found = () => [...groups.values()].some((g) => keys.has(g.watchKey));
  for (const q of queries) {
    const ids = await client.match(q);
    if (!ids.length) continue;
    const order = await client.rank(ids, q);
    // read on while the record isn't found; once found, its copies are neighbours: one more step gets the rest
    for (let from = 0, extra = 1; from < Math.min(order.length, LOOKUP_MAX) && extra >= 0; from += LOOKUP) {
      addToGroups(groups, await client.records(order.slice(from, from + LOOKUP)));
      if (found()) extra--;
    }
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
    this.controls = this.sheet.querySelector('vf-watch-controls');
    this.controls.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.setMax(); });
    this.controls.querySelector('button[name="bought"]').addEventListener('click', () => this.drop('watchPage.boughtDone'));
    this.controls.querySelector('button[name="remove"]').addEventListener('click', () => this.drop('watchPage.removed'));
    listen(page, window, 'vf-popstate', () => this.fromUrl());
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
    // the record's own controls and tracks always reflect it; its copies are looked up once
    const same = this.current === key;
    this.current = key;
    this.showControls(it);
    this.showWhy(it);
    this.showTracks(key, it);
    if (same) return;
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

  /** Max price and Bought/Remove for the record shown; the max is typed in the "Prices in" currency, kept in euro cents (it.m). */
  showControls(it) {
    this.controls.hidden = !it?.t;
    const cur = currency() || 'EUR';
    this.controls.querySelector('vf-currency-code').textContent = cur;
    const field = this.controls.querySelector('input[name="max"]');
    const value = it?.m == null ? null : cur === 'EUR' ? it.m : convert(it.m, 'EUR', cur, this.page.rates);
    field.value = value == null ? '' : String(Math.round(value) / 100);
  }

  /**
   * Why the record is on the list, above its copies: a Discogs want (its rating, a link to the release on Discogs),
   * the radio tracks it was found for (showTracks), or the day it was added from the search.
   */
  showWhy(it) {
    const why = this.sheet.querySelector('vf-watch-why');
    why.hidden = !it;
    if (!it) return;
    const from = sourcesOf(it);
    const discogs = why.querySelector('p[source="discogs"]');
    discogs.hidden = !from.includes('discogs');
    const link = discogs.querySelector('a');
    link.hidden = !it.w;
    if (it.w) link.href = `https://www.discogs.com/release/${encodeURIComponent(it.w)}`;
    const rating = discogs.querySelector('vf-badge[kind="rating"]');
    rating.hidden = !it.r;
    rating.textContent = it.r ? '★'.repeat(it.r) : '';
    rating.title = it.r ? t('watchPage.rating', { rating: it.r }) : '';
    const search = why.querySelector('p[source="search"]');
    search.hidden = !from.includes('search') || !it.a;
    search.textContent = it.a ? t('watchPage.whySearch', { date: formatDay(it.a) }) : '';
  }

  /**
   * The radio tracks the record was found for (it.p), each with a link to listen to it where it is hosted (http(s) only:
   * the url is the radio's data). The heading shows even when the radio's tracks aren't kept in this browser.
   */
  async showTracks(key, it) {
    const box = this.sheet.querySelector('vf-watch-tracks');
    box.hidden = !it?.p?.length;
    box.querySelector('ul').replaceChildren();
    if (!it?.p?.length) return;
    const tracks = (await Promise.all(it.p.map(findTrack))).filter(Boolean);
    if (this.current !== key || !tracks.length) return;
    box.querySelector('ul').replaceChildren(...tracks.map((tr) => el('li', {},
      el('span', { textContent: tr.title }),
      /^https?:\/\//i.test(tr.url) ? attrs(el('a', { href: tr.url, target: '_blank', rel: 'noopener', textContent: t('watchPage.listen') }), { kind: 'secondary' }) : null)));
    box.hidden = false;
  }

  setMax() {
    const key = this.current;
    const n = parseFloat(this.controls.querySelector('input[name="max"]').value.replace(',', '.'));
    const cur = currency() || 'EUR';
    const cents = n > 0 ? Math.round(n * 100) : null;
    const eur = cents == null ? null : cur === 'EUR' ? cents : convert(cents, cur, 'EUR', this.page.rates) ?? cents;
    update((list) => { const it = list.items[key]; if (!it) return; if (eur == null) delete it.m; else it.m = eur; });
    toast(eur == null ? t('watchPage.maxCleared') : t('watchPage.maxSet', { price: formatPrice(cents, cur) }));
    this.page.renderHits();
  }

  /** Bought or removed: off the list (Undo in the toast puts it back), the pane closes, the list redraws. */
  drop(message) {
    const key = this.current;
    const item = load().items[key];
    const title = item?.t || key;
    remove(key);
    this.current = null;
    toast(t(message, { title }), [t('watchPage.undo'), () => {
      update((list) => { list.items[key] = item; });
      this.page.refresh();
    }]);
    // drop ?record= without a history step: Back must not leave the page
    forget(PARAM);
    if (!this.sheet.docked) this.sheet.closeQuietly();
    this.page.renderHits();
    this.page.views.all.refresh();
    this.page.renderSummary();
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
