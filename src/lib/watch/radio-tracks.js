/**
 * A Radio4000 radio's tracks, kept in this browser (per profile, "vf.radio.tracks"), so a radio is read once
 * and then only for what was added: the first reading takes every track (up to config.radio.maxTracks); later
 * ones read from the newest until a track already kept. Every config.radio.fullEveryDays, or for another radio,
 * it is read in full again (tracks deleted on the radio go too).
 *   { handle, did, at: ISO time of the last full reading, tracks: [[rkey, title, url, discogsUrl?], …] newest first }
 * A track's atproto address is at://<did>/radio.4000.track/<rkey>: watched records keep it (store.js `p`) to
 * link back to the track they were found for.
 */
import { listTracks, getTrack, COLLECTION } from './radio.js';
import { scoped } from './profiles.js';
import config from '../../../data/watch.json' with { type: 'json' };

const KEY = () => scoped('vf.radio.tracks');
const DAY = 86_400_000;

export function kept() {
  try { return JSON.parse(localStorage.getItem(KEY())) || null; } catch { return null; }
}

function keep(radio) {
  try { localStorage.setItem(KEY(), JSON.stringify(radio)); } catch {
    // storage full: the radio is read in full next time
  }
}

const uriOf = (did, rkey) => `at://${did}/${COLLECTION}/${rkey}`;
const asTrack = (did, [rkey, title, url, discogsUrl]) => ({ uri: uriOf(did, rkey), title, url, discogsUrl: discogsUrl || '' });

/**
 * The radio's tracks, newest first, reading only what was added since they were kept.
 * { did, pds } from radio.resolve(); returns { tracks, added } (added: tracks new to this browser).
 */
export async function syncTracks(handle, { did, pds }, { full = false, now = Date.now() } = {}) {
  const before = kept();
  const same = before && before.did === did && Array.isArray(before.tracks);
  const whole = full || !same || now - Date.parse(before.at || 0) > config.radio.fullEveryDays * DAY;
  const known = new Set(whole ? [] : before.tracks.map((t) => t[0]));
  const fresh = await listTracks({ did, pds }, { limit: config.radio.maxTracks, stop: (rkey) => known.has(rkey) });
  const rows = fresh.map((t) => [t.rkey, t.title, t.url, ...(t.discogsUrl ? [t.discogsUrl] : [])]);
  const tracks = whole ? rows : [...rows, ...before.tracks].slice(0, config.radio.maxTracks);
  keep({ handle, did, at: whole ? new Date(now).toISOString() : before.at, tracks });
  const had = new Set(same ? before.tracks.map((t) => t[0]) : []);
  return { tracks: tracks.map((t) => asTrack(did, t)), added: rows.filter((r) => !had.has(r[0])).length };
}

/** A kept track by its at:// uri, or null (a radio not read in this browser). */
export function trackOf(uri) {
  const radio = kept();
  const m = /^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/.exec(uri || '');
  if (!radio || !m || m[1] !== radio.did) return null;
  const row = radio.tracks.find((t) => t[0] === m[2]);
  return row ? asTrack(radio.did, row) : null;
}

const fetched = new Map();
/** A track kept here, else read once from its radio (per page); null when it can't be read (deleted, offline). */
export function findTrack(uri) {
  const here = trackOf(uri);
  if (here) return Promise.resolve(here);
  if (!fetched.has(uri)) fetched.set(uri, getTrack(uri).catch(() => null));
  return fetched.get(uri);
}
