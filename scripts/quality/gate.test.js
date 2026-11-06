import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualityGate } from './gate.js';

const rates = { EUR: 1, JPY: 180 };
const settings = { description: 'x', minEur: 0.5, maxEur: 3000, shopMinRecords: 2, shopMinMedianEur: 2, shopMaxMedianEur: 500, testTitle: '\\btestproduct\\b', samples: 1 };
const ctx = { rates, settings, currencyOf: (d) => d.currency, isMusic: () => true };

test('the gate leaves out test listings, removes wrong prices and reports them', () => {
  const docs = [
    { shop: 'a.com', title: 'A – LP', price: 2000, currency: 'EUR' },
    { shop: 'a.com', title: 'A – 2LP', price: 3000, currency: 'EUR' },
    { shop: 'a.com', title: '(testproduct)', price: 100, currency: 'EUR' },
    { shop: 'a.com', title: 'B – LP', price: 1, currency: 'EUR' },
    { shop: 'jp.com', title: 'C – LP', price: 1900, currency: 'JPY' },
    { shop: 'jp.com', title: 'D – LP', price: 2900, currency: 'JPY' },
  ];
  const gate = qualityGate(docs, ctx);
  const kept = gate.filter(docs);
  assert.deepEqual(kept.map((d) => [d.title, d.price, d.priceFlag ?? null]), [
    ['A – LP', 2000, null], ['A – 2LP', 3000, null], ['B – LP', null, 'price-low'], ['C – LP', null, 'shop-price-low'], ['D – LP', null, 'shop-price-low'],
  ]);
  // more docs (the ledger's gone offers) with the same suspect shops
  assert.equal(gate.filter([{ shop: 'jp.com', title: 'E – LP', price: 50000, currency: 'JPY' }])[0].price, null);
  const report = gate.report();
  assert.equal(report.checked, 7);
  assert.equal(report.excluded, 1);
  assert.equal(report.pricesRemoved, 4);
  assert.equal(report.counts['shop-price-low'], 3);
  assert.equal(report.samples['shop-price-low'].length, 1);
  assert.deepEqual(report.samples['test-listing'][0], { shop: 'a.com', title: '(testproduct)', path: null, price: 100, currency: 'EUR', eur: 1 });
  assert.equal(report.suspectShops[0].shop, 'jp.com');
  assert.equal(report.settings.description, undefined);
  assert.match(gate.summary(), /^quality: 7 docs, 1 left out, 4 prices removed \(test-listing 1, shop-price-low 3, price-low 1\); suspect shops: jp\.com \(JPY, median €/);
});
