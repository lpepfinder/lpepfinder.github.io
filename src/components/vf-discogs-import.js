import { fromApi, fromCsv } from '../lib/watch/discogs.js';
import { state } from '../lib/watch/diff.js';
import { add } from '../lib/watch/store.js';
import * as data from '../lib/watch/data.js';
import config from '../../data/watch.json' with { type: 'json' };
import { afterWatch } from './vf-toast.js';
import { el } from './watch-render.js';
import { t, tn, formatNumber, formatPrice } from './i18n.js';

const { api, perPage, requestsPerMinute, rateLimitWaitSeconds } = config.discogs;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Stop extends Error {}

/**
 * <vf-discogs-import step="user|reading|matching|done|private|error">: reads a public Discogs
 * wantlist from the browser (no token; throttled below the 25 requests/min limit), or a CSV
 * export, matches the wants to release keys with the `now` shards, and watches them.
 */
export class VfDiscogsImport extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.live = this.querySelector('output');
    this.bar = this.querySelector('vf-progress');
    this.results = this.querySelector('vf-discogs-results');
    this.last = 0;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.fromUser(this.form.elements.user.value.trim()); });
    this.querySelector('input[name="csv"]').addEventListener('change', (e) => this.fromFile(e.target));
    this.querySelector('button[name="watch-all"]').addEventListener('click', () => this.watchAll());
  }

  set step(value) { this.setAttribute('step', value); }

  progress(key, done, total) {
    this.bar.hidden = false;
    const p = this.bar.querySelector('progress');
    p.max = total || 1;
    p.value = done;
    this.bar.querySelector('label').textContent = t(key, { done: formatNumber(done), total: formatNumber(total) });
  }

  /** Spaces requests so that a whole wantlist stays under the per-user limit. */
  async throttle() {
    const wait = this.last + 60000 / requestsPerMinute - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
  }

  async fromUser(user) {
    if (!user || this.busy) return;
    this.busy = true;
    this.reset();
    this.step = 'reading';
    const wants = [];
    try {
      for (let page = 1, pages = 1; page <= pages;) {
        await this.throttle();
        const res = await fetch(`${api}/users/${encodeURIComponent(user)}/wants?per_page=${perPage}&page=${page}`)
          .catch(() => { throw new Stop('error'); });
        if (res.status === 429) {
          this.live.textContent = t('discogs.rateLimited');
          await sleep(rateLimitWaitSeconds * 1000);
          continue;
        }
        if (!res.ok) throw new Stop(res.status === 403 ? 'private' : res.status === 404 ? 'notFound' : 'error');
        const body = await res.json();
        pages = body.pagination?.pages || 1;
        wants.push(...(body.wants || []).map(fromApi));
        this.progress('discogs.reading', wants.length, body.pagination?.items || wants.length);
        page++;
      }
      await this.match(wants);
    } catch (err) {
      this.fail(err instanceof Stop ? err.message : 'error');
    }
    this.busy = false;
  }

  async fromFile(input) {
    const file = input.files?.[0];
    if (!file || this.busy) return;
    this.busy = true;
    this.reset();
    const wants = fromCsv(await file.text().catch(() => ''));
    if (wants) await this.match(wants); else this.fail('csvError');
    input.value = '';
    this.busy = false;
  }

  reset() {
    this.results.hidden = true;
    this.live.textContent = '';
    this.wants = [];
  }

  fail(reason) {
    this.bar.hidden = true;
    this.step = reason === 'private' ? 'private' : 'error';
    this.live.textContent = t(`discogs.${reason}`);
  }

  /** Keep vinyl (unless asked otherwise), pick the first key that shops know, and show the summary. */
  async match(all) {
    const wants = this.form.elements.other.checked ? all : all.filter((w) => w.vinyl);
    if (!wants.length) { this.bar.hidden = true; this.step = 'done'; this.live.textContent = t('discogs.empty'); return; }
    this.step = 'matching';
    const found = await data.now(wants.flatMap((w) => w.keys), (done, total) => this.progress('discogs.matching', done, total));
    for (const w of wants) {
      w.key = w.keys.find((k) => found[k]) || w.keys[0];
      w.now = found[w.key];
    }
    this.wants = wants.filter((w) => w.key);
    const inStock = this.wants.filter((w) => w.now?.[0]);
    const soldOut = this.wants.filter((w) => w.now && !w.now[0] && w.now[1]);
    this.bar.hidden = true;
    this.step = 'done';
    this.live.textContent = t('discogs.summary', {
      inStock: formatNumber(inStock.length), total: formatNumber(this.wants.length), soldOut: formatNumber(soldOut.length),
    });
    this.render(inStock, soldOut);
  }

  render(inStock, soldOut) {
    const [a, b] = this.results.querySelectorAll('ul');
    const search = this.getAttribute('search') || '/';
    const row = (w) => el('li', {}, el('a', { href: `${search}?q=${encodeURIComponent(w.title.replace(' – ', ' '))}`, textContent: w.title }),
      w.now[0] ? ` · ${formatPrice(w.now[2], w.now[3])}` : '');
    a.replaceChildren(...inStock.map(row));
    b.replaceChildren(...soldOut.map(row));
    this.results.setAttribute('in-stock', inStock.length);
    this.results.setAttribute('sold-out', soldOut.length);
    this.querySelector('button[name="watch-all"]').textContent = tn('discogs.watchAll', this.wants.length);
    this.results.hidden = false;
  }

  watchAll() {
    const n = add(this.wants.map((w) => ({ key: w.key, title: w.title, state: state(w.now) })));
    this.live.textContent = tn('discogs.watchedAll', n);
    this.results.hidden = true;
    if (n) afterWatch();
    document.querySelector('vf-watch-items h2')?.focus();
  }
}
customElements.define('vf-discogs-import', VfDiscogsImport);
