import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogUrl } from './shop.js';

test('a shop whose store lives on another site is checked and read there', () => {
  assert.equal(catalogUrl({ url: 'https://generationrecords.com', store: 'https://generationrecords.bigcartel.com' }), 'https://generationrecords.bigcartel.com');
  assert.equal(catalogUrl({ url: 'https://hardwax.com' }), 'https://hardwax.com');
});
