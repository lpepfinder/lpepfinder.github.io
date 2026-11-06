import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './day.js';
import { offerFields } from './offer-fields.js';
import { ledgerDocs } from './search-docs.js';
import { docRow } from '../index/search-index.js';
import { settings, offer, run, settled } from './fixtures.js';

const known = new Map([['a.com', { id: 'a.com', state: { currency: 'EUR' } }]]);
const shopRows = [['a.com', 'A', 'https://a.com', 'DE', 'EUR']];
const fieldsOf = (ledger, o) => offerFields(ledger.rows.get(o.offerKey), o, o.currency, ledger.meta.day, settings);

test('a price drop gives wasPrice, and the 90-day low only when lower than today', () => {
  const ledger = settled([offer('a.com', '/r1')]);
  const cheaper = offer('a.com', '/r1', { price: 1500 });
  run(ledger, [cheaper], '2026-11-03');
  assert.deepEqual(fieldsOf(ledger, cheaper), { firstSeen: '2026-11-01', wasPrice: 2000, lowPrice90: null });
  const dearer = offer('a.com', '/r1', { price: 2500 });
  run(ledger, [dearer], '2026-11-04');
  assert.deepEqual(fieldsOf(ledger, dearer), { firstSeen: '2026-11-01', wasPrice: null, lowPrice90: 1500 });
});

test('wasPrice is kept for 14 days after the drop', () => {
  const ledger = settled([offer('a.com', '/r1')]);
  const cheaper = offer('a.com', '/r1', { price: 1500 });
  run(ledger, [cheaper], '2026-11-03');
  run(ledger, [cheaper], addDays('2026-11-03', 13));
  assert.equal(fieldsOf(ledger, cheaper).wasPrice, 2000);
  run(ledger, [cheaper], addDays('2026-11-03', 14));
  assert.equal(fieldsOf(ledger, cheaper).wasPrice, null);
});

test('no price fields when the doc price or currency is not the ledger row\'s', () => {
  const ledger = settled([offer('a.com', '/r1')]);
  run(ledger, [offer('a.com', '/r1', { price: 1500 })], '2026-11-03');
  const row = ledger.rows.get(offer('a.com', '/r1').offerKey);
  assert.deepEqual(offerFields(row, { price: 1400 }, 'EUR', '2026-11-03', settings), { firstSeen: '2026-11-01', wasPrice: null, lowPrice90: null });
  assert.deepEqual(offerFields(row, { price: 1500 }, 'USD', '2026-11-03', settings), { firstSeen: '2026-11-01', wasPrice: null, lowPrice90: null });
  assert.deepEqual(offerFields(undefined, { price: 1500 }, 'EUR', '2026-11-03', settings), { firstSeen: null, wasPrice: null, lowPrice90: null });
});

test('ledgerDocs puts the fields on today\'s docs and gone docs', () => {
  const ledger = settled([offer('a.com', '/r1'), offer('a.com', '/r2')]);
  const today = [offer('a.com', '/r1', { price: 1500 })];
  run(ledger, today, '2026-11-03');
  const gone = ledgerDocs(ledger, today, known, settings);
  assert.deepEqual([today[0].firstSeen, today[0].wasPrice], ['2026-11-01', 2000]);
  assert.deepEqual([gone[0].path, gone[0].firstSeen], ['/r2', '2026-11-01']);
});

test('d/ rows: 0 for absent values, trailing zeros left out', () => {
  const base = { shop: 'a.com', title: 'T', price: 1500, path: '/p', currency: 'EUR' };
  assert.deepEqual(docRow(base, 0, shopRows), [0, 'T', 1500, '/p', 0, 0]);
  assert.deepEqual(docRow({ ...base, firstSeen: '2026-11-01' }, 0, shopRows), [0, 'T', 1500, '/p', 0, 0, 0, 0, '2026-11-01']);
  assert.deepEqual(
    docRow({ ...base, firstSeen: '2026-11-01', wasPrice: 2000, lowPrice90: 1200 }, 0, shopRows),
    [0, 'T', 1500, '/p', 0, 0, 0, 0, '2026-11-01', 2000, 1200],
  );
  assert.deepEqual(
    docRow({ ...base, available: false, lastInStock: '2026-10-30', firstSeen: '2026-10-01' }, 0, shopRows),
    [0, 'T', 1500, '/p', 0, 0, 1, '2026-10-30', '2026-10-01'],
  );
  // lastInStock is only for sold-out records
  assert.deepEqual(docRow({ ...base, lastInStock: '2026-10-30' }, 0, shopRows), [0, 'T', 1500, '/p', 0, 0]);
});
