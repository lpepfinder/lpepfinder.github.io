import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipsTo } from './ships-to.js';

test('ships_to_countries becomes sorted unique country codes', () => {
  assert.deepEqual(shipsTo(['US', 'ca', ' GB ', 'US']), ['CA', 'GB', 'US']);
});

test('the rest-of-world zone stays as "*"', () => {
  assert.deepEqual(shipsTo(['DE', '*']), ['*', 'DE']);
});

test('invalid entries are dropped', () => {
  assert.deepEqual(shipsTo(['FR', 'France', '', null, 7, 'EUR', 'X']), ['FR']);
});

test('unknown shipping is an empty list', () => {
  for (const v of [undefined, null, 'US', {}, []]) assert.deepEqual(shipsTo(v), []);
});
