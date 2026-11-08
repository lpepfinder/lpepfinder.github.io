import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/** A localStorage stand-in, installed before the modules read it. */
class Store {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
globalThis.localStorage = new Store();

const P = await import('../../src/lib/watch/profiles.js');
const A = await import('../../src/lib/atproto/accounts.js');

beforeEach(() => { globalThis.localStorage = new Store(); P.resetProfiles(); });

test('profiles: the first profile is local and keeps what was kept before profiles', () => {
  localStorage.setItem('vf.watch.v1', '{"items":{"aaaaaaaaaaaa":{}}}');
  const { current, list } = P.profiles();
  assert.equal(current, P.DEFAULT);
  assert.deepEqual(list, [{ id: P.DEFAULT, name: '' }]);
  assert.equal(P.scoped('vf.watch.v1'), 'vf.watch.v1');
  assert.equal(A.currentAccount(), null);
});

test('profiles: each profile reads and writes its own keys', () => {
  const id = P.add('Gifts');
  assert.equal(P.profiles().current, id);
  assert.equal(P.scoped('vf.watch.v1'), `vf.watch.v1:${id}`);
  P.use(P.DEFAULT);
  assert.equal(P.scoped('vf.watch.v1'), 'vf.watch.v1');
  // read again from storage, as after the reload a switch makes
  P.resetProfiles();
  assert.equal(P.profiles().current, P.DEFAULT);
  assert.equal(P.profiles().list.length, 2);
});

test('profiles: removing one deletes only its data; the first one stays', () => {
  const id = P.add('Shop');
  localStorage.setItem(`vf.watch.v1:${id}`, '{}');
  localStorage.setItem(`vf.sources:${id}`, '{}');
  localStorage.setItem(`vf.publish.sent:${id}`, '{}');
  localStorage.setItem('vf.watch.v1', '{"items":{}}');
  P.remove(id);
  assert.equal(localStorage.getItem(`vf.watch.v1:${id}`), null);
  assert.equal(localStorage.getItem(`vf.sources:${id}`), null);
  assert.equal(localStorage.getItem(`vf.publish.sent:${id}`), null);
  assert.equal(localStorage.getItem('vf.watch.v1'), '{"items":{}}');
  assert.equal(P.profiles().current, P.DEFAULT);
  P.remove(P.DEFAULT);
  assert.equal(P.profiles().list.length, 1);
});

test('accounts: signing in attaches the account to the local profile in use', () => {
  const moved = A.remember({ did: 'did:plc:one', handle: 'one.test' });
  assert.equal(moved, false);
  assert.equal(P.currentProfile().did, 'did:plc:one');
  assert.equal(P.currentProfile().name, '@one.test');
  assert.deepEqual(A.currentAccount(), { did: 'did:plc:one', handle: 'one.test' });
});

test('accounts: one account per profile; signing in again opens its profile', () => {
  A.remember({ did: 'did:plc:one', handle: 'one.test' });
  // a second account while the profile in use has one: a new profile for it
  assert.equal(A.remember({ did: 'did:plc:two', handle: 'two.test' }), true);
  const two = P.currentProfile();
  assert.equal(two.did, 'did:plc:two');
  assert.notEqual(two.id, P.DEFAULT);
  // the first account again: back to its own profile
  assert.equal(A.remember({ did: 'did:plc:one', handle: 'one.test' }), true);
  assert.equal(P.profiles().current, P.DEFAULT);
  assert.equal(P.profiles().list.filter((p) => p.did === 'did:plc:one').length, 1);
});

test('accounts: signing out keeps the profile and its data, local again', () => {
  A.remember({ did: 'did:plc:one', handle: 'one.test' });
  localStorage.setItem('vf.watch.v1', '{"items":{}}');
  A.forget('did:plc:one');
  assert.equal(P.currentProfile().did, undefined);
  assert.equal(A.currentAccount(), null);
  assert.equal(localStorage.getItem('vf.watch.v1'), '{"items":{}}');
});

test('profiles: a profile made for an account before (id "at:<did>") keeps its data and gets its did', () => {
  localStorage.setItem('vf.profiles', JSON.stringify({ current: 'at:did:plc:old', list: [{ id: 'default', name: '' }, { id: 'at:did:plc:old', name: '@old.test' }] }));
  localStorage.setItem('vf.atproto.accounts', JSON.stringify([{ did: 'did:plc:old', handle: 'old.test' }]));
  P.resetProfiles();
  assert.equal(P.currentProfile().did, 'did:plc:old');
  assert.equal(P.scoped('vf.watch.v1'), 'vf.watch.v1:at:did:plc:old');
  assert.equal(A.currentAccount().handle, 'old.test');
  assert.equal(A.remember({ did: 'did:plc:old', handle: 'old.test' }), false);
});
