/**
 * Sync between a profile's watchlist (store.js) and its Bluesky account (docs/accounts.md):
 *   com.lpepfinder.want     one record per record watched on this site, keyed by its release key
 *   com.lpepfinder.profile  "self": the Discogs username, so any device re-imports the Discogs lists
 * Wants imported from Discogs (`d` on the item) are not written: Discogs keeps them, the username brings them back.
 * Records are public.
 *
 * The account is a remote (savoir: profiles-and-sync). Every change is kept in the browser at once; what waits
 * to be sent is the difference between the watchlist and what the account was last known to hold ("vf.at.synced",
 * plan()), so it survives reloads and going offline, and is sent in one go: a moment after each change, when the
 * browser is back online, and every config.retryMs while the server can't be reached. Pull on page load.
 */
import { load, update, EVENT as WATCH_EVENT } from '../watch/store.js';
import { scoped } from '../watch/profiles.js';
import { currentAccount } from './accounts.js';
import { synced } from '../watch/sources.js';
import { publishAll, pending } from './publish.js';
import { sessionFor } from './session.js';
import { notReached, httpError } from './reach.js';
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
  if (!res.ok) throw httpError(nsid, res.status);
  return res.status === 200 ? res.json().catch(() => ({})) : {};
};

/** How many writes wait for the account: wants to create, update or delete, and published lists to rewrite. */
export function waiting() {
  if (!currentAccount()) return 0;
  return plan(load().items, get(SYNCED(), {})).writes.length + pending();
}

/**
 * The account's wants into the watchlist: new ones added, ones deleted elsewhere removed. A want deleted here
 * and not sent yet (in "synced", gone from the list) stays deleted: the next push deletes it on the account.
 */
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
      if (list.items[key] || key in synced) continue;
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

/**
 * Keep the current profile's account in sync: pull and send what waits now, push after changes, send again
 * when back online and on a timer while the server can't be reached. onState({ state, waiting }):
 * state "syncing", "synced", "offline" (not reached: the changes wait) or "error" (refused).
 */
export function keepInSync(onState) {
  let timer;
  let publishing;
  let retry;
  let busy = Promise.resolve();
  let last = 'synced';
  const report = (state = last) => { last = state; onState?.({ state, waiting: waiting() }); };
  // one run at a time, in order: a push never overlaps a pull
  const run = (fn) => (busy = busy.then(async () => {
    clearTimeout(retry);
    report('syncing');
    try {
      await fn();
      synced();
      report('synced');
    } catch (e) {
      if (notReached(e)) {
        report('offline');
        retry = setTimeout(sendAll, config.retryMs);
      } else { console.error(e); report('error'); }
    }
  }));
  const sendAll = () => currentAccount() && run(async () => { await push(); await publishAll(); });
  addEventListener(WATCH_EVENT, () => {
    if (!currentAccount()) return;
    report();
    clearTimeout(timer);
    timer = setTimeout(() => run(push), config.syncDelayMs);
    // published lists (publish.js) are whole files: rewritten once the list has settled
    clearTimeout(publishing);
    publishing = setTimeout(() => run(publishAll), config.publishDelayMs);
  });
  addEventListener('online', sendAll);
  addEventListener('vf-watch-imported', () => currentAccount() && run(pushProfile));
  if (!currentAccount()) return Promise.resolve();
  return run(async () => { await pull(); await push(); await publishAll(); });
}
