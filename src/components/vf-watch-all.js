import { load, remove } from '../lib/watch/store.js';
import { itemsFrom } from '../lib/watch/source.js';
import config from '../../data/watch.json' with { type: 'json' };
import { item } from './watch-render.js';
import { t, tn, formatNumber } from './i18n.js';
import { el, attrs } from './dom.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** A–Z letter of a title, or "#" for digits, symbols and other scripts. */
const letterOf = (title) => {
  const c = fold(title).trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
};

/**
 * <vf-watch-all count="13000" long>: every watched record, A–Z, never all at once: pages of
 * config.pageSize with "Show more", a search box that filters, and (long: more than a page) a jump bar of the letters present.
 * Set `search` (home path) and `source` (all, or one source: source.js) before `refresh()`. Remove buttons remove a record and keep the focus nearby.
 */
export class VfWatchAll extends HTMLElement {
  connectedCallback() {
    this.heading = this.querySelector('h2');
    this.input = this.querySelector('input[type="search"]');
    this.jump = this.querySelector('nav ul');
    this.list = this.querySelector('ol');
    this.showing = this.querySelector('vf-watch-showing');
    this.more = this.querySelector('button[name="more"]');
    this.live = document.querySelector('vf-watch-page > output');
    this.more.addEventListener('click', () => this.page(true));
    let timer;
    this.input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { this.filter(); this.live.textContent = this.status(); }, 150);
    });
    this.jump.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.jumpTo(b.value);
    });
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[name="remove"]');
      if (b) this.remove(b);
    });
  }

  /** Re-read the list (after a check, an import or a removal), keeping the query. */
  refresh() {
    const items = itemsFrom(load().items, this.getAttribute('source'));
    this.sorted = Object.entries(items).map(([key, it]) => ({ key, it, title: it.t || '', folded: fold(it.t) }))
      .sort((a, b) => collator.compare(a.title, b.title));
    this.setAttribute('count', this.sorted.length);
    this.toggleAttribute('long', this.sorted.length > config.pageSize);
    this.filter();
  }

  filter() {
    const words = fold(this.input.value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    this.found = words.length ? this.sorted.filter((r) => words.every((w) => r.folded.includes(w))) : this.sorted;
    this.letters();
    this.start = 0;
    this.shown = 0;
    this.list.replaceChildren();
    this.page(false);
  }

  /** Jump bar: one button per letter present in the current matches. */
  letters() {
    const present = [...new Set(this.found.map((r) => letterOf(r.title)))].sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
    this.jump.replaceChildren(...present.map((l) => el('li', {}, attrs(el('button', { type: 'button', value: l, textContent: l === '#' ? t('watchPage.jumpOther') : l }), { kind: 'secondary' }))));
  }

  /** Start the page at the first match with this letter; focus its first record. */
  jumpTo(letter) {
    const i = this.found.findIndex((r) => letterOf(r.title) === letter);
    if (i < 0) return;
    this.start = i;
    this.shown = 0;
    this.list.replaceChildren();
    this.page(true);
  }

  /** Append the next page; with focus, move it to the first new record. */
  page(focus) {
    const from = this.start + this.shown;
    const rows = this.found.slice(from, from + config.pageSize);
    const search = this.getAttribute('search') || '/';
    const items = rows.map((r) => item(r.key, r.it, search));
    this.list.append(...items);
    this.shown += rows.length;
    const left = this.found.length - (this.start + this.shown);
    this.more.hidden = left <= 0;
    this.more.textContent = tn('watchPage.showMore', Math.min(left, config.pageSize));
    this.showing.textContent = this.status();
    if (focus) items[0]?.querySelector('a, button')?.focus();
  }

  status() {
    const q = this.input.value.trim();
    if (q && !this.found.length) return t('watchPage.noMatch', { query: q });
    return t('watchPage.showing', { shown: formatNumber(this.shown), total: formatNumber(this.found.length) });
  }

  remove(button) {
    const li = button.closest('li');
    const next = li.nextElementSibling || li.previousElementSibling;
    const title = load().items[button.value]?.t || t('watchPage.unknownTitle', { key: button.value });
    remove(button.value);
    li.remove();
    this.sorted = this.sorted.filter((r) => r.key !== button.value);
    this.found = this.found.filter((r) => r.key !== button.value);
    this.shown--;
    this.setAttribute('count', this.sorted.length);
    this.showing.textContent = this.status();
    this.live.textContent = t('watchPage.removed', { title });
    (next?.querySelector('button[name="remove"]') || this.heading).focus();
  }
}
customElements.define('vf-watch-all', VfWatchAll);
