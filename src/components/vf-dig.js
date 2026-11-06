import { thumb, absolute } from '../lib/thumb.js';
import { splitTitle } from '../lib/search/title.js';
import { reach, noCustoms } from '../lib/watch/reach.js';
import { t, formatNumber, formatPrice } from './i18n.js';
import { rates, region, toViewer, currency, CURRENCY_EVENT } from './viewer.js';
import { flag } from './release-parts.js';
import { el, attrs, listen, unlisten } from './dom.js';
import { load } from '../lib/watch/store.js';
import { releaseKey } from '../lib/search/release-key.js';

const CRATES = ['mine', 'new', 'restock', 'drop'];
const PAGE = 48;
const KEY = 'vf.dig';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
const ago = new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' });
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/**
 * <vf-dig crate="new|restock|drop" status="loading|ready|error">: crates to flip through, as a cover grid:
 * new in the shops, back in stock, price drops (public/dig.json, scripts/ledger/dig.js). Chips filter by
 * format and by where the shop is (ships to me, no customs). Each cover links to the record at its shop.
 * The crate is in the URL (?crate=), the filters are kept in this browser. Until the file loads, the
 * server-rendered new arrivals stay shown. "Your records" (crate=mine) gathers the watched records of all
 * three crates, by release key (the record's own and those its catalog number found); it shows only with a watchlist.
 */
export class VfDig extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  async connectedCallback() {
    // after client-side navigation, the new page's elements upgrade parent first: ready the ones used here
    customElements.upgrade(this);
    this.grid = this.querySelector(':scope > ol');
    this.form = this.querySelector(':scope > form');
    this.more = this.querySelector(':scope > button[name="more"]');
    this.status = this.querySelector(':scope > vf-dig-status');
    this.limit = PAGE;
    const saved = read();
    for (const [name, value] of Object.entries(saved)) {
      const field = this.form.elements[name];
      if (field?.type === 'checkbox') field.checked = !!value;
      else if (field) field.value = value;
    }
    this.form.addEventListener('change', () => {
      save({ ships: this.form.elements.ships.checked, customs: this.form.elements.customs.checked, format: this.form.elements.format.value });
      this.limit = PAGE;
      this.render();
    });
    this.querySelector(':scope > nav').addEventListener('click', (e) => {
      const a = e.target.closest('a[crate]');
      if (!a) return;
      e.preventDefault();
      history.replaceState(null, '', a.href);
      this.limit = PAGE;
      this.render();
      scrollTo({ top: this.offsetTop - 80 });
    });
    this.more.addEventListener('click', () => { this.limit += PAGE; this.render(true); });
    listen(this, window, CURRENCY_EVENT, () => this.render());
    try {
      const [data, table, regions] = await Promise.all([
        fetch('/dig.json').then((r) => (r.ok ? r.json() : Promise.reject())),
        rates(),
        fetch('/regions.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      this.data = data;
      this.rates = table;
      const zones = regions?.zones || [];
      this.reach = data.shops.map(([, , country, shipsTo]) => reach({ country, shipsTo }, region, zones));
      const items = load().items;
      this.watched = new Set([...Object.keys(items), ...Object.values(items).flatMap((it) => it.x || [])]);
      this.toggleAttribute('watching', this.watched.size > 0);
      for (const it of data.items) it.key = releaseKey(it[2]);
      this.setAttribute('status', 'ready');
      this.render();
    } catch {
      this.setAttribute('status', 'error');
    }
  }

  get crate() {
    const c = new URLSearchParams(location.search).get('crate');
    if (CRATES.includes(c) && (c !== 'mine' || this.watched?.size)) return c;
    // no crate asked for: the first one with records (yours first, then new, back in stock, price drops)
    return CRATES.filter((x) => x !== 'mine' || this.watched?.size).find((x) => this.pick(x).length) || 'new';
  }

  /** Items of the crate under the filters. */
  pick(crate) {
    const f = this.form.elements;
    return this.data.items.filter((it) => (crate === 'mine' ? this.watched.has(it.key) : it[0] === crate)
      && (!f.format.value || it[8] === f.format.value)
      && (!f.ships.checked || this.reach[it[7]] !== 'no')
      && (!f.customs.checked || noCustoms(this.reach[it[7]])));
  }

  render(append = false) {
    if (!this.data) return;
    const crate = this.crate;
    this.setAttribute('crate', crate);
    for (const a of this.querySelectorAll(':scope > nav a[crate]')) {
      const c = a.getAttribute('crate');
      if (c === crate) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      const n = this.pick(c).length;
      a.querySelector('data').value = n;
      a.querySelector('data').textContent = formatNumber(n);
    }
    const items = this.pick(crate);
    const from = append ? this.grid.children.length : 0;
    const cards = items.slice(from, this.limit).map((it, i) => this.card(it, from + i));
    if (append) this.grid.append(...cards); else this.grid.replaceChildren(...cards);
    this.more.hidden = items.length <= this.limit;
    this.status.textContent = items.length ? '' : t(crate === 'mine' ? 'dig.emptyMine' : 'dig.empty');
    if (append) cards[0]?.querySelector('a')?.focus();
  }

  /** One cover: image, price (and the old one for drops), artist and title, shop with flag and when. */
  card([crate, day, title, cents, cur, url, image, shopIdx, format, was], index) {
    const [, name, country] = this.data.shops[shopIdx];
    const { artist, title: name2 } = splitTitle(title);
    const src = thumb(image, { width: 360 });
    const img = src ? el('img', { src, alt: '', decoding: 'async', loading: index < 6 ? 'eager' : 'lazy', referrerPolicy: 'no-referrer', width: 180, height: 180 }) : el('vf-cover');
    if (src && src !== absolute(image)) img.addEventListener('error', () => { img.src = absolute(image); }, { once: true });
    const money = (c) => {
      const converted = toViewer(c, cur, this.rates);
      return converted == null ? formatPrice(c, cur) : t('results.approx', { price: formatPrice(converted, currency()) });
    };
    const age = daysBetween(day, this.data.day);
    return el('li', {}, attrs(el('vf-dig-card', {},
      el('a', { href: url, rel: 'nofollow' },
        img,
        el('vf-price', {}, el('data', { value: cents, textContent: money(cents) }), was ? el('s', { textContent: money(was) }) : null),
        el('vf-title', { textContent: name2 }),
        artist ? el('vf-artist', { textContent: artist }) : null,
        el('vf-shop', { textContent: [name, country && flag(country), crate !== 'drop' ? ago.format(-age, 'day') : null].filter(Boolean).join(' · ') }))),
    { crate, format: format || null, reach: this.reach[shopIdx] }));
  }
}
customElements.define('vf-dig', VfDig);
