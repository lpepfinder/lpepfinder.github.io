import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractProduct } from './page.js';
import { stripShopName, shopNames } from './title.js';
import { toNumber } from './structured.js';
import { toRecord } from '../record.js';

const fixture = (f) => fs.readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');

test('Oye-like __NUXT_DATA__: own product, sold-out state and listed items', () => {
  const { product, items } = extractProduct(fixture('oye-release.html'), 'https://oye-records.com/releases/cfe-approaching-the-gaz-giant', { names: ['OYE Records'] });
  assert.equal(product.via, 'nuxt');
  assert.equal(product.title, 'C/Fe - Approaching The Gaz Giant');
  assert.equal(product.price, 5);
  assert.equal(product.currency, 'EUR');
  assert.equal(product.inStock, false);
  assert.equal(product.image, 'https://oye-records.com/media/cfe.jpg');
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].slug, items[0].title, items[0].price, items[0].inStock], ['cv313-skyspace-ep', 'cv313 - Skyspace EP', 21.95, true]);
});

test('sold-out records are kept with available: false', () => {
  const { product } = extractProduct(fixture('oye-release.html'), 'https://oye-records.com/releases/cfe-approaching-the-gaz-giant');
  const r = toRecord(product);
  assert.equal(r.available, false);
  assert.equal(r.price, 500);
  assert.equal(r.type, '12"');
});

test('JSON-LD Product inside @graph, with a thousands separator', () => {
  const { product } = extractProduct(fixture('jsonld.html'), 'https://www.undergroundgallery.jp/products/detail/1234');
  assert.deepEqual([product.via, product.title, product.price, product.currency, product.inStock], ['jsonld', 'Basic Channel - Quadrant Dub', 2480, 'JPY', true]);
  assert.equal(product.image, 'https://www.undergroundgallery.jp/img/bc.jpg');
});

test('microdata Product with a comma price and OutOfStock', () => {
  const { product } = extractProduct(fixture('microdata.html'), 'https://1ness.fr/produit/jimmy-riley');
  assert.deepEqual([product.via, product.title, product.price, product.currency, product.inStock], ['microdata', 'Jimmy Riley - Majority Rule', 26, 'EUR', false]);
});

test('plain HTML: artist-title heading, one price, add to cart', () => {
  const { product } = extractProduct(fixture('heuristic.html'), 'https://slowprogress.co.uk/shop/moodymann-black-mahogani', { names: ['Slow Progress Records'] });
  assert.equal(product.via, 'heuristic');
  assert.equal(product.title, 'Moodymann - Black Mahogani 2LP');
  assert.deepEqual([product.price, product.currency, product.inStock], [28.99, 'GBP', true]);
});

test('__NEXT_DATA__ listing: generic price/title objects, merch dropped by the record filter', () => {
  const { product, items } = extractProduct(fixture('next-listing.html'), 'https://shop.example/new');
  assert.equal(product, null);
  assert.equal(items.length, 2);
  const sade = items.find((i) => i.slug === 'sade-diamond-life');
  assert.deepEqual([sade.url, sade.price, sade.currency, sade.inStock], ['https://shop.example/p/sade-diamond-life', 24.5, 'EUR', true]);
  assert.equal(items.map(toRecord).filter(Boolean).length, 1);
});

test('shop name suffixes and prefixes are stripped from titles', () => {
  const names = shopNames({ id: 'oye-records.com', name: 'OYE Records - Webshop' });
  assert.equal(stripShopName('C/Fe - Approaching The Gaz Giant | OYE Records', names), 'C/Fe - Approaching The Gaz Giant');
  assert.equal(stripShopName('Moodymann - Black Mahogani – OYE Records Webshop', names), 'Moodymann - Black Mahogani');
  assert.equal(stripShopName('OYE Records | Moodymann - Forevernevermore', names), 'Moodymann - Forevernevermore');
  // an artist-title pair whose second part is not the shop stays whole
  assert.equal(stripShopName('Theo Parrish - Records', names), 'Theo Parrish - Records');
});

test('prices in local notations', () => {
  assert.equal(toNumber('1.234,56'), 1234.56);
  assert.equal(toNumber('1,234.56'), 1234.56);
  assert.equal(toNumber('12,9'), 12.9);
  assert.equal(toNumber(''), null);
});
