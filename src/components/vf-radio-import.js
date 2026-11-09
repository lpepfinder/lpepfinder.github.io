import { resolve, handleOf } from '../lib/watch/radio.js';
import { syncTracks } from '../lib/watch/radio-tracks.js';
import { matchRadio } from '../lib/watch/radio-match.js';
import { fetchRelease } from '../lib/watch/discogs.js';
import { wantRecords } from '../lib/watch/wants.js';
import { add } from '../lib/watch/store.js';
import config from '../../data/watch.json' with { type: 'json' };
import { t, tn, formatNumber } from './i18n.js';
import { price } from './price.js';
import { el, attrs } from './dom.js';
import { afterWatch } from './vf-toast.js';
import { radioRead } from '../lib/watch/sources.js';
import { currentAccount } from '../lib/atproto/accounts.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = () => document.querySelector('vf-watch-page');

/**
 * <vf-radio-import status="idle|loading|review|done|error">: a radio's latest tracks (radio.js) matched to records
 * in stock (radio-match.js), listed with checkboxes: exact matches (a Discogs link) ticked, records found by the
 * song's title not ticked, since they're a guess. "Add" puts the ticked ones in the watchlist, each with the
 * at:// address of the tracks it was found for (store.js `p`: the watchlist links back to them). The tracks are
 * kept in the browser (radio-tracks.js): a radio read before is read again only for its new tracks. Signed in with
 * Bluesky, the field starts with the account's handle; the reading is kept in sources.js.
 */
export class VfRadioImport extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.live = this.querySelector('output');
    this.list = this.querySelector('ol');
    this.addButton = this.querySelector('button[name="add"]');
    this.progress = this.querySelector('vf-progress');
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.find(); });
    this.list.addEventListener('change', () => this.count());
    this.addButton.addEventListener('click', () => this.add());
    // signed in with Bluesky: the radio is most likely the account's own
    const input = this.form.elements.handle;
    if (!input.value) input.value = currentAccount()?.handle || '';
  }

  /** Read a radio now (from the sources list): `handle` in the field, then the same steps as the form. */
  read(handle) {
    this.form.elements.handle.value = handle;
    return this.find();
  }

  step(done, total, label) {
    this.progress.hidden = done >= total;
    const bar = this.progress.querySelector('progress');
    bar.max = total;
    bar.value = done;
    this.progress.querySelector('label').textContent = label;
  }

  async find() {
    const handle = handleOf(this.form.elements.handle.value);
    if (!handle || this.getAttribute('status') === 'loading') return;
    this.setAttribute('status', 'loading');
    this.list.replaceChildren();
    this.addButton.hidden = true;
    this.live.textContent = t('radio.reading', { handle });
    try {
      const { tracks } = await syncTracks(handle, await resolve(handle));
      if (!tracks.length) throw new Error('empty');
      radioRead(handle, tracks.length, tracks[0].uri);
      const found = await matchRadio(tracks, {
        maxCandidates: config.radio.maxCandidates,
        onProgress: (done, total) => this.step(done, total, t('radio.matching', { done: formatNumber(done), total: formatNumber(total) })),
      });
      const rates = await page()?.rates ?? {};
      const rows = [];
      for (const [i, m] of found.entries()) {
        if (m.ref) {
          const want = await fetchRelease(m.ref);
          if (want) rows.push(this.row({ want, track: m.track, exact: true }, rates));
          await wait(config.discogsPaceMs);
        } else for (const g of m.groups) rows.push(this.row({ group: g, track: m.track, exact: false }, rates));
        this.step(i + 1, found.length, t('radio.checking'));
      }
      this.list.replaceChildren(...rows);
      this.setAttribute('status', rows.length ? 'review' : 'done');
      this.live.textContent = rows.length ? tn('radio.found', rows.length, { tracks: formatNumber(tracks.length) }) : t('radio.none', { tracks: formatNumber(tracks.length) });
      this.count();
    } catch (e) {
      this.setAttribute('status', 'error');
      this.live.textContent = t(e.message === 'empty' ? 'radio.empty' : 'radio.error', { handle });
    }
    this.progress.hidden = true;
  }

  /** One candidate: a checkbox, the record, its cheapest copy, and the track it comes from. */
  row({ want, group, track, exact }, rates) {
    const title = want ? [want.artist, want.title].filter(Boolean).join(' – ') : group.title;
    const box = el('input', { type: 'checkbox', checked: exact });
    box.dataset.record = JSON.stringify(want ? { want, track: track.uri } : { key: group.key, title: group.title, track: track.uri });
    const cheapest = group?.offers.reduce((a, b) => ((b.price ?? Infinity) < (a.price ?? Infinity) ? b : a));
    return el('li', {}, attrs(el('vf-radio-match', {},
      el('label', {}, box, el('span', { textContent: title })),
      cheapest?.price != null ? price(cheapest.price, cheapest.currency, rates, { from: group.offers.length > 1 }) : null,
      el('p', { textContent: t(exact ? 'radio.exact' : 'radio.guess', { track: track.title }) })), { exact: String(exact) }));
  }

  count() {
    const n = this.list.querySelectorAll('input:checked').length;
    this.addButton.hidden = !this.list.children.length;
    this.addButton.disabled = !n;
    this.addButton.textContent = tn('radio.add', n);
  }

  add() {
    const picked = [...this.list.querySelectorAll('input:checked')].map((b) => JSON.parse(b.dataset.record));
    const played = (p) => (p.track ? { p: [p.track] } : {});
    const wants = picked.filter((p) => p.want);
    const records = [
      ...wantRecords(wants.map((p) => p.want)).map((r, i) => ({ ...r, fields: { ...r.fields, ...played(wants[i]) } })),
      ...picked.filter((p) => p.key).map((p) => ({ key: p.key, title: p.title, fields: played(p) })),
    ];
    const n = add(records);
    if (n) afterWatch();
    this.live.textContent = tn('watchPage.imported', n);
    this.list.replaceChildren();
    this.addButton.hidden = true;
    this.setAttribute('status', 'done');
    page()?.refresh();
  }
}
customElements.define('vf-radio-import', VfRadioImport);
