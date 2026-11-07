/**
 * Local profiles: several watchlists in one browser ("Me", "Shop", "Gifts"), each with its own records,
 * Discogs account, collection and filters. No account and nothing on a server: a profile is a set of
 * localStorage keys. The first profile ("default") keeps the original keys, so existing lists carry over.
 *   vf.profiles   { current: id, list: [{ id, name }] }
 * Anyone using this browser can open every profile: profiles separate lists, they don't protect them.
 */
const KEY = 'vf.profiles';
export const DEFAULT = 'default';
export const EVENT = 'vf-profile-change';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

export function profiles() {
  const saved = read();
  const list = saved?.list?.length ? saved.list : [{ id: DEFAULT, name: '' }];
  const current = list.some((p) => p.id === saved?.current) ? saved.current : list[0].id;
  return { current, list };
}

/** A storage key for the current profile: the key itself for the default profile, "key:id" for the others. */
export const scoped = (key, id = profiles().current) => (id === DEFAULT ? key : `${key}:${id}`);

/** Keys a profile owns, removed with it. */
const OWNED = ['vf.watch.v1', 'vf.watch.filters', 'vf.discogs.user', 'vf.discogs.collector', 'vf.dig'];

export function add(name) {
  const p = profiles();
  const id = `p${Date.now().toString(36)}`;
  write({ current: id, list: [...p.list, { id, name: name.trim() }] });
  dispatchEvent(new Event(EVENT));
  return id;
}

export function rename(id, name) {
  const p = profiles();
  write({ ...p, list: p.list.map((x) => (x.id === id ? { ...x, name: name.trim() } : x)) });
  dispatchEvent(new Event(EVENT));
}

export function use(id) {
  const p = profiles();
  if (!p.list.some((x) => x.id === id) || p.current === id) return;
  write({ ...p, current: id });
  dispatchEvent(new Event(EVENT));
}

/** Remove a profile and its lists; the default profile can't be removed (only emptied). */
export function remove(id) {
  if (id === DEFAULT) return;
  const p = profiles();
  for (const key of OWNED) { try { localStorage.removeItem(scoped(key, id)); } catch {} }
  const list = p.list.filter((x) => x.id !== id);
  write({ current: p.current === id ? list[0].id : p.current, list });
  dispatchEvent(new Event(EVENT));
}
