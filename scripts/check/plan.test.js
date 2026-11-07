import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkKind } from './plan.js';

const now = Date.parse('2026-11-07T03:00:00Z');
const ago = (d) => new Date(now - d * 864e5).toISOString();
const opts = { source: 'https://shop.example', now, fullDays: 7, deadMaxDays: 30 };
const ok = { status: 'ok', checkedAt: ago(2), source: 'https://shop.example' };

test('alive shops: robots.txt only between weekly full checks', () => {
  assert.equal(checkKind(ok, opts), 'light');
  assert.equal(checkKind({ ...ok, checkedAt: ago(7) }, opts), 'full');
  assert.equal(checkKind({ ...ok, status: 'listed' }, opts), 'light');
});

test('a full check for new shops, a failed crawl, a changed address', () => {
  assert.equal(checkKind(undefined, opts), 'full');
  assert.equal(checkKind(ok, { ...opts, crawlError: true }), 'full');
  assert.equal(checkKind(ok, { ...opts, source: 'https://store.example' }), 'full');
  // states from before `source` was kept: no change assumed
  assert.equal(checkKind({ ...ok, source: undefined }, opts), 'light');
});

test('dead shops wait longer the longer they are dead; bot-protected and other states wait a week', () => {
  assert.equal(checkKind({ status: 'dead', checkedAt: ago(1), deadSince: ago(1) }, opts), 'full');
  assert.equal(checkKind({ status: 'dead', checkedAt: ago(3), deadSince: ago(20) }, opts), 'skip');
  assert.equal(checkKind({ status: 'dead', checkedAt: ago(10), deadSince: ago(20) }, opts), 'full');
  assert.equal(checkKind({ status: 'dead', checkedAt: ago(29), deadSince: ago(400) }, opts), 'skip');
  assert.equal(checkKind({ status: 'dead', checkedAt: ago(30), deadSince: ago(400) }, opts), 'full');
  assert.equal(checkKind({ ...ok, status: 'listed', reason: 'bot_protection_403' }, opts), 'skip');
  assert.equal(checkKind({ ...ok, status: 'not-music' }, opts), 'skip');
  assert.equal(checkKind({ ...ok, status: 'blocked', checkedAt: ago(8) }, opts), 'full');
});
