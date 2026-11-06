import { shopDetail } from './watch-views.js';
import { selected, select, unselect } from './selection.js';
import './vf-sheet.js';

const PARAM = 'shop';
const modified = (e) => e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * "Available now" of the watch page: a shop row opens that shop's watched records in a sheet
 * (?view=now&shop=<id>), docked as the right pane from 64rem, where it previews the first shop.
 * Back, Escape and the close button leave it; the native dialog returns the focus to the row.
 */
export class WatchShopPane {
  constructor(box, page) {
    this.page = page;
    this.list = box.querySelector('vf-watch-shops ul');
    this.sheet = box.querySelector('vf-sheet[name="watch-shop"]');
    this.body = this.sheet.querySelector('vf-watch-shop-detail');
    this.groups = new Map();
    this.list.addEventListener('click', (e) => {
      const a = e.target.closest('vf-watch-shop > a');
      if (!a || modified(e)) return;
      e.preventDefault();
      const id = a.parentElement.getAttribute('shop');
      select(id, PARAM);
      this.show(id);
    });
    this.sheet.addEventListener('dismiss', () => unselect(PARAM));
    this.sheet.addEventListener('dock', () => this.fromUrl());
    addEventListener('popstate', () => this.fromUrl());
  }

  /** New groups (after a check or a currency change); keeps what is shown. */
  set(groups) {
    this.groups = new Map(groups.map((g) => [g.id, g]));
    this.fromUrl();
  }

  show(id) {
    const g = this.groups.get(id);
    if (!g) return false;
    this.draw(g);
    for (const row of this.list.querySelectorAll('vf-watch-shop[aria-current]')) row.removeAttribute('aria-current');
    this.list.querySelector(`vf-watch-shop[shop="${CSS.escape(id)}"]`)?.setAttribute('aria-current', 'true');
    this.sheet.open();
    return true;
  }

  draw(g) {
    this.body.replaceChildren(...shopDetail(g, this.page.search, this.page.rates));
    this.body.setAttribute('shop', g.id);
  }

  fromUrl() {
    const id = selected(PARAM);
    if (id && this.page.getAttribute('view') === 'now' && this.show(id)) return;
    this.list.querySelector('vf-watch-shop[aria-current]')?.removeAttribute('aria-current');
    const first = this.groups.values().next().value;
    if (this.sheet.docked && first) this.draw(first);
    else if (!this.sheet.docked) this.sheet.closeQuietly();
  }
}
