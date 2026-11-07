import { test } from 'node:test';
import assert from 'node:assert/strict';

// the browser globals the watch modules use
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.dispatchEvent = () => true;
const calls = [];
let totals = {};
globalThis.fetch = async (url) => {
  calls.push(url);
  const kind = url.includes('/wants') ? 'wants' : 'collection';
  if (!(kind in totals)) return { ok: false, status: 403 };
  return { ok: true, status: 200, json: async () => ({ pagination: { items: totals[kind] } }) };
};
const { sources, imported, checkDiscogs, freshness } = await import('../../src/lib/watch/sources.js');
const config = (await import('../../data/watch.json', { with: { type: 'json' } })).default;

test('a list just imported is current; Discogs counts that differ make it "changed"', async () => {
  store.clear(); calls.length = 0;
  imported('wants', 'digger', 120);
  assert.equal(freshness('wants').state, 'current');
  assert.equal(freshness('collection'), null);
  totals = { wants: 125 };
  await checkDiscogs({ force: true });
  // only the lists imported before are asked for, one record per page
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/users\/digger\/wants\?per_page=1&page=1$/);
  const f = freshness('wants');
  assert.deepEqual([f.state, f.diff], ['changed', 5]);
  // a new import of the same list makes it current again
  imported('wants', 'digger', 125);
  assert.equal(freshness('wants').state, 'current');
});

test('checks at most every discogsCheckHours; a failed check keeps the last counts', async () => {
  store.clear(); calls.length = 0;
  imported('wants', 'digger', 10);
  totals = { wants: 10 };
  await checkDiscogs({ force: true });
  await checkDiscogs();
  assert.equal(calls.length, 1);
  totals = {};
  await checkDiscogs({ force: true });
  assert.equal(sources().discogs.remote.wants, 10);
});

test('an unchanged list read long ago is "old"', () => {
  store.clear();
  imported('collection', 'digger', 40);
  const s = sources();
  s.discogs.collection.at = new Date(Date.now() - (config.discogsStaleDays + 1) * 864e5).toISOString();
  assert.equal(freshness('collection', s).state, 'old');
});

test('a list imported before sources were kept: its first check sets the counts', async () => {
  store.clear(); calls.length = 0;
  store.set('vf.discogs.user', 'olddigger');
  store.set('vf.watch.v1', JSON.stringify({ items: { a: { t: 'x', a: '2026-10-01', d: 1 }, b: { t: 'y', a: '2026-10-03', d: 1 } }, owned: ['k'], ownedAt: '2026-09-01' }));
  const before = freshness('wants');
  assert.equal(before.n, null);
  assert.equal(before.at, '2026-10-03T00:00:00.000Z');
  totals = { wants: 900, collection: 300 };
  await checkDiscogs({ force: true });
  assert.equal(calls.length, 2);
  assert.deepEqual([freshness('wants').n, freshness('collection').n], [900, 300]);
});

test('another username starts over', () => {
  store.clear();
  imported('wants', 'a', 5);
  imported('collection', 'b', 7);
  assert.equal(sources().discogs.user, 'b');
  assert.equal(freshness('wants'), null);
});
