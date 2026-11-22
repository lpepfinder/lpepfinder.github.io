import { sources, checkDiscogs, freshness, checkRadio, radioFreshness, disconnect, restore, activity, EVENT, STEP } from '../lib/watch/sources.js';
import { forget } from '../lib/watch/source.js';
import { load, update } from '../lib/watch/store.js';
import { toast } from './vf-toast.js';
import { currentAccount } from '../lib/atproto/accounts.js';
import { el, attrs, listen, unlisten } from './dom.js';
import { t, tn, formatAgo, formatNumber } from './i18n.js';
import './vf-menu.js';

const icon = (name) => attrs(el('vf-icon'), { name });
const ICONS = { all: 'record', wants: 'star', collection: 'shelf', radio: 'play', search: 'search' };
// the card of a list and the source of its records (src/lib/watch/source.js)
const SOURCE = { wants: 'discogs', radio: 'radio' };

/**
 * <vf-watch-sources>: the overview of the watchlist, one <vf-source> card per place its records come from:
 *   <vf-source kind="all|wants|radio|search|collection|add" source="all|discogs|radio|search" state="none|current|changed|old|new">
 * A card says how many records are watched and in stock; picking it (a radio input, name="source") shows only its
 * records in every view, the page listening to "change". A connected list's card has a ⋯ menu: Sync now, Disconnect
 * (its records stay) and Remove its records, each undone from the toast. While its import runs, sheet open or
 * closed, the card shows its progress and Show; a radio's matches waiting in the sheet show as "n to review".
 * A list's card also says whether it is up to date
 * (Discogs counts checked at most daily, the radio's newest track: sources.js), with Resync when it changed or is
 * old, or Find records when the radio has tracks not read yet. The collection marks records Owned: a card without
 * records to pick. Lists not connected yet are in "Add a list", a menu; with nothing watched, they are cards of
 * their own, each with what it brings and Connect.
 * Set `view` to { counts: { all: { n, in, shops, fresh }, discogs: { n, in }, … }, source, empty } (vf-watch-page).
 */
export class VfWatchSources extends HTMLElement {
  disconnectedCallback() { unlisten(this); this.checking?.abort(); }

  connectedCallback() {
    this.list = this.querySelector('ul');
    listen(this, window, EVENT, () => this.render());
    // an import's step only moves its card's bar: re-rendering would close an open menu
    listen(this, window, STEP, (e) => this.step(e.detail));
    this.addEventListener('click', (e) => {
      const act = e.target.closest('button[name="show"], button[name="disconnect"], button[name="forget"]');
      if (act) return this[act.name](act.value);
      const connect = e.target.closest('button[name="connect"]');
      if (connect) return this.connect(connect.value);
      const button = e.target.closest('button[name="resync"], button[name="sync"]');
      if (button?.value === 'radio') this.readRadio();
      else if (button) this.resync(button.value);
    });
    this.render();
    this.check();
  }

  set view(view) {
    this.data = view;
    this.render();
  }

  async check() {
    this.checking?.abort();
    this.checking = new AbortController();
    const { signal } = this.checking;
    await Promise.all([
      checkDiscogs({ signal }).catch(() => {}),
      checkRadio({ handle: currentAccount()?.handle, signal }).catch(() => {}),
    ]);
  }

  render() {
    const s = sources();
    const { counts = {}, source = 'all', empty = true } = this.data || {};
    const lists = { wants: freshness('wants', s), collection: freshness('collection', s), radio: radioFreshness(s) };
    // a list being read for the first time already has its card, to show how far it got
    for (const kind of Object.keys(lists)) if (!lists[kind] && activity()[kind]) lists[kind] = { state: 'current', handle: s.radio?.handle, at: null };
    // nothing watched yet: every list as a card that says what it brings
    if (empty) {
      const rows = ['wants', 'collection', 'radio'].map((kind) => (lists[kind] ? this.listCard(kind, lists[kind], s, null, source) : this.none(kind)));
      this.list.replaceChildren(...rows.map((row) => el('li', {}, row)));
      return;
    }
    const cards = [this.card('all', null, t('sources.all'), this.counts(counts.all, true), source)];
    for (const kind of ['wants', 'radio']) {
      if (lists[kind]) cards.push(this.listCard(kind, lists[kind], s, counts[SOURCE[kind]], source));
      else if (counts[SOURCE[kind]]?.n) cards.push(this.card(kind, null, t(kind === 'wants' ? 'sources.wantsNone' : 'radio.title'), this.counts(counts[SOURCE[kind]]), source));
    }
    if (counts.search?.n) cards.push(this.card('search', null, t('sources.search'), this.counts(counts.search), source));
    if (lists.collection) cards.push(this.listCard('collection', lists.collection, s, null, source));
    const missing = ['wants', 'collection', 'radio'].filter((kind) => !lists[kind]);
    if (missing.length) cards.push(this.addCard(missing));
    this.list.replaceChildren(...cards.map((card) => el('li', {}, card)));
  }

  /** "9,812 watched · 410 in stock", the stock first; for all records, the shops and the new ones too. */
  counts(c = {}, all = false) {
    const parts = [
      el('strong', { textContent: t('sources.inStock', { count: formatNumber(c.in || 0) }) }),
      ' · ', tn('watchPage.summaryWatched', c.n || 0),
    ];
    if (all && c.shops) parts.push(' · ', tn('results.shops', c.shops));
    if (all && c.fresh) parts.push(' · ', tn('watchPage.summaryNew', c.fresh));
    return el('span', {}, ...parts);
  }

  /**
   * A connected list: its records and whether it's up to date, with its action when it isn't, and its ⋯ menu.
   * While it's being read, its progress instead, with Show (the sheet); a radio's matches to review, with Review.
   */
  listCard(kind, f, s, counts, source) {
    const radio = kind === 'radio';
    const known = radio ? f.handle : s.discogs?.user;
    const label = !known ? this.noneLabel(kind) : radio ? t('sources.radio', { handle: f.handle }) : t(`sources.${kind}`, { user: s.discogs.user });
    const busy = activity()[kind];
    const note = busy ? [] : radio ? this.radioNote(f) : this.discogsNote(f, kind);
    const button = (name, glyph, text) => attrs(el('button', { type: 'button', name, value: kind }, icon(glyph), text), { kind: 'secondary' });
    const action = busy ? button('show', busy.status === 'review' ? 'search' : 'expand', t(busy.status === 'review' ? 'sources.review' : 'sources.show'))
      : f.state === 'current' ? null
      : button('resync', f.state === 'new' ? 'search' : 'refresh', t(f.state === 'new' ? 'radio.find' : 'sources.resync'));
    const detail = counts ? this.counts(counts) : null;
    const card = attrs(this.card(kind, f.state, label, detail, counts && f.state !== 'new' ? source : null, note, action), { state: f.state, busy: busy?.status || null });
    if (busy) card.querySelector(':scope > :is(label, div)').after(this.busyNote(kind, busy));
    else card.append(this.menu(kind, label));
    return card;
  }

  /** "Syncing… 1,200 records so far" over a bar, or "12 records to review". */
  busyNote(kind, busy) {
    if (busy.status === 'review') return el('small', { textContent: tn('sources.toReview', busy.n) });
    const bar = el('progress', { max: busy.total || 1, value: busy.done });
    if (!busy.total) bar.removeAttribute('value');
    const text = kind === 'radio' ? t('sources.reading') : busy.n ? t('sources.syncingCount', { count: formatNumber(busy.n) }) : t('sources.syncing');
    return el('vf-progress', {}, el('label', { textContent: text }), bar);
  }

  /** An import moved on: its card's bar and words, without re-rendering the cards. */
  step(kind) {
    const busy = activity()[kind];
    const old = this.querySelector(`vf-source[kind="${kind}"] > vf-progress`);
    if (busy && old) old.replaceWith(this.busyNote(kind, busy));
  }

  /** The ⋯ menu of a connected list. */
  menu(kind, name) {
    const id = `source-menu-${kind}`;
    const item = (action, glyph, text, hint) => el('li', {}, el('button', { type: 'button', name: action, value: kind }, icon(glyph), el('span', {}, el('b', { textContent: text }), hint ? el('small', { textContent: hint }) : null)));
    return el('vf-menu', {},
      attrs(el('button', { type: 'button', title: t('sources.menu', { name }) }, icon('more')), { popovertarget: id, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': t('sources.menu', { name }), kind: 'text' }),
      attrs(el('menu', { id },
        item('sync', 'refresh', t('sources.syncNow')),
        item('disconnect', 'close', t('sources.disconnect'), kind === 'collection' ? null : t('sources.disconnectHint')),
        item('forget', 'close', kind === 'collection' ? t('sources.forgetOwned') : t('sources.forget'), kind === 'collection' ? null : t('sources.forgetHint'))), { popover: '' }));
  }

  /** The name a list goes by in messages: "Discogs wantlist · digger", "Radio4000 · @dj". */
  nameOf(kind) {
    const s = sources();
    return kind === 'radio' ? t('sources.radio', { handle: s.radio?.handle }) : t(`sources.${kind}`, { user: s.discogs?.user });
  }

  /** Stop following a list; its records stay. Undo from the toast. */
  disconnect(kind) {
    const name = this.nameOf(kind);
    const saved = structuredClone(sources());
    disconnect(kind);
    toast(t('sources.disconnected', { name }), [t('watchPage.undo'), () => restore(saved)]);
  }

  /** Stop following a list and remove its records (the collection: its Owned marks). Undo from the toast. */
  forget(kind) {
    const name = this.nameOf(kind);
    const saved = structuredClone(sources());
    const before = structuredClone(load());
    let removed = 0;
    update((list) => {
      if (kind === 'collection') { removed = list.owned?.length || 0; list.owned = []; delete list.ownedAt; return; }
      const out = forget(list.items, SOURCE[kind]);
      list.items = out.items;
      removed = out.removed;
    });
    disconnect(kind);
    this.closest('vf-watch-page')?.refresh();
    toast(tn('sources.forgotten', removed, { name }), [t('watchPage.undo'), () => {
      update((list) => { list.items = before.items; list.owned = before.owned; if (before.ownedAt) list.ownedAt = before.ownedAt; });
      restore(saved);
      this.closest('vf-watch-page')?.refresh();
    }]);
  }

  /** The sheet where a list's import runs, opened on it. */
  show(kind) {
    const page = this.closest('vf-watch-page') || document;
    const sheet = page.querySelector(`vf-sheet[name="${kind === 'radio' ? 'radio' : 'discogs'}"]`);
    sheet?.open();
    sheet?.querySelector(kind === 'radio' ? 'vf-radio-import' : 'vf-watch-import')?.scrollIntoView({ block: 'start' });
  }

  /** Up to date or what changed on Discogs, and when it was read; the count only for the collection (no records to show). */
  discogsNote(f, kind) {
    return [
      f.state === 'changed' ? tn(f.diff > 0 ? 'sources.more' : 'sources.fewer', Math.abs(f.diff)) : f.state === 'current' ? t('sources.current') : null,
      kind === 'collection' && f.n != null ? tn('sources.count', f.n) : null, t('sources.read', { ago: formatAgo(f.at) }),
    ];
  }

  radioNote(f) {
    if (f.state === 'new') return [t('sources.radioNew')];
    return [f.state === 'changed' ? t('sources.radioAdded') : t('sources.current'), f.n == null ? null : tn('sources.tracks', f.n), t('sources.read', { ago: formatAgo(f.at) })];
  }

  /**
   * One card. With `current` (the source shown), its name and counts are a radio input that shows its records;
   * notes say whether the list is up to date; the action sits beside.
   */
  card(kind, state, label, detail, current, notes = [], action = null) {
    const source = kind === 'all' ? 'all' : kind === 'search' ? 'search' : SOURCE[kind];
    const pick = current != null && source;
    const body = [icon(ICONS[kind]), el('b', { textContent: label }), detail];
    const head = pick
      ? el('label', {}, el('input', { type: 'radio', name: 'source', value: source, checked: source === current }), ...body)
      : el('div', {}, ...body);
    const note = notes.filter(Boolean).join(' · ');
    return attrs(el('vf-source', {}, head, note ? el('small', { textContent: note }) : null, action), { kind, state: state || 'current', source: pick ? source : null });
  }

  /** The lists not connected yet, in one menu. */
  addCard(kinds) {
    const id = 'add-list-menu';
    return attrs(el('vf-source', {}, el('vf-menu', {},
      attrs(el('button', { type: 'button' }, icon('plus'), t('sources.add')), { popovertarget: id, 'aria-haspopup': 'menu', 'aria-expanded': 'false', kind: 'secondary' }),
      attrs(el('menu', { id }, ...kinds.map((kind) => el('li', {},
        el('button', { type: 'button', name: 'connect', value: kind }, icon(ICONS[kind]), el('span', {}, el('b', { textContent: this.noneLabel(kind) }), el('small', { textContent: t(`sources.${kind}Hint`) })))))), { popover: '' }))),
    { kind: 'add', state: 'none' });
  }

  noneLabel(kind) { return kind === 'radio' ? t('radio.title') : t(`sources.${kind}None`); }

  /** A list not connected yet, while nothing is watched: what it brings, and Connect. */
  none(kind) {
    const action = attrs(el('button', { type: 'button', name: 'connect', value: kind }, icon('plus'), t(kind === 'collection' ? 'sources.import' : 'sources.connect')), { kind: 'secondary' });
    return this.card(kind, 'none', this.noneLabel(kind), null, null, [t(`sources.${kind}Hint`)], action);
  }

  /** The radio's reading in the sheet, with its matches to review. */
  readRadio() {
    const page = this.closest('vf-watch-page') || document;
    const sheet = page.querySelector('vf-sheet[name="radio"]');
    const importer = sheet?.querySelector('vf-radio-import');
    if (!importer) return;
    sheet.open();
    importer.scrollIntoView({ block: 'start' });
    importer.read(sources().radio.handle);
  }

  /** Connect a list: the Discogs sheet (the collection is read at once when the username is known), or the radio's. */
  connect(kind) {
    const page = this.closest('vf-watch-page') || document;
    if (kind === 'collection' && sources().discogs?.user) return this.resync('collection');
    const sheet = page.querySelector(`vf-sheet[name="${kind === 'radio' ? 'radio' : 'discogs'}"]`);
    const importer = sheet?.querySelector('vf-watch-import');
    if (importer) importer.kind = kind;
    sheet?.open();
    sheet?.querySelector('input:not([type="file"])')?.focus();
  }

  /** The Discogs sheet's import, for the profile's username, with its progress in view. */
  resync(kind) {
    const page = this.closest('vf-watch-page') || document;
    const sheet = page.querySelector('vf-sheet[name="discogs"]');
    const importer = sheet?.querySelector('vf-watch-import');
    if (!importer) return;
    importer.user.value = sources().discogs?.user || importer.user.value;
    importer.kind = kind === 'collection' ? 'collection' : 'wants';
    sheet.open();
    if (kind === 'collection') importer.fromCollection(); else importer.fromDiscogs();
  }
}
customElements.define('vf-watch-sources', VfWatchSources);
