import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, fromEvents, fromState, state } from '../../src/lib/watch/diff.js';
import { encodeKeys, decodeKeys, keysFromHash, parseExport } from '../../src/lib/watch/share.js';
import { releaseKey } from '../../src/lib/search/release-key.js';

const K1 = 'a3f9c01b22de';
const K2 = '0b1c2d3e4f50';

test('plan: daily files after the last check, shards for new items and long absences', () => {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
  const items = {
    [K1]: { a: '2026-10-20', s: [1, 0, 100, 'EUR'] },
    [K2]: { a: '2026-11-02' },
  };
  const p = plan(items, '2026-11-01', dates);
  assert.deepEqual([...p.events], [[K1, '2026-11-01'], [K2, '2026-11-02']]);
  assert.deepEqual(p.shards, [K2]);
  assert.deepEqual(p.dates, ['2026-11-02', '2026-11-03']);
  const away = plan(items, '2026-10-01', dates);
  assert.ok(away.shards.includes(K1) && !away.events.has(K1));
  assert.deepEqual(plan({}, null, dates).dates, []);
});

test('events: only watched keys, only after their start day, with the date', () => {
  const events = new Map([[K1, '2026-11-01'], [K2, '2026-11-03']]);
  const rows = [[K1, 'o1', 'restock', 4500, 'EUR', 'Melvins - X', 'https://s/x', 'shop'], [K2, 'o2', 'new', 1, 'EUR', 't', 'u', 's'], ['ffffffffffff', 'o', 'new', 1, 'EUR', 't', 'u', 's']];
  assert.deepEqual(fromEvents(rows, '2026-11-02', events), [[...rows[0], '2026-11-02']]);
  assert.deepEqual(fromEvents(null, '2026-11-02', events), []);
});

test('state changes after a long absence', () => {
  const now = (n, min) => [n, 1, min, 'EUR'];
  const was = (s) => ({ t: 'Melvins – X', u: 'https://shop/x', s });
  assert.deepEqual(fromState(K1, was([0, 1, null, null]), now(2, 900), 'd'), [K1, null, 'restock', 900, 'EUR', 'Melvins – X', 'https://shop/x', null, 'd']);
  assert.equal(fromState(K1, was([2, 0, 900, 'EUR']), now(0, null), 'd')[2], 'soldout');
  assert.equal(fromState(K1, was([2, 0, 900, 'EUR']), now(2, 800), 'd')[2], 'price-down');
  assert.equal(fromState(K1, was([2, 0, 900, 'EUR']), now(2, 900), 'd'), null);
  assert.equal(fromState(K1, { t: 'new' }, now(2, 900), 'd'), null);
  assert.deepEqual(state(undefined), [0, 0, null, null]);
});

test('share links round-trip release keys', () => {
  const enc = encodeKeys([K1, K2, 'not-a-key']);
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeKeys(enc), [K1, K2]);
  assert.deepEqual(keysFromHash(`#w=${enc}`), [K1, K2]);
  assert.deepEqual(keysFromHash('#x=1'), []);
  assert.deepEqual(parseExport(JSON.stringify({ items: { [K1]: { t: 'A', u: 'https://s/a' }, bad: {} } })), [{ key: K1, title: 'A', url: 'https://s/a', offer: undefined, state: undefined }]);
});
