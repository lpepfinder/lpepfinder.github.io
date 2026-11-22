import { test } from 'node:test';
import assert from 'node:assert/strict';

// a localStorage with key(i) and length, as legacy.js walks every key
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k),
  key: (i) => [...data.keys()][i] ?? null, get length() { return data.size; },
};
globalThis.dispatchEvent = () => true;
globalThis.indexedDB = { deleteDatabase: () => {} };
const { otherProfiles, fileOf, merge, drop, cleanUpAccounts } = await import('../../src/lib/watch/legacy.js');
const { load } = await import('../../src/lib/watch/store.js');

const KEY_A = 'aaaaaaaaaaaa';
const KEY_B = 'bbbbbbbbbbbb';
function setUp() {
  data.clear();
  data.set('vf.profiles', JSON.stringify({ current: 'p2', list: [{ id: 'default', name: 'Me' }, { id: 'p1', name: 'Shop' }, { id: 'p2', name: 'Gifts' }, { id: 'p3', name: 'Empty' }] }));
  data.set('vf.watch.v1', JSON.stringify({ items: { [KEY_A]: { t: 'Mine', a: '2026-11-01' } }, changes: [], past: [] }));
  data.set('vf.watch.v1:p1', JSON.stringify({ items: { [KEY_B]: { t: 'For the shop', a: '2026-11-02' } }, changes: [], past: [] }));
  data.set('vf.discogs.user:p1', 'shopdigger');
  data.set('vf.watch.v1:p2', JSON.stringify({ items: { [KEY_A]: { t: 'Mine too', a: '2026-11-03' } }, changes: [], past: [] }));
}

test('the other profiles with data are offered, the one in use until now marked', () => {
  setUp();
  assert.deepEqual(otherProfiles(), [{ id: 'p1', name: 'Shop', current: false }, { id: 'p2', name: 'Gifts', current: true }]);
  // its file holds its own stores, under the plain keys
  const file = fileOf({ id: 'p1', name: 'Shop' });
  assert.equal(file.format, 'lpepfinder-profile');
  assert.deepEqual(Object.keys(file.data['vf.watch.v1'].items), [KEY_B]);
  assert.equal(file.data['vf.discogs.user'], 'shopdigger');
});

test('merging adds a profile\'s new records and settings missing here, then its data goes', () => {
  setUp();
  assert.equal(merge({ id: 'p1', name: 'Shop' }), 1);
  assert.deepEqual(Object.keys(load().items).sort(), [KEY_A, KEY_B]);
  assert.equal(data.get('vf.discogs.user'), 'shopdigger');
  assert.equal(data.has('vf.watch.v1:p1'), false);
  // a record already in the list isn't added twice
  assert.equal(merge({ id: 'p2', name: 'Gifts' }), 0);
  // nothing left: the profiles list goes too
  assert.deepEqual(otherProfiles(), []);
  assert.equal(data.has('vf.profiles'), false);
});

test('removing a profile drops only its keys', () => {
  setUp();
  drop({ id: 'p2' });
  assert.deepEqual(otherProfiles().map((p) => p.id), ['p1']);
  assert.ok(data.has('vf.watch.v1'));
  assert.equal(JSON.parse(data.get('vf.profiles')).current, 'default');
});

test('Bluesky state goes, the lists stay', () => {
  setUp();
  data.set('vf.atproto.accounts', '[]');
  data.set('vf.publish:p1', '{}');
  data.set('vf.at.synced', '{}');
  cleanUpAccounts();
  assert.deepEqual([...data.keys()].filter((k) => /atproto|publish|at\.synced/.test(k)), []);
  assert.ok(data.has('vf.watch.v1:p1'));
});
