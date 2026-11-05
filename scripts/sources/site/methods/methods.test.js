import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { squarespaceRecords } from './squarespace-json.js';
import { bigcartelRecords } from './bigcartel.js';
import { magentoRecords } from './magento-graphql.js';
import { toRecord } from '../record.js';

const fixture = (f) => JSON.parse(fs.readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8'));

test('Squarespace ?format=json collection: variants, sale price, stock', () => {
  const rows = squarespaceRecords(fixture('squarespace.json'), 'https://far-landrecords.co.uk');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    url: 'https://far-landrecords.co.uk/shop/p/olivia-dean-the-art-of-loving',
    p: { title: 'Olivia Dean | The Art Of Loving', price: 32, currency: 'GBP', inStock: true, image: 'https://images.squarespace-cdn.com/od.jpg' },
  });
  assert.equal(rows[1].p.price, 20);
  assert.equal(rows[1].p.inStock, false);
  assert.equal(toRecord(rows[1].p).available, false);
});

test('Big Cartel products.json: status and options', () => {
  const rows = bigcartelRecords(fixture('bigcartel.json'), 'https://discom.bigcartel.com', 'USD');
  assert.deepEqual(rows.map((r) => [r.url, r.p.price, r.p.inStock]), [
    ['https://discom.bigcartel.com/product/sun-ra-lanquidity', 30, true],
    ['https://discom.bigcartel.com/product/alice-coltrane-ptah', 28, false],
  ]);
});

test('Magento GraphQL products: canonical URL, final price, stock status', () => {
  const rows = magentoRecords(fixture('magento.json'), 'https://www.pickuprecords.it');
  assert.deepEqual(rows[0], {
    url: 'https://www.pickuprecords.it/dreamboat-annie-0602547857811.html',
    p: { title: 'Dreamboat Annie', price: 23.9, currency: 'EUR', inStock: true, image: 'https://www.pickuprecords.it/media/a.jpeg' },
  });
  assert.equal(rows[1].url, 'https://www.pickuprecords.it/circe-3770011431915.html');
  assert.equal(rows[1].p.inStock, false);
});
