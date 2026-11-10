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
 * in stock (radio-match.js), listed with checkboxes in two groups: exact matches (a Discogs link), ticked, then
 * records found by the song's title, not ticked since they're a guess. Each group has a checkbox that ticks or
 * clears all of it (mixed when only some are ticked). "Add" puts the ticked ones in the watchlist, each with the
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
    this.list.addEventListener('change', (e) => {
      if (e.target.name === 'all') for (const box of this.boxes(e.target.closest('li'))) box.checked = e.target.checked;
      this.count();
    });
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
      const exact = [];
      const guesses = [];
      for (const [i, m] of found.entries()) {
        if (m.ref) {
          const want = await fetchRelease(m.ref);
          if (want) exact.push(this.row({ want, track: m.track, exact: true }, rates));
          await wait(config.discogsPaceMs);
        } else for (const g of m.groups) guesses.push(this.row({ group: g, track: m.track, exact: false }, rates));
        this.step(i + 1, found.length, t('radio.checking'));
      }
      const n = exact.length + guesses.length;
      this.list.replaceChildren(...[this.group('allExact', exact), this.group('allGuesses', guesses)].filter(Boolean));
      this.setAttribute('status', n ? 'review' : 'done');
      this.live.textContent = n ? tn('radio.found', n, { tracks: formatNumber(tracks.length) }) : t('radio.none', { tracks: formatNumber(tracks.length) });
      this.count();
    } catch (e) {
      this.setAttribute('status', 'error');
      this.live.textContent = t(e.message === 'empty' ? 'radio.empty' : 'radio.error', { handle });
    }
    this.progress.hidden = true;
  }

  /** A group of candidates (exact or guesses) under a checkbox that ticks or clears them all; null when empty. */
  group(key, rows) {
    if (!rows.length) return null;
    const all = el('input', { type: 'checkbox', name: 'all' });
    return el('li', {}, el('label', {}, all, el('span', { textContent: tn(`radio.${key}`, rows.length) })), el('ol', {}, ...rows));
  }

  /** The candidates' checkboxes, in `within` (a group) or the whole list. */
  boxes(within = this.list) {
    return [...within.querySelectorAll('input[name="record"]')];
  }

  /** One candidate: a checkbox, the record, its cheapest copy, and the track it comes from. */
  row({ want, group, track, exact }, rates) {
    const title = want ? [want.artist, want.title].filter(Boolean).join(' – ') : group.title;
    const box = el('input', { type: 'checkbox', name: 'record', checked: exact });
    box.dataset.record = JSON.stringify(want ? { want, track: track.uri } : { key: group.key, title: group.title, track: track.uri });
    const cheapest = group?.offers.reduce((a, b) => ((b.price ?? Infinity) < (a.price ?? Infinity) ? b : a));
    return el('li', {}, attrs(el('vf-radio-match', {},
      el('label', {}, box, el('span', { textContent: title })),
      cheapest?.price != null ? price(cheapest.price, cheapest.currency, rates, { from: group.offers.length > 1 }) : null,
      el('p', { textContent: t(exact ? 'radio.exact' : 'radio.guess', { track: track.title }) })), { exact: String(exact) }));
  }

  count() {
    for (const all of this.list.querySelectorAll('input[name="all"]')) {
      const boxes = this.boxes(all.closest('li'));
      const ticked = boxes.filter((b) => b.checked).length;
      all.checked = ticked === boxes.length;
      all.indeterminate = ticked > 0 && ticked < boxes.length;
    }
    const n = this.boxes().filter((b) => b.checked).length;
    this.addButton.hidden = !this.list.children.length;
    this.addButton.disabled = !n;
    this.addButton.textContent = tn('radio.add', n);
  }

  add() {
    const picked = this.boxes().filter((b) => b.checked).map((b) => JSON.parse(b.dataset.record));
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
