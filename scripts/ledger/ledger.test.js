import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyLedger } from './diff.js';
import { addDays } from './day.js';
import { offerKey } from './keys.js';
import { updateLedger } from './update.js';
import { settings, offer, run, kinds, settled } from './fixtures.js';

test('offerKey is 12 hex characters of shop and path', () => {
  assert.match(offerKey('a.com', '/x'), /^[0-9a-f]{12}$/);
  assert.notEqual(offerKey('a.com', '/x'), offerKey('b.com', '/x'));
});

test('a shop\'s first two crawls emit no new events, the third does', () => {
  const ledger = emptyLedger();
  assert.deepEqual(run(ledger, [offer('a.com', '/r1')], '2026-11-01'), []);
  assert.deepEqual(run(ledger, [offer('a.com', '/r1'), offer('a.com', '/r2')], '2026-11-02'), []);
  const events = run(ledger, [offer('a.com', '/r1'), offer('a.com', '/r2'), offer('a.com', '/r3')], '2026-11-03');
  assert.deepEqual(kinds(events), ['new:a.com/r3']);
  assert.deepEqual(events[0], ['abcdef123456', offerKey('a.com', '/r3'), 'new', 2000, 'EUR', 'Artist – /r3', 'https://a.com/r3', 'a.com']);
  assert.equal(ledger.meta.shops['a.com'].crawls, 3);
});

test('a new shop is guarded while an older one is not', () => {
  const ledger = settled([offer('a.com', '/r1')]);
  const events = run(ledger, [offer('a.com', '/r1'), offer('a.com', '/r2'), offer('b.com', '/r1')], '2026-11-03');
  assert.deepEqual(kinds(events), ['new:a.com/r2']);
});

test('sold out, restock, price down and gone', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2'), offer('a.com', '/r3'), offer('a.com', '/r4')]);
  const events = run(ledger, [
    offer('a.com', '/r1', { available: false }),
    offer('a.com', '/r2', { price: 1500 }),
    offer('a.com', '/r3', { price: 2500 }),
  ], '2026-11-03');
  assert.deepEqual(kinds(events), ['gone:a.com/r4', 'price-down:a.com/r2', 'soldout:a.com/r1']);
  const r1 = ledger.rows.get(offerKey('a.com', '/r1'));
  assert.equal(r1.status, 'out');
  assert.equal(r1.lastInStock, '2026-11-02');
  assert.equal(r1.lastSeen, '2026-11-03');
  const r2 = ledger.rows.get(offerKey('a.com', '/r2'));
  assert.deepEqual([r2.price, r2.lowPrice90], [1500, 1500]);
  assert.equal(ledger.rows.get(offerKey('a.com', '/r3')).lowPrice90, 2000);
  assert.equal(ledger.rows.get(offerKey('a.com', '/r4')).status, 'gone');

  const back = run(ledger, [offer('a.com', '/r1'), offer('a.com', '/r2', { price: 1500 }), offer('a.com', '/r4', { available: false })], '2026-11-04');
  assert.deepEqual(kinds(back), ['gone:a.com/r3', 'restock:a.com/r1']);
  assert.equal(ledger.rows.get(offerKey('a.com', '/r4')).status, 'out');
});

test('a shop without records today keeps its rows', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('b.com', '/r1')]);
  assert.deepEqual(run(ledger, [offer('a.com', '/r1')], '2026-11-03'), []);
  const row = ledger.rows.get(offerKey('b.com', '/r1'));
  assert.deepEqual([row.status, row.lastSeen], ['in', '2026-11-02']);
});

test('lowPrice90 forgets prices older than 90 days', () => {
  const ledger = settled([offer('a.com', '/r1', { price: 1000 })]);
  run(ledger, [offer('a.com', '/r1', { price: 3000 })], '2026-11-03');
  const row = ledger.rows.get(offerKey('a.com', '/r1'));
  assert.equal(row.lowPrice90, 1000);
  run(ledger, [offer('a.com', '/r1', { price: 3000 })], addDays('2026-11-03', 89));
  assert.equal(row.lowPrice90, 1000);
  run(ledger, [offer('a.com', '/r1', { price: 3000 })], addDays('2026-11-03', 91));
  assert.equal(row.lowPrice90, 3000);
  assert.equal(row.priceLog, undefined);
});

test('gone rows are dropped from the ledger a year after they were last seen', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2')]);
  run(ledger, [offer('a.com', '/r1')], '2026-11-03');
  assert.equal(ledger.rows.get(offerKey('a.com', '/r2')).status, 'gone');
  run(ledger, [offer('a.com', '/r1')], addDays('2026-11-02', 365));
  assert.ok(ledger.rows.has(offerKey('a.com', '/r2')));
  run(ledger, [offer('a.com', '/r1')], addDays('2026-11-02', 366));
  assert.ok(!ledger.rows.has(offerKey('a.com', '/r2')));
});

test('events are kept for 14 days', () => {
  const ledger = settled([offer('a.com', '/r0')]);
  for (let i = 0; i < 20; i++) run(ledger, [offer('a.com', '/r0')], addDays('2026-11-03', i));
  assert.equal(ledger.events.length, 14);
  assert.equal(ledger.events[0].day, addDays('2026-11-03', 19));
});

test('a day cannot be applied twice to the same ledger', () => {
  const ledger = settled([offer('a.com', '/r1')]);
  assert.throws(() => run(ledger, [], '2026-11-02'));
});

// updateLedger with catalog docs and files on disk
const shops = new Map([['a.com', { id: 'a.com', url: 'https://a.com', state: { currency: 'EUR' } }]]);
const doc = (p, extra = {}) => ({ shop: 'a.com', path: p, title: `Artist – Record ${p.slice(1)}`, price: 2000, available: true, ...extra });

async function day(dir, date, docs) {
  return updateLedger({ docs, shops, day: date, dir, settings });
}

test('running twice on one day gives the same ledger and events', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  try {
    await day(dir, '2026-11-01', [doc('/r1'), doc('/r2')]);
    await day(dir, '2026-11-02', [doc('/r1'), doc('/r2')]);
    const first = await day(dir, '2026-11-03', [doc('/r1', { available: false }), doc('/r3')]);
    const again = await day(dir, '2026-11-03', [doc('/r1', { available: false }), doc('/r3')]);
    assert.deepEqual(kinds(again.events), ['gone:a.com/r2', 'new:a.com/r3', 'soldout:a.com/r1']);
    assert.deepEqual(again.events, first.events);
    assert.deepEqual([...again.ledger.rows.values()], [...first.ledger.rows.values()]);
    assert.equal(again.ledger.meta.shops['a.com'].crawls, 3);
    assert.equal(again.ledger.events.length, 3);
    // a later crawl on the same day replaces the first one
    const changed = await day(dir, '2026-11-03', [doc('/r1'), doc('/r2')]);
    assert.deepEqual(changed.events, []);
    // and a run with an earlier date is refused
    await assert.rejects(day(dir, '2026-11-02', []));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
