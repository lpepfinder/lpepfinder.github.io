import { test } from 'node:test';
import assert from 'node:assert/strict';

// the browser globals the watch modules use
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i], get length() { return store.size; } };
globalThis.dispatchEvent = () => true;

// a radio on its PDS: records newest first, pages of `page`
const DID = 'did:plc:dj';
let radio = [];
const calls = [];
globalThis.fetch = async (url) => {
  calls.push(url);
  const u = new URL(url);
  if (u.pathname.endsWith('getRecord')) {
    const r = radio.find((x) => x.rkey === u.searchParams.get('rkey'));
    return r ? { ok: true, json: async () => ({ value: { title: r.title, url: r.url } }) } : { ok: false, status: 404 };
  }
  if (u.pathname.startsWith('/did:')) return { ok: true, json: async () => ({ service: [{ id: '#atproto_pds', serviceEndpoint: 'https://pds.example' }] }) };
  const from = Number(u.searchParams.get('cursor') || 0);
  const records = radio.slice(from, from + 100).map((r) => ({ uri: `at://${DID}/radio.4000.track/${r.rkey}`, value: { title: r.title, url: r.url } }));
  return { ok: true, json: async () => ({ records, cursor: from + 100 < radio.length ? String(from + 100) : undefined }) };
};
const track = (n) => ({ rkey: `t${String(n).padStart(4, '0')}`, title: `Artist ${n} - Song ${n}`, url: `https://example.com/${n}` });
const { syncTracks, trackOf, findTrack, kept } = await import('../../src/lib/watch/radio-tracks.js');
const { add, load } = await import('../../src/lib/watch/store.js');
const pds = { did: DID, pds: 'https://pds.example' };

test('a radio is read in full once, then only for the tracks added since', async () => {
  store.clear(); calls.length = 0;
  radio = Array.from({ length: 250 }, (_, i) => track(250 - i));
  let r = await syncTracks('dj.example', pds);
  assert.equal(r.tracks.length, 250);
  assert.equal(r.added, 250);
  assert.equal(calls.length, 3);
  assert.equal(r.tracks[0].uri, `at://${DID}/radio.4000.track/t0250`);

  // two tracks added: one request, stopped at the first track kept already
  calls.length = 0;
  radio = [track(252), track(251), ...radio];
  r = await syncTracks('dj.example', pds);
  assert.equal(calls.length, 1);
  assert.equal(r.added, 2);
  assert.equal(r.tracks.length, 252);
  assert.equal(r.tracks[0].title, 'Artist 252 - Song 252');
  assert.equal(kept().tracks.length, 252);
});

test('another radio, or an old reading, is read in full again (deleted tracks go)', async () => {
  store.clear();
  radio = [track(3), track(2), track(1)];
  await syncTracks('dj.example', pds);
  radio = [track(3), track(1)];
  const later = Date.now() + 40 * 86_400_000;
  const r = await syncTracks('dj.example', pds, { now: later });
  assert.deepEqual(r.tracks.map((t) => t.title), ['Artist 3 - Song 3', 'Artist 1 - Song 1']);
  assert.equal(r.added, 0);
});

test('a track by its at:// uri: kept here, else read from its radio', async () => {
  store.clear();
  radio = [track(2), track(1)];
  await syncTracks('dj.example', pds);
  assert.equal(trackOf(`at://${DID}/radio.4000.track/t0001`).url, 'https://example.com/1');
  assert.equal(trackOf('at://did:plc:other/radio.4000.track/t0001'), null);
  store.clear();
  const found = await findTrack(`at://${DID}/radio.4000.track/t0002`);
  assert.equal(found.title, 'Artist 2 - Song 2');
  assert.equal(await findTrack(`at://${DID}/radio.4000.track/gone`), null);
});

test('a record found again for another track keeps both tracks', () => {
  store.clear();
  add([{ key: 'abcdefabcdef', title: 'A – B', fields: { p: ['at://x/radio.4000.track/1'] } }]);
  add([{ key: 'abcdefabcdef', title: 'A – B', fields: { p: ['at://x/radio.4000.track/2', 'at://x/radio.4000.track/1'] } }]);
  assert.deepEqual(load().items.abcdefabcdef.p, ['at://x/radio.4000.track/1', 'at://x/radio.4000.track/2']);
});
