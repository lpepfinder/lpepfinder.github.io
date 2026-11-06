import { t } from './i18n.js';
import { addToGroups, groupView } from '../lib/search/group.js';
import { selectKey } from '../lib/search/select-key.js';
import { region, rates, comparable, CURRENCY_EVENT } from './viewer.js';
import { ReleaseDetail } from './release-detail.js';
import './vf-release.js';

/**
 * <vf-release-list>: server-rendered release rows of a static page (an artist) with the same
 * release detail as the search: rows link to ?r=<key>, the detail opens in a sheet (a pane from 64rem).
 * The copies come from the embedded <script type="application/json" data-records>; the rows are redrawn
 * in the browser like the search's (prices in the viewer's currency).
 */
export class VfReleaseList extends HTMLElement {
  async connectedCallback() {
    if (this.details) return;
    this.list = this.querySelector('ol');
    this.live = this.querySelector(':scope > output');
    this.checked = this.getAttribute('checked');
    this.details = new ReleaseDetail(this);
    this.rates = await rates();
    this.groups = new Map();
    addToGroups(this.groups, JSON.parse(this.querySelector('script[data-records]').textContent));
    for (const group of this.groups.values()) {
      const key = selectKey(group);
      group.row = this.list.querySelector(`vf-release[release="${key}"]`);
      this.details.add(key, group);
    }
    addEventListener(CURRENCY_EVENT, () => this.render());
    this.render();
    await this.details.restore(async () => {}, () => false);
  }

  /** Redraw the rows in the browser, as the search does: prices in the viewer's currency, the local flag. */
  render() {
    const { filters, sort } = this.options();
    let index = 0;
    for (const group of this.groups.values()) {
      if (group.row) group.row.view = { group, view: groupView(group, filters, sort), rates: this.rates, covers: true, index: index++ };
    }
    this.details.draw();
  }

  options() {
    const value = (o) => comparable(o.price, o.currency, this.rates);
    return { filters: { inStock: false, formats: new Set() }, sort: { country: region, near: false, value } };
  }

  async share() {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) return await navigator.share({ title: document.title, url: location.href });
      await navigator.clipboard.writeText(location.href);
      this.live.textContent = t('results.linkCopied');
    } catch { /* dismissed or blocked */ }
  }
}
customElements.define('vf-release-list', VfReleaseList);
