/**
 * A profile as a file, to move it to another browser without any account (savoir: profiles-and-sync):
 *   { format: "lpepfinder-profile", version: 2, name, exported, data: { "<store key>": value } }
 * with the current profile's stores under their plain keys (KEYS). Account state (what was synced or
 * published) stays out: it belongs to the account, which brings it back when signed in.
 * Importing merges into the current profile: records not there yet are added, settings missing here are taken.
 * Older files (a watchlist export, version 1, or a list of keys) still import their records.
 */
import { scoped } from './profiles.js';
import { load, update, today } from './store.js';
import { parseExport } from './share.js';

export const FORMAT = 'lpepfinder-profile';
const WATCH = 'vf.watch.v1';
/** The stores a profile keeps that travel with it (the watchlist first). */
export const KEYS = [WATCH, 'vf.watch.filters', 'vf.discogs.user', 'vf.discogs.collector', 'vf.dig', 'vf.sources'];

const read = (key) => { try { return localStorage.getItem(scoped(key)); } catch { return null; } };

export function exportProfile(name = '') {
  const data = {};
  for (const key of KEYS) {
    const raw = key === WATCH ? JSON.stringify(load()) : read(key);
    if (raw == null) continue;
    try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
  }
  return { format: FORMAT, version: 2, name, exported: today(), data };
}

/** A file's text into the current profile; returns how many records were added. Throws on a file it can't read. */
export function importProfile(text) {
  const file = JSON.parse(text);
  if (file?.format !== FORMAT) {
    const records = parseExport(text);
    let added = 0;
    update((list) => {
      for (const { key, title, url, offer, state } of records) {
        if (list.items[key]) continue;
        list.items[key] = { t: title || '', a: today(), ...(url ? { u: url } : {}), ...(offer ? { o: offer } : {}), ...(state ? { s: state } : {}) };
        added++;
      }
      if (added) list.fresh = (list.fresh || 0) + added;
    });
    return added;
  }
  const data = file.data || {};
  let added = 0;
  const theirs = data[WATCH];
  if (theirs?.items) {
    update((list) => {
      for (const [key, it] of Object.entries(theirs.items)) {
        if (list.items[key] || !/^[0-9a-f]{12}$/.test(key)) continue;
        list.items[key] = it;
        added++;
      }
      if (Array.isArray(theirs.owned)) {
        list.owned = [...new Set([...(list.owned || []), ...theirs.owned])];
        if (theirs.ownedAt && !list.ownedAt) list.ownedAt = theirs.ownedAt;
      }
      if (added) list.fresh = (list.fresh || 0) + added;
    });
  }
  for (const key of KEYS) {
    if (key === WATCH || !(key in data) || read(key) != null) continue;
    try { localStorage.setItem(scoped(key), typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key])); } catch {}
  }
  return added;
}
