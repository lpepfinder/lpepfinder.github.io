import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, fromEvents, fromState, state } from '../../src/lib/watch/diff.js';
import { encodeKeys, decodeKeys, keysFromHash, parseExport } from '../../src/lib/watch/share.js';
import { cleanArtist, wantKeys, fromApi, fromCsv, parseCsv } from '../../src/lib/watch/discogs.js';
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
  const now = (n, min) => [n, 1, min, 'EUR', 'T', 'U'];
  assert.equal(fromState(K1, [0, 1, null, null], now(2, 900), 'd')[2], 'restock');
  assert.equal(fromState(K1, [2, 0, 900, 'EUR'], now(0, null), 'd')[2], 'soldout');
  assert.equal(fromState(K1, [2, 0, 900, 'EUR'], now(2, 800), 'd')[2], 'price-down');
  assert.equal(fromState(K1, [2, 0, 900, 'EUR'], now(2, 900), 'd'), null);
  assert.equal(fromState(K1, undefined, now(2, 900), 'd'), null);
  assert.deepEqual(state(undefined), [0, 0, null, null]);
});

test('share links round-trip release keys', () => {
  const enc = encodeKeys([K1, K2, 'not-a-key']);
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeKeys(enc), [K1, K2]);
  assert.deepEqual(keysFromHash(`#w=${enc}`), [K1, K2]);
  assert.deepEqual(keysFromHash('#x=1'), []);
  assert.deepEqual(parseExport(JSON.stringify({ items: { [K1]: { t: 'A' }, bad: {} } })), [{ key: K1, title: 'A', state: undefined }]);
});

test('discogs wants become release keys like shop titles', () => {
  assert.equal(cleanArtist('Prince (2)'), 'Prince');
  assert.equal(cleanArtist('Moodymann*'), 'Moodymann');
  const want = { basic_information: { title: 'Mangled Demos From 1983', artists: [{ name: 'Melvins (3)', anv: '', join: '' }], formats: [{ name: 'Vinyl', descriptions: ['10"'] }] } };
  const w = fromApi(want);
  assert.equal(w.vinyl, true);
  assert.equal(w.keys[0], releaseKey('Melvins - Mangled Demos From 1983 (10")'));
  const duo = wantKeys([{ name: 'Basic Channel', join: '&' }, { name: 'Rhythm & Sound', anv: 'R&S', join: '' }], 'Lost Tracks');
  assert.equal(duo[0], releaseKey('Basic Channel & Rhythm & Sound - Lost Tracks'));
  assert.ok(duo.includes(releaseKey('Basic Channel - Lost Tracks')));
  assert.equal(fromApi({ basic_information: { title: 'X Y', artists: [{ name: 'Z' }], formats: [{ name: 'CD' }] } }).vinyl, false);
});

test('discogs CSV export: quoted fields, vinyl formats', () => {
  const csv = '﻿Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,Notes\r\n'
    + 'BC-01,Basic Channel,"Quadrant Dub, Part 1",Basic Channel,"12"", Single",,1994,1,"a ""note"""\r\n'
    + 'X,Sun Ra (2),Lanquidity,Philly Jazz,"CD, Album, RE",,1978,2,\r\n';
  assert.equal(parseCsv(csv)[1][4], '12", Single');
  const wants = fromCsv(csv);
  assert.equal(wants.length, 2);
  assert.deepEqual(wants.map((w) => w.vinyl), [true, false]);
  assert.equal(wants[1].title, 'Sun Ra – Lanquidity');
  assert.equal(fromCsv('a,b\n1,2'), null);
});
