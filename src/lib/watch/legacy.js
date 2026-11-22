/**
 * What browsers kept from features removed on 2026-11-22 (Bluesky accounts and profiles), handled once.
 * Remove this file, its card on Me (vf-legacy-profiles.js) and its call in Base.astro after 2027-03-01.
 *
 * - Bluesky: the accounts, sync and publishing state, and the OAuth session (IndexedDB) are deleted. The records a
 *   person synced stay in their Bluesky account until they delete them there (docs/accounts.md).
 * - Profiles: one list per browser now, the first profile's (its keys are the plain keys). Each other profile keeps
 *   its data under "key:<id>" until the person downloads it as a file, merges it into the list, or removes it.
 */
import { exportProfile, importProfile } from './transfer.js';

const PROFILES = 'vf.profiles';
const ACCOUNT_KEYS = ['vf.atproto.accounts', 'vf.at.synced', 'vf.publish', 'vf.publish.sent'];
const storage = () => { try { return localStorage; } catch { return null; } };
const keysOf = (store) => Array.from({ length: store.length }, (_, i) => store.key(i)).filter(Boolean);

/** Forget the Bluesky state in this browser, once per page load (cheap when there is none). */
export function cleanUpAccounts(store = storage()) {
  if (!store) return;
  for (const key of keysOf(store)) if (ACCOUNT_KEYS.some((k) => key === k || key.startsWith(`${k}:`))) store.removeItem(key);
  try { if (store === globalThis.localStorage) indexedDB.deleteDatabase('@atproto-oauth-client'); } catch {}
}

/** The profiles other than the first that still have data here: [{ id, name, current }]. */
export function otherProfiles(store = storage()) {
  let saved = null;
  try { saved = JSON.parse(store?.getItem(PROFILES) || 'null'); } catch {}
  const list = Array.isArray(saved?.list) ? saved.list : [];
  const keys = store ? keysOf(store) : [];
  return list
    .filter((p) => p && typeof p.id === 'string' && p.id !== 'default' && keys.some((k) => k.endsWith(`:${p.id}`)))
    .map((p) => ({ id: p.id, name: String(p.name || '').slice(0, 60), current: saved.current === p.id }));
}

/** A profile as the same file Share › Download makes (transfer.js), read from its own keys. */
export const fileOf = (p, store = storage()) => exportProfile(p.name, (key) => store?.getItem(`${key}:${p.id}`) ?? null);

/** A profile's records and settings into the list (the list's own settings win); then its data goes. Returns records added. */
export function merge(p, store = storage()) {
  const added = importProfile(JSON.stringify(fileOf(p, store)));
  drop(p, store);
  return added;
}

/** A profile's data gone from this browser; the profiles list too once no other profile has data. */
export function drop(p, store = storage()) {
  if (!store) return;
  for (const key of keysOf(store)) if (key.endsWith(`:${p.id}`)) store.removeItem(key);
  let saved = null;
  try { saved = JSON.parse(store.getItem(PROFILES) || 'null'); } catch {}
  const list = (saved?.list || []).filter((x) => x?.id !== p.id);
  store.setItem(PROFILES, JSON.stringify({ current: 'default', list }));
  // no other profile with data left: the profiles list has nothing more to say
  if (!otherProfiles(store).length) store.removeItem(PROFILES);
}

