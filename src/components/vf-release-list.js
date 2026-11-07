import { t } from './i18n.js';
import { addToGroups, groupView } from '../lib/search/group.js';
import { selectKey } from '../lib/search/select-key.js';
import { region, rates, comparable, CURRENCY_EVENT } from './viewer.js';
import { ReleaseDetail } from './release-detail.js';
import './vf-release.js';
import { listen, unlisten } from './dom.js';

/** An API record (src/lib/api.js) as the search's records: the shape the release detail draws. */
const fromApi = (r) => ({
  title: r.title, price: r.priceCents, image: r.image, available: r.available !== false, lastInStock: null,
  url: r.url, currency: r.currency, shop: { id: r.shop, name: r.shopName || r.shop, country: r.country || null },
});

/**
 * <vf-release-list>: server-rendered release rows of a static page (an artist) with the same
 * release detail as the search: rows link to ?r=<key>, the detail opens in a sheet (a pane from 64rem).
 * The copies come from the page's JSON (`src`, the artist's API file, fetched once); the rows are redrawn
 * in the browser like the search's (prices in the viewer's currency).
 */
export class VfReleaseList extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  async connectedCallback() {
    // after client-side navigation, the new page's elements upgrade parent first: ready the ones used here
    customElements.upgrade(this);
    if (this.details) return;
    this.list = this.querySelector('ol');
    this.live = this.querySelector(':scope > output');
    this.checked = this.getAttribute('checked');
    this.details = new ReleaseDetail(this);
    const [rateTable, records] = await Promise.all([rates(), fetch(this.getAttribute('src')).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
    this.rates = rateTable;
    this.groups = new Map();
    // without its JSON the rows stay as built, linking to the search
    if (!records) return;
    addToGroups(this.groups, records.records.map(fromApi));
    for (const group of this.groups.values()) {
      const key = selectKey(group);
      group.row = this.list.querySelector(`vf-release[release="${key}"]`);
      this.details.add(key, group);
    }
    listen(this, window, CURRENCY_EVENT, () => this.render());
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
