import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarize, writeWatchFiles } from './watch-files.js';
import { settings, offer, run, settled } from './fixtures.js';

const shops = new Map(['a.com', 'b.com', 'c.com'].map((id) => [id, { id, url: `https://${id}` }]));
const KEY = 'abcdef123456';

test('now: the cheapest offer in stock, counts of in stock and sold out', () => {
  const offers = [offer('a.com', '/1', { price: 3000 }), offer('b.com', '/1', { price: 1800 }), offer('c.com', '/1', { available: false, price: 900 })];
  const ledger = settled(offers);
  assert.deepEqual(summarize(ledger, shops, settings).get(KEY), [2, 1, 1800, 'EUR', 'Artist – /1', 'https://b.com/1']);
});

test('now: without stock, the sold-out offer seen last', () => {
  const ledger = settled([offer('a.com', '/1', { price: 3000 }), offer('b.com', '/1', { price: 1800 })]);
  run(ledger, [offer('a.com', '/1', { available: false, price: 3000 })], '2026-11-03');
  // b.com is not crawled today: its offer is not counted as in stock
  assert.deepEqual(summarize(ledger, shops, settings).get(KEY), [0, 2, 3000, 'EUR', 'Artist – /1', 'https://a.com/1']);
});

test('watch files: shards, daily events and index', () => {
  const ledger = settled([offer('a.com', '/1'), offer('a.com', '/2', { releaseKey: null })]);
  run(ledger, [offer('a.com', '/1'), offer('a.com', '/3'), offer('a.com', '/4', { releaseKey: null })], '2026-11-03');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w-'));
  try {
    writeWatchFiles({ ledger, shops, outDir: dir, settings });
    const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.deepEqual(Object.keys(read('now/abc.json')), [KEY]);
    assert.deepEqual(read('index.json').dates, ['2026-11-01', '2026-11-02', '2026-11-03']);
    // events without a release key are left out
    assert.deepEqual(read('d/2026-11-03.json').map((e) => e[2]), ['new']);
    assert.deepEqual(read('d/2026-11-01.json'), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
