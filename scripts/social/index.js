import path from 'node:path';
import { config } from '../lib/config.js';
import { readJson, writeJson } from '../lib/json.js';
import { GENERATED } from '../lib/paths.js';
import { json, count } from '../enrich/http.js';
import { build } from './collect.js';
import atproto from '../../data/atproto.json' with { type: 'json' };

/**
 * npm run social: the collectors feed (docs/feed.md). Finds the accounts that published a list (opt-in,
 * com.lpepfinder.list) through the relay, reads each one's lists from its own account server, and writes
 * generated/social.json (served as /social.json) and generated/social-state.json (each collector's wants, to
 * tell tomorrow what is new). Refresh keeps both in the "data" release.
 */
const opts = config.social;
const OUT = path.join(GENERATED, 'social.json');
const STATE = path.join(GENERATED, 'social-state.json');
const LIST = atproto.collections.list;
const previous = readJson(OUT, { events: [] });
const before = readJson(STATE, {});

async function dids() {
  const out = [];
  let cursor = '';
  do {
    const page = await json(`${opts.relay}/xrpc/com.atproto.sync.listReposByCollection?collection=${LIST}&limit=500${cursor ? `&cursor=${cursor}` : ''}`);
    out.push(...(page?.repos || []).map((r) => r.did));
    cursor = page?.cursor;
  } while (cursor && out.length < opts.maxCollectors);
  return out.slice(0, opts.maxCollectors);
}

async function collector(did) {
  const doc = did.startsWith('did:web:') ? await json(`https://${did.slice(8)}/.well-known/did.json`) : await json(`${atproto.services.plcDirectory}/${did}`);
  const pds = doc?.service?.find((s) => s.id.endsWith('#atproto_pds'))?.serviceEndpoint;
  if (!pds) return null;
  const handle = (doc.alsoKnownAs || []).find((a) => a.startsWith('at://'))?.slice(5) || did;
  const record = (rkey) => json(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=${LIST}&rkey=${rkey}`);
  const blob = (r) => r?.value?.items?.ref?.$link ? json(`${pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${r.value.items.ref.$link}`) : null;
  const wantsList = await record('wants');
  const collectionList = await record('collection');
  const wantsBlob = await blob(wantsList);
  const collectionBlob = await blob(collectionList);
  const profile = await json(`${atproto.services.appview}/xrpc/app.bsky.actor.getProfile?actor=${did}`);
  const wants = new Map((wantsBlob?.items || []).filter(([k]) => /^[0-9a-f]{12}$/.test(k)).map(([k, t]) => [k, t || '']));
  const owned = (collectionBlob?.keys || []).filter((k) => /^[0-9a-f]{12}$/.test(k));
  if (!wants.size && !owned.length) return null;
  return {
    did, handle: profile?.handle || handle, name: profile?.displayName || '', avatar: profile?.avatar || '',
    wants, owned, updatedAt: [wantsList?.value?.updatedAt, collectionList?.value?.updatedAt].filter(Boolean).sort().pop() || null,
  };
}

const found = await dids();
const collectors = [];
for (const did of found) {
  const c = await collector(did).catch((e) => { console.error(`social: ${did}: ${e.message}`); return null; });
  if (c) collectors.push(c);
}
const today = new Date().toISOString().slice(0, 10);
const feed = build(collectors, before, previous.events || [], { today, ...opts });
writeJson(STATE, feed.state);
writeJson(OUT, {
  version: 1, builtAt: new Date().toISOString(),
  collectors: collectors.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .map((c) => ({ did: c.did, handle: c.handle, name: c.name, avatar: c.avatar, wants: c.wants.size, collection: c.owned.length, updatedAt: c.updatedAt })),
  wanted: feed.wanted, owned: feed.owned, top: feed.top, events: feed.events, titles: feed.titles,
});
console.log(`social: ${found.length} accounts, ${collectors.length} collectors, ${feed.events.length} events; requests:`, JSON.stringify(Object.fromEntries(count)));
