import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.dispatchEvent = () => true;
const { payload, fingerprint } = await import('../../src/lib/atproto/publish.js');

test('a published wantlist: key, title, Discogs id and cover of every watched record', () => {
  const list = { items: { a3f9c01b22de: { t: 'Moodymann – Silentintroduction', w: 123, i: 'https://i.discogs.com/x.jpg', s: [1, 0, 2000, 'EUR'], a: '2026-11-01' }, '0b1c2d3e4f50': { t: 'Watched here' } }, owned: [] };
  const p = payload('wants', list);
  assert.equal(p.count, 2);
  assert.deepEqual(JSON.parse(p.body), { version: 1, kind: 'wants', items: [['a3f9c01b22de', 'Moodymann – Silentintroduction', 123, 'https://i.discogs.com/x.jpg'], ['0b1c2d3e4f50', 'Watched here', 0, '']] });
  // stock states and dates aren't published: they change daily, the list doesn't
  assert.equal(fingerprint(p.body), fingerprint(payload('wants', { ...list, items: { ...list.items, a3f9c01b22de: { ...list.items.a3f9c01b22de, s: [0, 1, 0, 'EUR'] } } }).body));
});

test('a published collection is its release keys; empty lists are not published', () => {
  assert.deepEqual(JSON.parse(payload('collection', { items: {}, owned: ['k1', 'k2'] }).body), { version: 1, kind: 'collection', keys: ['k1', 'k2'] });
  assert.equal(payload('wants', { items: {}, owned: [] }), null);
  assert.equal(payload('collection', { items: {} }), null);
  assert.notEqual(fingerprint('a'), fingerprint('b'));
});
