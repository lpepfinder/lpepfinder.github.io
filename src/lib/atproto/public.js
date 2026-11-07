/**
 * Someone's public lists, read in the browser from their own account (no sign-in): what /u/?h=<handle> shows.
 *   handle -> DID and account server (radio.js resolve) -> the published lists (com.lpepfinder.list, their blobs),
 *   the records watched one by one (com.lpepfinder.want), the Discogs username (com.lpepfinder.profile),
 *   and the Bluesky profile (name, avatar, bio) from the public app view.
 * Returns { did, handle, name, avatar, description, discogs, wants: Map key -> { t, w, i }, wantsAt, collection: { count, keys, at } }.
 */
import { resolve } from '../watch/radio.js';
import config from '../../../data/atproto.json' with { type: 'json' };

const { list: LIST, want: WANT, profile: PROFILE } = config.collections;
/** Records watched one by one, read at most this many (a published list has the rest). */
const MAX_WANT_RECORDS = 2000;

const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export async function readUser(handle) {
  const { did, pds } = await resolve(handle);
  const xrpc = (nsid, params) => json(`${pds}/xrpc/${nsid}?${new URLSearchParams({ repo: did, ...params })}`);
  const blob = (record) => {
    const cid = record?.value?.items?.ref?.$link;
    return cid ? json(`${pds}/xrpc/com.atproto.sync.getBlob?${new URLSearchParams({ did, cid })}`) : null;
  };
  const [bsky, wantsList, collectionList, profile] = await Promise.all([
    json(`${config.services.appview}/xrpc/app.bsky.actor.getProfile?${new URLSearchParams({ actor: did })}`),
    xrpc('com.atproto.repo.getRecord', { collection: LIST, rkey: 'wants' }),
    xrpc('com.atproto.repo.getRecord', { collection: LIST, rkey: 'collection' }),
    xrpc('com.atproto.repo.getRecord', { collection: PROFILE, rkey: 'self' }),
  ]);
  const [wantsBlob, collectionBlob] = await Promise.all([blob(wantsList), blob(collectionList)]);

  const wants = new Map();
  for (const [key, t, w, i] of wantsBlob?.items || []) if (/^[0-9a-f]{12}$/.test(key)) wants.set(key, { t, ...(w ? { w } : {}), ...(i ? { i } : {}) });
  // records watched on the site, one record each (public too)
  let cursor;
  let read = 0;
  do {
    const page = await xrpc('com.atproto.repo.listRecords', { collection: WANT, limit: '100', ...(cursor ? { cursor } : {}) });
    for (const r of page?.records || []) {
      const key = r.uri.split('/').pop();
      if (!wants.has(key)) wants.set(key, { t: r.value.title || '', ...(r.value.discogsRelease ? { w: r.value.discogsRelease } : {}) });
    }
    read += page?.records?.length || 0;
    cursor = page?.cursor;
  } while (cursor && read < MAX_WANT_RECORDS);

  return {
    did, handle: bsky?.handle || handle, name: bsky?.displayName || '', avatar: bsky?.avatar || '', description: bsky?.description || '',
    discogs: profile?.value?.discogs || wantsList?.value?.discogs || collectionList?.value?.discogs || '',
    wants, wantsAt: wantsList?.value?.updatedAt || null,
    collection: { count: collectionList?.value?.count || 0, keys: collectionBlob?.keys || [], at: collectionList?.value?.updatedAt || null },
  };
}
