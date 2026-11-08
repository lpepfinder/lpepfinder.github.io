import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDoc, priceEur, suspectShops } from './checks.js';

const rates = { EUR: 1, USD: 1.1, JPY: 180, GBP: 0.85 };
const settings = { minEur: 0.5, maxEur: 3000, shopMinRecords: 3, shopMinMedianEur: 2, shopMaxMedianEur: 500 };
const testTitle = /\btest ?(product|item|listing)\b|^\(?test\)?$|\btestproduct\b|\bdummy (product|item)\b/i;
const isMusic = (text) => !/t-?shirt|guitar strings?/i.test(text);
const ctx = (extra = {}) => ({ rates, settings, currency: 'EUR', suspect: new Map(), testTitle, isMusic, ...extra });
const doc = (title, price = 2000, extra = {}) => ({ shop: 'a.com', title, price, ...extra });

test('priceEur converts cents to euros, null when unknown', () => {
  assert.equal(priceEur(1100, 'USD', rates), 10);
  assert.equal(priceEur(1100, 'XXX', rates), null);
  assert.equal(priceEur(null, 'EUR', rates), null);
});

test('test listings, missing titles and merch are flagged; test pressings are records', () => {
  assert.equal(checkDoc(doc('(testproduct)'), ctx()), 'test-listing');
  assert.equal(checkDoc(doc('Test product B - don\'t order'), ctx()), 'test-listing');
  assert.equal(checkDoc(doc('TEST'), ctx()), 'test-listing');
  assert.equal(checkDoc(doc('dummy product: do not buy this'), ctx()), 'test-listing');
  assert.equal(checkDoc(doc('Artist – Album (Test Pressing) LP'), ctx()), null);
  assert.equal(checkDoc(doc('Testament – The Legacy LP'), ctx()), null);
  assert.equal(checkDoc(doc('  '), ctx()), 'no-title');
  assert.equal(checkDoc(doc('???? - ?? ??? ?? ?? ?? ??? ?? ???'), ctx()), 'no-title');
  assert.notEqual(checkDoc(doc('坂本龍一 - 戦場のメリークリスマス'), ctx()), 'no-title');
  assert.equal(checkDoc(doc('Ernie Ball Guitar Strings 10-46'), ctx()), 'not-record');
});

test('implausible prices for a record, in euros', () => {
  assert.equal(checkDoc(doc('Artist – LP', 19), ctx({ currency: 'GBP' })), 'price-low'); // £0.19
  assert.equal(checkDoc(doc('Artist – LP', 1), ctx()), 'price-low');
  assert.equal(checkDoc(doc('Artist – 7"', 99), ctx({ currency: 'USD' })), null); // $0.99 singles exist
  assert.equal(checkDoc(doc('Artist – LP', 3469900), ctx({ currency: 'USD' })), 'price-high');
  assert.equal(checkDoc(doc('Artist – LP', 250000), ctx()), null);
  assert.equal(checkDoc(doc('Artist – LP', 1), ctx({ currency: 'XXX' })), null); // no rate: no opinion
  assert.equal(checkDoc(doc('Artist – LP', null), ctx()), null);
});

test('shops whose median price is far off look like a wrong currency', () => {
  const docs = [
    // dollars labelled yen: ¥19 for an LP
    ...[1900, 1200, 6000, 2500].map((price) => ({ shop: 'jp.com', price, currency: 'JPY' })),
    ...[1900, 1200, 6000].map((price) => ({ shop: 'ok.com', price, currency: 'EUR' })),
    ...[90000, 120000, 60000].map((price) => ({ shop: 'gear.com', price, currency: 'EUR' })),
    ...[10, 20].map((price) => ({ shop: 'small.com', price, currency: 'EUR' })), // too few to judge
    { shop: 'ok.com', price: null, currency: 'EUR' },
  ];
  const suspect = suspectShops(docs, { rates, settings, currencyOf: (d) => d.currency });
  assert.deepEqual([...suspect.keys()].sort(), ['gear.com', 'jp.com']);
  assert.deepEqual(suspect.get('jp.com'), { shop: 'jp.com', currency: 'JPY', records: 4, medianEur: 0.14, reason: 'shop-price-low' });
  assert.equal(suspect.get('gear.com').reason, 'shop-price-high');
  assert.equal(checkDoc(doc('Artist – LP', 2500, { shop: 'jp.com' }), ctx({ currency: 'JPY', suspect })), 'shop-price-low');
});
