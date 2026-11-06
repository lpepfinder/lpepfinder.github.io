import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artistList } from './site-data.js';

test('artists.json keeps the first artist pages as [slug, name, recordCount]', () => {
  const pages = [
    { slug: 'drexciya', name: 'Drexciya', records: [{}, {}, {}], shopCount: 2 },
    { slug: 'sade', name: 'Sade', records: [{}, {}], shopCount: 2 },
  ];
  assert.deepEqual(artistList(pages, 1), [['drexciya', 'Drexciya', 3]]);
});
