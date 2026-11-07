/**
 * Sync between a profile's watchlist (store.js) and its Bluesky account (docs/accounts.md):
 *   com.lpepfinder.want     one record per record watched on this site, keyed by its release key
 *   com.lpepfinder.profile  "self": the Discogs username, so any device re-imports the Discogs lists
 * Wants imported from Discogs (`d` on the item) are not written: Discogs keeps them, the username brings them back.
 * Pull on start and on profile change; push the differences a moment after each change. Records are public.
 */
import { load, update, EVENT as WATCH_EVENT } from '../watch/store.js';
import { scoped, EVENT as PROFILE_EVENT } from '../watch/profiles.js';
import { currentAccount } from './accounts.js';
import { sessionFor } from './session.js';
import config from '../../../data/atproto.json' with { type: 'json' };

const { want: WANT, profile: PROFILE } = config.collections;
const SYNCED = () => scoped('vf.at.synced');
const DISCOGS = () => scoped('vf.discogs.user');
const get = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** The record of a watched item (null for Discogs-managed ones). */
export function wantRecord(it) {
  if (it.d) return null;
  return {
    $type: WANT, title: (it.t || '').slice(0, 1000), createdAt: `${it.a || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    ...(it.c ? { catno: it.c } : {}), ...(it.w ? { discogsRelease: it.w } : {}), ...(it.m != null ? { maxPrice: it.m } : {}),
  };
}
const hash = (r) => JSON.stringify({ ...r, createdAt: undefined });

/** Creates, updates and deletes that make the account match the watchlist (synced: { key: hash } last written). */
export function plan(items, synced) {
  const writes = [];
  const next = {};
  for (const [key, it] of Object.entries(items)) {
    const r = wantRecord(it);
    if (!r) continue;
    next[key] = hash(r);
    if (!(key in synced)) writes.push({ $type: 'com.atproto.repo.applyWrites#create', collection: WANT, rkey: key, value: r });
    else if (synced[key] !== next[key]) writes.push({ $type: 'com.atproto.repo.applyWrites#update', collection: WANT, rkey: key, value: r });
  }
  for (const key of Object.keys(synced)) if (!(key in next)) writes.push({ $type: 'com.atproto.repo.applyWrites#delete', collection: WANT, rkey: key });
  return { writes, next };
}

const call = async (s, nsid, { params, body } = {}) => {
  const res = await s.fetchHandler(`/xrpc/${nsid}${params ? `?${new URLSearchParams(params)}` : ''}`, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!res.ok) throw new Error(`${nsid} ${res.status}`);
  return res.status === 200 ? res.json().catch(() => ({})) : {};
};

/** The account's wants into the watchlist: new ones added, ones deleted elsewhere removed. */
export async function pull() {
  const account = currentAccount();
  if (!account) return;
  const s = await sessionFor(account.did);
  const server = new Map();
  let cursor;
  do {
    const page = await call(s, 'com.atproto.repo.listRecords', { params: { repo: account.did, collection: WANT, limit: '100', ...(cursor ? { cursor } : {}) } });
    for (const r of page.records || []) server.set(r.uri.split('/').pop(), r.value);
    cursor = page.cursor;
  } while (cursor);
  const synced = get(SYNCED(), {});
  update((list) => {
    for (const [key, v] of server) {
      if (list.items[key]) continue;
      list.items[key] = { t: v.title, a: (v.createdAt || '').slice(0, 10), ...(v.catno ? { c: v.catno } : {}), ...(v.discogsRelease ? { w: v.discogsRelease } : {}), ...(v.maxPrice != null ? { m: v.maxPrice } : {}) };
    }
    // written from here before, gone from the account now: removed on another device
    for (const key of Object.keys(synced)) if (!server.has(key) && list.items[key] && !list.items[key].d) delete list.items[key];
  });
  put(SYNCED(), Object.fromEntries([...server].map(([k, v]) => [k, hash({ $type: WANT, ...v })])));
  const profile = await call(s, 'com.atproto.repo.getRecord', { params: { repo: account.did, collection: PROFILE, rkey: 'self' } }).catch(() => null);
  if (profile?.value?.discogs && !localStorage.getItem(DISCOGS())) localStorage.setItem(DISCOGS(), profile.value.discogs);
}

/** The watchlist's differences to the account, in batches. */
export async function push() {
  const account = currentAccount();
  if (!account) return;
  const { writes, next } = plan(load().items, get(SYNCED(), {}));
  if (!writes.length) return;
  const s = await sessionFor(account.did);
  for (let i = 0; i < writes.length; i += config.writeBatch) {
    await call(s, 'com.atproto.repo.applyWrites', { body: { repo: account.did, writes: writes.slice(i, i + config.writeBatch) } });
  }
  put(SYNCED(), next);
}

/** The Discogs username into the account's profile record. */
export async function pushProfile() {
  const account = currentAccount();
  const discogs = localStorage.getItem(DISCOGS());
  if (!account || !discogs) return;
  const s = await sessionFor(account.did);
  await call(s, 'com.atproto.repo.putRecord', { body: { repo: account.did, collection: PROFILE, rkey: 'self', record: { $type: PROFILE, discogs, updatedAt: new Date().toISOString() } } });
}

/** Keep the current profile's account in sync: pull now and on profile change, push after changes. */
export function keepInSync(onState) {
  let timer;
  const run = async (fn) => { onState?.('syncing'); try { await fn(); onState?.('synced'); } catch (e) { console.error(e); onState?.('error'); } };
  const pullNow = () => currentAccount() && run(pull);
  addEventListener(PROFILE_EVENT, pullNow);
  addEventListener(WATCH_EVENT, () => {
    if (!currentAccount()) return;
    clearTimeout(timer);
    timer = setTimeout(() => run(push), config.syncDelayMs);
  });
  addEventListener('vf-watch-imported', () => currentAccount() && run(pushProfile));
  return pullNow();
}
