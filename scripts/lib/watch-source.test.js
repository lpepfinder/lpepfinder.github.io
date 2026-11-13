import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourcesOf, fromSource, countSources, itemsFrom } from '../../src/lib/watch/source.js';

const items = {
  a: { t: 'Want', w: 123, d: 1 },
  b: { t: 'Track', p: ['at://x/radio.4000.track/1'] },
  c: { t: 'Both', w: 456, p: ['at://x/radio.4000.track/2'] },
  d: { t: 'From the search' },
};

test('a record comes from Discogs, a radio, both, or the search', () => {
  assert.deepEqual(sourcesOf(items.a), ['discogs']);
  assert.deepEqual(sourcesOf(items.b), ['radio']);
  assert.deepEqual(sourcesOf(items.c), ['discogs', 'radio']);
  assert.deepEqual(sourcesOf(items.d), ['search']);
  assert.deepEqual(sourcesOf({ t: 'x', p: [] }), ['search']);
});

test('records of one source, and counts per source', () => {
  assert.deepEqual(Object.keys(itemsFrom(items, 'radio')), ['b', 'c']);
  assert.equal(itemsFrom(items, 'all'), items);
  assert.ok(fromSource(items.d, undefined));
  assert.deepEqual(countSources(items), { discogs: 2, radio: 2, search: 1 });
});
