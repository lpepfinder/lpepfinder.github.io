import { readUser } from '../lib/atproto/public.js';
import * as data from '../lib/watch/data.js';
import { rates as loadRates, comparable } from './viewer.js';
import { price } from './price.js';
import { cover } from './cover.js';
import { splitTitle } from '../lib/search/title.js';
import { el, attrs, listen, unlisten } from './dom.js';
import { t, tn, formatNumber, formatDay } from './i18n.js';
import './vf-watch.js';
import { loadSocial } from './social.js';

const PAGE = 60;

/**
 * <vf-user-page status="idle|loading|done|empty|error">: a collector's page from ?h=<handle> (public.js):
 * who they are (Bluesky profile, Discogs link), their wants in stock now (cheapest first) and all their wants,
 * each with Watch to add it to your own list. Without a handle: the lookup form and the collectors feed
 * (social.js): records wanted lately, the most wanted, and the collectors who publish their lists.
 */
export class VfUserPage extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  connectedCallback() {
    customElements.upgrade(this);
    this.head = this.querySelector('vf-user-head');
    this.live = this.querySelector(':scope > output');
    this.progress = this.querySelector(':scope > vf-progress');
    this.note = this.querySelector(':scope > p');
    this.sections = { stock: this.querySelector('section[name="stock"]'), wants: this.querySelector('section[name="wants"]') };
    for (const [name, section] of Object.entries(this.sections)) {
      section.querySelector('button[name="more"]').addEventListener('click', () => this.more(name));
    }
    listen(this, window, data.PROGRESS, (e) => this.step(e.detail));
    const handle = new URLSearchParams(location.search).get('h')?.trim().replace(/^@/, '');
    this.querySelector('input[name="h"]').value = handle || '';
    if (handle) this.load(handle); else this.feed();
  }

  /** The collectors feed, with today's stock for the records in it. */
  async feed() {
    const box = this.querySelector('vf-user-feed');
    const social = await loadSocial();
    box.hidden = false;
    const collectors = social?.collectors || [];
    const byDid = new Map(collectors.map((c) => [c.did, c]));
    const keys = [...new Set([...(social?.events || []).map((e) => e[2]), ...(social?.top || [])])];
    const [rows, rates] = await Promise.all([keys.length ? data.now(keys) : {}, loadRates()]);
    this.rates = rates;
    const userHref = (c) => `?h=${encodeURIComponent(c.handle)}`;
    const stockOf = (key) => (rows[key]?.[0] > 0 ? price(rows[key][2], rows[key][3], rates, { from: rows[key][0] > 1 }) : el('small', { textContent: t('user.outOfStock') }));
    const record = (key) => el('a', { href: `/?q=${encodeURIComponent(social.titles[key] || '')}`, textContent: social.titles[key] || key });

    const events = (social?.events || []).filter((e) => byDid.has(e[1]));
    const eventsBox = box.querySelector('section[name="events"]');
    eventsBox.hidden = !events.length;
    eventsBox.querySelector('ul').replaceChildren(...events.map(([date, did, key]) => {
      const c = byDid.get(did);
      return el('li', {}, attrs(el('vf-feed-item', {},
        el('a', { href: userHref(c), textContent: `@${c.handle}` }), el('span', { textContent: ` ${t('user.feedWants')} ` }), record(key),
        el('time', { dateTime: date, textContent: formatDay(date) }), stockOf(key)), { stock: rows[key]?.[0] > 0 ? 'in' : 'out' }));
    }));

    const top = social?.top || [];
    const topBox = box.querySelector('section[name="top"]');
    topBox.hidden = !top.length;
    topBox.querySelector('ul').replaceChildren(...top.map((key) => el('li', {}, attrs(el('vf-feed-item', {},
      record(key), el('span', { textContent: tn('detail.wantedBy', social.wanted[key]) }), stockOf(key)), { stock: rows[key]?.[0] > 0 ? 'in' : 'out' }))));

    box.querySelector('section[name="collectors"] ul').replaceChildren(...collectors.map((c) => el('li', {}, el('a', { href: userHref(c) },
      c.avatar ? el('img', { src: c.avatar, alt: '', width: 40, height: 40, loading: 'lazy', referrerPolicy: 'no-referrer' }) : el('vf-cover'),
      el('strong', { textContent: c.name || `@${c.handle}` }),
      el('small', { textContent: [`@${c.handle}`, tn('user.wants', c.wants), c.collection ? tn('user.collection', c.collection) : null].filter(Boolean).join(' · ') })))));
    if (!collectors.length) box.querySelector('section[name="collectors"] ul').append(el('li', {}, el('p', { textContent: t('user.feedNone') })));
  }

  async load(handle) {
    this.setAttribute('status', 'loading');
    this.live.textContent = t('user.loading', { handle });
    let user;
    try {
      user = await readUser(handle);
    } catch (e) {
      console.error(e);
      this.setAttribute('status', 'error');
      this.live.textContent = t('user.error', { handle });
      return;
    }
    this.user = user;
    document.title = t('user.pageTitle', { name: user.name || `@${user.handle}` });
    const keys = [...user.wants.keys()];
    const [rows, rates] = await Promise.all([keys.length ? data.now(keys) : {}, loadRates()]);
    this.rates = rates;
    this.rows = rows;
    const inStock = keys.filter((k) => rows[k]?.[0] > 0)
      .sort((a, b) => comparable(rows[a][2], rows[a][3], rates) - comparable(rows[b][2], rows[b][3], rates));
    this.lists = { stock: inStock, wants: keys };
    this.shown = { stock: 0, wants: 0 };
    this.renderHead(inStock.length);
    this.live.textContent = '';
    this.setAttribute('status', keys.length || user.collection.count ? 'done' : 'empty');
    if (!keys.length) { this.live.textContent = t('user.none', { handle: user.handle }); return; }
    this.sections.stock.querySelector('h2').textContent = tn('user.stockHeading', inStock.length);
    this.sections.wants.querySelector('h2').textContent = tn('user.wantsHeading', keys.length);
    for (const name of ['stock', 'wants']) {
      this.sections[name].hidden = false;
      this.sections[name].querySelector('ul').replaceChildren();
      this.more(name);
    }
    if (!inStock.length) this.sections.stock.querySelector('ul').append(el('li', {}, el('p', { textContent: t('user.noneInStock') })));
    this.note.textContent = t('user.source', { handle: user.handle, date: user.wantsAt ? formatDay(user.wantsAt.slice(0, 10)) : '–' });
  }

  renderHead(inStock) {
    const u = this.user;
    this.head.hidden = false;
    const img = this.head.querySelector('img');
    if (u.avatar) { img.src = u.avatar; img.hidden = false; }
    this.head.querySelector('h1').textContent = u.name || `@${u.handle}`;
    this.head.querySelector('hgroup > p').textContent = `@${u.handle}`;
    this.head.querySelector(':scope > p').textContent = [
      tn('user.wants', u.wants.size), u.collection.count ? tn('user.collection', u.collection.count) : null, tn('user.inStock', inStock),
    ].filter(Boolean).join(' · ');
    const link = (href, icon, label) => el('li', {}, el('a', { href, rel: 'nofollow noopener' }, attrs(el('vf-icon'), { name: icon }), el('span', { textContent: label })));
    this.head.querySelector('ul').replaceChildren(
      link(`https://bsky.app/profile/${u.did}`, 'bluesky', t('user.bluesky')),
      u.discogs ? link(`https://www.discogs.com/user/${encodeURIComponent(u.discogs)}`, 'record', t('user.discogs', { user: u.discogs })) : null,
    );
  }

  /** The next page of a list's rows. */
  more(name) {
    const section = this.sections[name];
    const keys = this.lists[name].slice(this.shown[name], this.shown[name] + PAGE);
    const start = this.shown[name];
    section.querySelector('ul').append(...keys.map((key, i) => this.row(key, start + i)));
    this.shown[name] += keys.length;
    section.querySelector('button[name="more"]').hidden = this.shown[name] >= this.lists[name].length;
  }

  row(key, index) {
    const it = this.user.wants.get(key);
    const row = this.rows[key];
    const stock = row?.[0] > 0;
    const { artist, title } = splitTitle(it.t || key);
    const watch = attrs(el('vf-watch'), { key, label: it.t || key });
    return el('li', {}, attrs(el('vf-release', {},
      el('a', { href: `/?q=${encodeURIComponent(it.t || '')}` },
        cover(it.i, index),
        el('vf-name', {}, artist && el('vf-artist', { textContent: artist }), artist && el('span', { textContent: ' – ' }), el('vf-title', { textContent: title })),
        el('vf-meta', {}, el('span', { textContent: stock ? tn('user.copies', row[0]) : t('user.outOfStock') })),
        stock ? price(row[2], row[3], this.rates, { from: row[0] > 1 }) : el('vf-price')),
      watch), { release: key, stock: stock ? 'in' : 'out' }));
  }

  step({ done, total }) {
    if (this.getAttribute('status') !== 'loading') return;
    this.progress.hidden = done >= total;
    const bar = this.progress.querySelector('progress');
    bar.max = total;
    bar.value = done;
    this.progress.querySelector('label').textContent = t('user.checking', { done: formatNumber(done), total: formatNumber(total) });
  }
}
customElements.define('vf-user-page', VfUserPage);
