import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notReached, httpError } from '../../src/lib/atproto/reach.js';

test('reach: offline, a failed fetch, or a busy server wait; a refusal does not', () => {
  assert.equal(notReached(new Error('x'), false), true);
  assert.equal(notReached(new TypeError('Failed to fetch'), true), true);
  assert.equal(notReached(new Error('wrapped', { cause: new TypeError('fetch') }), true), true);
  assert.equal(notReached(httpError('putRecord', 503), true), true);
  assert.equal(notReached(httpError('putRecord', 429), true), true);
  assert.equal(notReached(httpError('putRecord', 400), true), false);
  assert.equal(notReached(httpError('putRecord', 401), true), false);
});
