/**
 * Where the current profile's lists come from, and whether they are still up to date (docs/watchlist.md):
 *   discogs   { user, wants: { n, at }, collection: { n, at }, remote: { wants, collection }, checkedAt }
 *             n: records read at the last import; remote: the counts Discogs shows now (checked at most
 *             every config.discogsCheckHours, only for lists imported before, one light request each)
 *   bluesky   { at }: the last successful sync with the Bluesky account (sync.js)
 *   radio     { handle, n, at, newest, remote, checkedAt }: a Radio4000 radio (radio.js), the last one read or else
 *             the signed-in account's own; n tracks read at `at`, `newest` the newest track then, `remote` the
 *             newest track now (checked at most every config.discogsCheckHours, one light request)
 * Kept per profile in localStorage ("vf.sources"); every access is guarded.
 */
import { scoped } from './profiles.js';
import { fetchCounts } from './discogs.js';
import { resolve, newestTrack } from './radio.js';
import { load } from './store.js';
import config from '../../../data/watch.json' with { type: 'json' };

export const EVENT = 'vf-sources-change';
const KEY = () => scoped('vf.sources');
const HOUR = 36e5;
const DAY = 24 * HOUR;

export function sources() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY())); } catch {}
  return s || legacy();
}

/**
 * A list imported before sources were kept: its username and when its lists were read (the newest Discogs want
 * added, `ownedAt`). Its counts are unknown (n: null) until the first check, which sets them from Discogs.
 */
function legacy() {
  let user = '';
  try { user = localStorage.getItem(scoped('vf.discogs.user')) || ''; } catch {}
  if (!user) return {};
  const list = load();
  const wants = Object.values(list.items).filter((it) => it.d);
  const discogs = { user, remote: {} };
  if (wants.length) discogs.wants = { n: null, at: `${wants.map((it) => it.a).sort().pop()}T00:00:00.000Z` };
  if (list.owned?.length && list.ownedAt) discogs.collection = { n: null, at: `${list.ownedAt}T00:00:00.000Z` };
  return { discogs };
}

function change(fn) {
  const s = sources();
  fn(s);
  try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch {}
  dispatchEvent(new Event(EVENT));
  return s;
}

/** A Discogs list was read in full: `kind` "wants" or "collection", `n` records. */
export const imported = (kind, user, n) => change((s) => {
  const d = (s.discogs?.user === user ? s.discogs : null) || { user };
  d[kind] = { n, at: new Date().toISOString() };
  d.remote = { ...d.remote, [kind]: n };
  s.discogs = d;
});

export const synced = () => change((s) => { s.bluesky = { at: new Date().toISOString() }; });

/**
 * Ask Discogs for the current counts of the lists imported before (not more often than config.discogsCheckHours,
 * unless forced). Returns the sources; a failed check keeps the last known counts.
 */
export async function checkDiscogs({ force = false, signal } = {}) {
  const d = sources().discogs;
  if (!d?.user) return sources();
  if (!force && d.checkedAt && Date.now() - Date.parse(d.checkedAt) < config.discogsCheckHours * HOUR) return sources();
  const kinds = ['wants', 'collection'].filter((k) => d[k]);
  const counts = await fetchCounts(d.user, kinds, { signal }).catch(() => null);
  if (!counts) return sources();
  return change((s) => {
    if (s.discogs?.user !== d.user) return;
    s.discogs.remote = { ...s.discogs.remote, ...counts };
    for (const [kind, n] of Object.entries(counts)) if (s.discogs[kind] && s.discogs[kind].n == null) s.discogs[kind].n = n;
    s.discogs.checkedAt = new Date().toISOString();
  });
}

/**
 * The state of one Discogs list: "changed" (Discogs counts differ from the last import: `diff` more or fewer),
 * "old" (same count, but imported more than config.discogsStaleDays ago), "current", or null (never imported).
 */
export function freshness(kind, s = sources()) {
  const d = s.discogs;
  const list = d?.[kind];
  if (!list) return null;
  const remote = d.remote?.[kind];
  const diff = remote == null || list.n == null ? 0 : remote - list.n;
  if (diff) return { state: 'changed', diff, at: list.at, n: list.n, remote };
  if (Date.now() - Date.parse(list.at) > config.discogsStaleDays * DAY) return { state: 'old', diff: 0, at: list.at, n: list.n, remote };
  return { state: 'current', diff: 0, at: list.at, n: list.n, remote };
}

/** A radio's tracks were read and matched: `n` tracks, `newest` the uri of the newest. */
export const radioRead = (handle, n, newest) => change((s) => {
  const now = new Date().toISOString();
  s.radio = { handle, n, at: now, newest, remote: newest, checkedAt: now };
});

/**
 * Whether the radio has tracks the last reading didn't see: the radio read before, or the signed-in account's own
 * (`handle`), so a signed-in DJ is offered their radio. At most every config.discogsCheckHours unless forced.
 */
export async function checkRadio({ handle: own, force = false, signal } = {}) {
  const r = sources().radio;
  const handle = r?.handle || own;
  if (!handle) return sources();
  if (!force && r?.handle === handle && r.checkedAt && Date.now() - Date.parse(r.checkedAt) < config.discogsCheckHours * HOUR) return sources();
  const uri = await resolve(handle).then(newestTrack).catch(() => undefined);
  if (signal?.aborted || uri === undefined) return sources();
  return change((s) => {
    if (s.radio?.handle !== handle) s.radio = { handle };
    s.radio.remote = uri;
    s.radio.checkedAt = new Date().toISOString();
  });
}

/** "new" (tracks never read), "changed" (tracks added since), "current", or null (no radio, or no tracks). */
export function radioFreshness(s = sources()) {
  const r = s.radio;
  if (!r || (!r.at && !r.remote)) return null;
  const state = !r.at ? 'new' : r.remote && r.remote !== r.newest ? 'changed' : 'current';
  return { state, handle: r.handle, n: r.n ?? null, at: r.at || null };
}
