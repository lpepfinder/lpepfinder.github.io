import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionCurrency, localeRegion, convert } from '../../src/lib/currency.js';

test('the viewer currency comes from the region of the browser language', () => {
  assert.equal(regionCurrency(localeRegion('de-DE')), 'EUR');
  assert.equal(regionCurrency(localeRegion('fr')), 'EUR');
  assert.equal(regionCurrency(localeRegion('en-GB')), 'GBP');
  assert.equal(regionCurrency(localeRegion('en')), 'USD');
  assert.equal(regionCurrency(localeRegion('ja')), 'JPY');
  assert.equal(regionCurrency('AQ'), null);
  assert.equal(localeRegion('not a tag!'), null);
});

test('prices convert through the euro, and give null without a rate', () => {
  const rates = { EUR: 1, GBP: 0.8, JPY: 160 };
  assert.equal(convert(2000, 'GBP', 'EUR', rates), 2500);
  assert.equal(convert(2000, 'GBP', 'JPY', rates), 400000);
  assert.equal(convert(2000, 'EUR', 'EUR', {}), 2000);
  assert.equal(convert(2000, 'XYZ', 'EUR', rates), null);
  assert.equal(convert(null, 'EUR', 'GBP', rates), null);
});
