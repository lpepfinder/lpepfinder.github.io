import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './day.js';
import { ledgerDocs } from './search-docs.js';
import { settings, offer, run, settled } from './fixtures.js';

const known = new Map([['a.com', { id: 'a.com' }]]);

test('gone offers stay searchable as sold out for 90 days, then drop from the index', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2', { available: false })]);
  const keep = [offer('a.com', '/r2', { available: false })];
  run(ledger, keep, '2026-11-03');
  const gone = ledgerDocs(ledger, [], known, settings);
  assert.deepEqual(gone.map((d) => [d.path, d.available, d.lastInStock]), [['/r1', false, '2026-11-02']]);
  run(ledger, keep, addDays('2026-11-02', 90));
  assert.equal(ledgerDocs(ledger, [], known, settings).length, 1);
  run(ledger, keep, addDays('2026-11-02', 91));
  assert.equal(ledgerDocs(ledger, [], known, settings).length, 0);
});

test('gone offers of unknown or disabled shops are not searchable', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2')]);
  run(ledger, [offer('a.com', '/r2')], '2026-11-03');
  assert.equal(ledgerDocs(ledger, [], new Map(), settings).length, 0);
  assert.equal(ledgerDocs(ledger, [], new Map([['a.com', { disabled: true }]]), settings).length, 0);
});

test('sold-out docs get the day they were last seen in stock, when known', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2', { available: false })]);
  run(ledger, [offer('a.com', '/r1', { available: false }), offer('a.com', '/r2', { available: false })], '2026-11-03');
  const today = [offer('a.com', '/r1', { available: false }), offer('a.com', '/r2', { available: false })];
  ledgerDocs(ledger, today, known, settings);
  assert.deepEqual(today.map((d) => d.lastInStock), ['2026-11-02', undefined]);
});
