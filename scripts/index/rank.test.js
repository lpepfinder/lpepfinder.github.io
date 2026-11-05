import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWindow, diversify } from '../../src/lib/search/rank.js';
import { detectFormat } from '../../src/lib/search/format.js';
import { normalize } from '../lib/text.js';

test('pickWindow takes the densest chunks first', () => {
  // chunk 0: 1 id, chunk 5: 3 ids, chunk 9: 2 ids (10 docs per chunk)
  const ids = [3, 50, 51, 52, 90, 91];
  assert.deepEqual(pickWindow(ids, 10, { min: 3, maxChunks: 1 }), [50, 51, 52]);
  assert.deepEqual(pickWindow(ids, 10, { min: 4, maxChunks: 1 }), [50, 51, 52, 90, 91]);
  assert.deepEqual(pickWindow(ids, 10, { min: 1, maxIds: 200, maxChunks: 9 }), ids);
});

test('diversify puts query-prefixed titles first and lets shops take turns', () => {
  const docs = [
    { id: 1, shop: 0, title: 'A tribute to Miles Davis' },
    { id: 2, shop: 0, title: 'Miles Davis – Kind of Blue' },
    { id: 3, shop: 0, title: 'Miles Davis – Bitches Brew' },
    { id: 4, shop: 1, title: 'Miles Davis – Tutu' },
  ];
  assert.deepEqual(diversify(docs, normalize('miles davis'), normalize), [2, 4, 3, 1]);
});

test('diversify puts sold-out records after every record in stock', () => {
  const docs = [
    { id: 1, shop: 0, title: 'Kraftwerk – Autobahn', soldOut: true },
    { id: 2, shop: 1, title: 'Neu! – Neu!' },
    { id: 3, shop: 1, title: 'Kraftwerk – Computerwelt' },
  ];
  assert.deepEqual(diversify(docs, normalize('kraftwerk'), normalize), [3, 2, 1]);
});

test('detectFormat reads common title conventions', () => {
  assert.equal(detectFormat('Aphex Twin – Selected Ambient Works Volume II [3xCD]').format, 'cd');
  assert.equal(detectFormat('Phil Collins – Testify [2xLP]').format, '2lp');
  assert.equal(detectFormat('Riversun – I See You [LP]').format, 'lp');
  assert.equal(detectFormat('Burial – Untrue 12"').format, '12');
  assert.equal(detectFormat('Prince – Kiss (7 inch)').format, '7');
  assert.equal(detectFormat('Sun Ra – Lanquidity (cassette)').format, 'mc');
  assert.equal(detectFormat('Kraftwerk – Autobahn').format, null);
  assert.equal(detectFormat('Can – Tago Mago (LP, used)').used, true);
  assert.equal(detectFormat('Can – Tago Mago (LP)').used, false);
});
