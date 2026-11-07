/**
 * Lists the account chose to publish (docs/accounts.md): the wantlist and the collection, each one
 * com.lpepfinder.list record ("wants", "collection") holding the list as a JSON blob, so 10,000 records are one
 * write. Off by default; turning one off deletes its record. What is published is public: /u/?h=<handle> shows it.
 * Per profile: settings in "vf.publish", the fingerprint of what was last sent in "vf.publish.sent".
 */
import { load } from '../watch/store.js';
import { scoped } from '../watch/profiles.js';
import { currentAccount } from './accounts.js';
import { sessionFor } from './session.js';
import config from '../../../data/atproto.json' with { type: 'json' };

export const KINDS = ['wants', 'collection'];
export const EVENT = 'vf-publish-change';
const LIST = config.collections.list;
const get = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** { wants: bool, collection: bool } for the current profile. */
export const settings = () => get(scoped('vf.publish'));

export class PublishError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** The blob of a list, from the current profile's watchlist: { body, count } (null for an empty list). */
export function payload(kind, list = load()) {
  if (kind === 'wants') {
    const items = Object.entries(list.items).map(([key, it]) => [key, it.t || '', it.w || 0, it.i || '']);
    return items.length ? { body: JSON.stringify({ version: 1, kind, items }), count: items.length } : null;
  }
  const keys = list.owned || [];
  return keys.length ? { body: JSON.stringify({ version: 1, kind, keys }), count: keys.length } : null;
}

/** FNV-1a of the body: an unchanged list is not sent again. */
export function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

async function xrpc(s, nsid, body, type = 'application/json') {
  const res = await s.fetchHandler(`/xrpc/${nsid}`, { method: 'POST', headers: { 'content-type': type }, body });
  // a session from before publishing existed lacks the blob permission: signing in again grants it
  if (res.status === 401 || res.status === 403) throw new PublishError('scope');
  if (!res.ok) throw new PublishError('network');
  return res.json().catch(() => ({}));
}

/** Write one list to the account, unless it is unchanged since it was last sent. */
export async function publish(kind) {
  const account = currentAccount();
  if (!account) return;
  const data = payload(kind);
  const sent = get(scoped('vf.publish.sent'));
  if (!data) return unpublish(kind);
  const print = fingerprint(data.body);
  if (sent[kind] === print) return;
  const s = await sessionFor(account.did);
  const { blob } = await xrpc(s, 'com.atproto.repo.uploadBlob', data.body, config.blobAccept);
  let discogs = null;
  try { discogs = localStorage.getItem(scoped('vf.discogs.user')); } catch {}
  await xrpc(s, 'com.atproto.repo.putRecord', JSON.stringify({
    repo: account.did, collection: LIST, rkey: kind,
    record: { $type: LIST, kind, count: data.count, items: blob, ...(discogs ? { discogs } : {}), updatedAt: new Date().toISOString() },
  }));
  put(scoped('vf.publish.sent'), { ...get(scoped('vf.publish.sent')), [kind]: print });
}

/** Delete a published list from the account. */
export async function unpublish(kind) {
  const account = currentAccount();
  const sent = get(scoped('vf.publish.sent'));
  if (!account || !(kind in sent)) return;
  const s = await sessionFor(account.did);
  await xrpc(s, 'com.atproto.repo.deleteRecord', JSON.stringify({ repo: account.did, collection: LIST, rkey: kind }));
  delete sent[kind];
  put(scoped('vf.publish.sent'), sent);
}

/** Turn publishing of a list on or off, and write or delete it now. */
export async function setPublish(kind, on) {
  put(scoped('vf.publish'), { ...settings(), [kind]: on });
  dispatchEvent(new Event(EVENT));
  return on ? publish(kind) : unpublish(kind);
}

/** The lists turned on, brought up to date (after changes, sync.js). */
export async function publishAll() {
  const on = settings();
  for (const kind of KINDS) if (on[kind]) await publish(kind);
}
