/**
 * A Radio4000 radio on atproto (radio.4000.track records, published lexicons: github.com/radio4000/r4atproto):
 * its tracks, read from the radio's own PDS in the browser. Public data, no login.
 *   handle -> DID (appview resolveHandle) -> PDS (DID document) -> com.atproto.repo.listRecords
 * A track: { title, url, discogsUrl } — discogsUrl is optional and, in practice, rare.
 */
import config from '../../../data/watch.json' with { type: 'json' };

const COLLECTION = 'radio.4000.track';
const json = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

/** "@someone.bsky.social", "someone.bsky.social" or a bsky.app / 4000.radio profile URL -> the handle. */
export const handleOf = (input) => String(input || '').trim()
  .replace(/^https?:\/\/[^/]+\/(profile\/)?/i, '').replace(/^@/, '').replace(/\/.*$/, '').toLowerCase();

export async function resolve(handle) {
  const { did } = await json(`${config.atproto.appview}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  const doc = did.startsWith('did:web:')
    ? await json(`https://${did.slice(8)}/.well-known/did.json`)
    : await json(`${config.atproto.plcDirectory}/${did}`);
  const pds = doc.service?.find((s) => s.id.endsWith('#atproto_pds'))?.serviceEndpoint;
  if (!pds) throw new Error('no-pds');
  return { did, pds };
}

/** The radio's latest tracks (newest first), at most `limit`. */
export async function latestTracks({ did, pds }, limit = config.radio.maxTracks) {
  const tracks = [];
  let cursor = '';
  while (tracks.length < limit) {
    const page = await json(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=${COLLECTION}&limit=100&reverse=false${cursor ? `&cursor=${cursor}` : ''}`);
    for (const r of page.records || []) tracks.push({ uri: r.uri, title: r.value.title || '', url: r.value.url || '', discogsUrl: r.value.discogsUrl || '' });
    cursor = page.cursor;
    if (!cursor || !page.records?.length) break;
  }
  return tracks.slice(0, limit);
}

/** The uri of the radio's newest track, or null: one light request, to tell whether tracks were added. */
export async function newestTrack({ did, pds }) {
  const page = await json(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=${COLLECTION}&limit=1`);
  return page.records?.[0]?.uri || null;
}

/** A Discogs link -> { kind: "release" | "master", id }, or null. */
export function discogsRef(url) {
  const m = /discogs\.com\/(?:[a-z]{2}\/)?(?:[^/]+\/)?(release|master)\/(\d+)/i.exec(url || '');
  return m ? { kind: m[1].toLowerCase(), id: Number(m[2]) } : null;
}

/** "Artist - Song (2019 Remaster)" -> { artist, song }, the song without bracketed versions; null without a separator. */
export function songOf(title) {
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(title || ''));
  if (!m) return null;
  const song = m[2].replace(/\s*[[(][^\])]*[\])]/g, '').trim();
  return song && m[1].trim() ? { artist: m[1].trim(), song } : null;
}
