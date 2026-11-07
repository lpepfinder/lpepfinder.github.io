import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.addEventListener ??= () => {};
globalThis.dispatchEvent ??= () => true;
const { profiles, scoped, add, use, remove, DEFAULT } = await import('../../src/lib/watch/profiles.js');

test('profiles: the default keeps the original keys, others get their own, removing one removes its lists', () => {
  assert.deepEqual(profiles(), { current: DEFAULT, list: [{ id: DEFAULT, name: '' }] });
  assert.equal(scoped('vf.watch.v1'), 'vf.watch.v1');
  const shop = add('Shop');
  assert.equal(profiles().current, shop);
  assert.equal(scoped('vf.watch.v1'), `vf.watch.v1:${shop}`);
  localStorage.setItem(`vf.watch.v1:${shop}`, '{}');
  use(DEFAULT);
  assert.equal(scoped('vf.watch.v1'), 'vf.watch.v1');
  remove(shop);
  assert.equal(localStorage.getItem(`vf.watch.v1:${shop}`), null);
  assert.deepEqual(profiles().list.map((p) => p.id), [DEFAULT]);
  remove(DEFAULT);
  assert.equal(profiles().list.length, 1);
});
