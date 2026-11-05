import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseKey, releaseWords } from '../../src/lib/search/release-key.js';

test('same record in different shop spellings gets one key', () => {
  const k = releaseKey('Miles Davis – Kind Of Blue (LP, 180g)');
  assert.match(k, /^[0-9a-f]{12}$/);
  assert.equal(releaseKey('MILES DAVIS - KIND OF BLUE'), k);
  assert.equal(releaseKey('Miles Davis - Kind of Blue [Reissue] 180 Gram Vinyl LP'), k);
  assert.equal(releaseKey('Miles Davis: Kind Of Blue (Blue Vinyl)'), k);
  assert.deepEqual(releaseWords('Miles Davis - Kind of Blue'), ['miles', 'davis', 'kind', 'of', 'blue']);
  assert.deepEqual(releaseWords('New Order - Blue Monday 12"'), ['new', 'order', 'blue', 'monday']);
});

test('different records differ, and too-short titles get no key', () => {
  assert.notEqual(releaseKey('Aphex Twin - Drukqs'), releaseKey('Aphex Twin - Syro'));
  assert.equal(releaseKey('LP (used)'), null);
  assert.deepEqual(releaseWords('Björk – Homogenic (2LP)'), ['bjork', 'homogenic']);
});
