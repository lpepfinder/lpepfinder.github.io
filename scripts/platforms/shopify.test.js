import test from 'node:test';
import assert from 'node:assert/strict';
import { servedCurrency } from './shopify.js';

test('served currency: from /cart.js, with the market cookie; null when the cart says nothing usable', async () => {
  const calls = [];
  const get = async (url, opts) => { calls.push([url, opts.headers?.cookie]); return { ok: true, data: { currency: 'USD' } }; };
  assert.equal(await servedCurrency('https://shop.jp', 'JP', get), 'USD');
  assert.deepEqual(calls, [['https://shop.jp/cart.js', 'localization=JP']]);
  assert.equal(await servedCurrency('https://shop.jp', 'JP', async () => ({ ok: false, status: 429 })), null);
  assert.equal(await servedCurrency('https://shop.jp', 'JP', async () => ({ ok: true, data: { currency: 'yen' } })), null);
});
