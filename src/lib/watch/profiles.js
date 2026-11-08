/**
 * Profiles: separate spaces in this browser ("Me", "Shop", "Gifts"), each with its own watchlist, Discogs lists,
 * radio, filters and Dig settings, and each optionally signed in to one Bluesky account (savoir: profiles-and-sync,
 * the model joblist uses too). Local is the default: a profile needs no account, and nothing leaves the browser
 * until one is signed in. Profiles keep things apart, not secret: anyone using this browser can open them.
 *   vf.profiles   { current: id, list: [{ id, name, did? }] }
 *
 * A store keeps its data under scoped(key): the first profile ("default") under the key itself (what was kept
 * before profiles), the others under "key:id". Switching profile reloads the page (switchTo), so each store
 * simply reads its own key when it starts. Every storage access is guarded (private mode, blocked site data).
 */
const KEY = 'vf.profiles';
export const DEFAULT = 'default';

function storage() {
  try { return localStorage; } catch { return null; }
}

/** The profiles, checked; the first one always there. Profiles from before accounts were attached ("at:<did>") get their did. */
export function readProfiles(store = storage()) {
  let saved = null;
  try { saved = JSON.parse(store?.getItem(KEY) || 'null'); } catch {}
  const list = (Array.isArray(saved?.list) ? saved.list : [])
    .filter((p) => p && typeof p.id === 'string' && /^[\w:.-]{1,120}$/.test(p.id))
    .map((p) => {
      const did = typeof p.did === 'string' && p.did.startsWith('did:') ? p.did : p.id.startsWith('at:did:') ? p.id.slice(3) : null;
      return { id: p.id, name: String(p.name || '').slice(0, 60), ...(did ? { did } : {}) };
    });
  if (!list.some((p) => p.id === DEFAULT)) list.unshift({ id: DEFAULT, name: '' });
  const current = list.some((p) => p.id === saved?.current) ? saved.current : DEFAULT;
  return { current, list };
}

function writeProfiles(value, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(value)); } catch {}
}

/** Read once per page: switching reloads it. */
let loaded = null;
export const profiles = () => (loaded ??= readProfiles());
export const currentProfile = () => profiles().list.find((p) => p.id === profiles().current);

/** A storage key for the current profile (or another): the key itself for the default profile, "key:id" for the others. */
export const scoped = (key, id = profiles().current) => (id === DEFAULT ? key : `${key}:${id}`);

function update(change, store) {
  const next = structuredClone(profiles());
  change(next);
  writeProfiles(next, store);
  loaded = next;
}

/** A new profile, made current (the caller reloads). */
export function add(name, store) {
  const id = `p${Date.now().toString(36)}`;
  update((p) => { p.list.push({ id, name: name.trim().slice(0, 60) }); p.current = id; }, store);
  return id;
}

export function rename(id, name, store) {
  update((p) => { const found = p.list.find((x) => x.id === id); if (found) found.name = name.trim().slice(0, 60); }, store);
}

/** The profile to use from now on (the caller reloads). */
export function use(id, store) {
  update((p) => { if (p.list.some((x) => x.id === id)) p.current = id; }, store);
}

/** Use another profile: the page reloads, and every store reads that profile's keys. */
export function switchTo(id) {
  if (id === profiles().current) return;
  use(id);
  location.reload();
}

/**
 * An account signed in: it belongs to the profile that has it already (made current); else to the current
 * profile when that one has no account; else to a new profile named after it. Returns whether the current
 * profile changed (then the page reloads).
 */
export function attachAccount(did, handle, store) {
  const owner = profiles().list.find((p) => p.did === did);
  if (owner) {
    const moved = owner.id !== profiles().current;
    update((p) => { p.current = owner.id; }, store);
    return moved;
  }
  if (!currentProfile().did) {
    update((p) => {
      const current = p.list.find((x) => x.id === p.current);
      current.did = did;
      if (!current.name && handle) current.name = `@${handle}`;
    }, store);
    return false;
  }
  update((p) => {
    const id = `p${Date.now().toString(36)}`;
    p.list.push({ id, name: handle ? `@${handle}` : '', did });
    p.current = id;
  }, store);
  return true;
}

/** An account signed out, or its session gone: its profile stays, local again. */
export function detachAccount(did, store) {
  update((p) => { for (const x of p.list) if (x.did === did) delete x.did; }, store);
}

/**
 * A profile and everything it kept in this browser, gone (every "key:id"); the default profile can't be removed,
 * only emptied. Its account, if any, is the caller's to sign out (in this browser, never on the server).
 */
export function remove(id, store = storage()) {
  if (id === DEFAULT) return;
  if (store) {
    const own = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.endsWith(`:${id}`)) own.push(key);
    }
    for (const key of own) store.removeItem(key);
  }
  update((p) => {
    p.list = p.list.filter((x) => x.id !== id);
    if (p.current === id) p.current = DEFAULT;
  }, store);
}

/** For tests: forget what was read. */
export function resetProfiles() { loaded = null; }
