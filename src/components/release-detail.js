import { t } from './i18n.js';
import { groupView } from '../lib/search/group.js';
import { selected, select, unselect, forget } from './selection.js';
import './vf-sheet.js';
import './vf-detail.js';

/** Pages a deep link (?r=) may load looking for its release. */
const LOOK_AHEAD = 3;
const modified = (e) => e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
const STEP = { ArrowDown: 'nextElementSibling', ArrowUp: 'previousElementSibling' };

/**
 * The release detail of <vf-results>: a <vf-sheet name="release"> holding <vf-detail>.
 * A click on a row (a link to ?r=<key>) selects it; Back, Escape and the close button leave it.
 * Modified clicks open the link in a new tab as usual. ↑/↓ move between rows.
 * Docked (the desktop pane), it previews the first result until the reader picks one.
 */
export class ReleaseDetail {
  constructor(results) {
    this.results = results;
    this.sheet = results.querySelector('vf-sheet[name="release"]');
    this.detail = this.sheet.querySelector('vf-detail');
    this.byKey = new Map();
    this.detail.empty();
    results.list.addEventListener('click', (e) => {
      const a = e.target.closest('vf-release > a');
      if (!a || modified(e)) return;
      e.preventDefault();
      const key = a.parentElement.getAttribute('release');
      select(key);
      this.show(key);
    });
    results.list.addEventListener('keydown', (e) => {
      const a = e.target.closest('vf-release > a');
      if (!a || !STEP[e.key] || modified(e)) return;
      let li = a.closest('li')[STEP[e.key]];
      while (li && !li.querySelector('vf-release > a')) li = li[STEP[e.key]];
      if (!li) return;
      e.preventDefault();
      li.querySelector('vf-release > a').focus();
    });
    this.sheet.addEventListener('dismiss', () => unselect());
    this.sheet.addEventListener('dock', () => this.redock());
    this.detail.addEventListener('share', () => results.share());
    addEventListener('popstate', () => this.fromUrl());
  }

  /** A new result set. */
  reset() {
    this.byKey = new Map();
    this.current = null;
    this.detail.empty();
    if (!this.sheet.docked) this.sheet.closeQuietly();
  }

  /** Remember the row's group under its ?r= key. */
  add(key, group) { this.byKey.set(key, group); }

  /** Show a release: draw it, mark its row, open the sheet. False when it isn't loaded. */
  show(key) {
    const group = this.byKey.get(key);
    if (!group) return false;
    this.current = group;
    this.draw();
    this.mark(group);
    this.sheet.open();
    return true;
  }

  mark(group) {
    for (const row of this.results.list.querySelectorAll('vf-release[aria-current]')) row.removeAttribute('aria-current');
    group?.row?.setAttribute('aria-current', 'true');
  }

  /** Redraw the shown release (filters, currency, more copies loaded); docked, the first result until one is picked. */
  draw() {
    const group = this.current || (this.sheet.docked && this.firstGroup());
    if (!group) return;
    const { filters, sort } = this.results.options();
    const view = groupView(group, filters, sort) || groupView(group, { formats: new Set() }, sort);
    this.detail.view = { group, view, rates: this.results.rates, value: sort.value, checked: this.results.checked };
  }

  firstGroup() {
    const key = this.results.list.querySelector('vf-release')?.getAttribute('release');
    return key ? this.byKey.get(key) : null;
  }

  /** Back/forward: follow r in the URL. */
  fromUrl() {
    const key = selected();
    if (key && this.show(key)) return;
    this.current = null;
    this.mark(null);
    if (this.sheet.docked) this.draw();
    else this.sheet.closeQuietly();
  }

  /** The layout switched: a selection stays shown (as a modal on smaller screens), the pane previews. */
  redock() {
    if (this.current && !this.sheet.docked) this.sheet.open();
    if (!this.current && this.sheet.docked) this.draw();
  }

  /** A link with ?r=: open it once loaded, looking a few pages ahead; else say it's gone. */
  async restore(more, hasMore) {
    const key = selected();
    if (!key) return;
    for (let i = 0; i < LOOK_AHEAD && !this.byKey.has(key) && hasMore(); i++) await more();
    if (this.show(key)) return;
    forget();
    this.results.live.textContent = t('detail.missing');
  }
}
