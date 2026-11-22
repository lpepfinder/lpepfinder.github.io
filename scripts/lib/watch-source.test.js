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

test('forgetting a list removes its records, keeps the other list\'s and the search\'s', async () => {
  const { forget } = await import('../../src/lib/watch/source.js');
  const discogs = forget(items, 'discogs');
  assert.deepEqual(Object.keys(discogs.items), ['b', 'c', 'd']);
  assert.equal(discogs.removed, 1);
  const radio = forget(items, 'radio');
  assert.deepEqual(Object.keys(radio.items), ['a', 'c', 'd']);
  assert.equal(radio.removed, 1);
  // a record from both keeps its Discogs id when the radio goes
  assert.deepEqual(radio.items.c, { t: 'Both', w: 456 });
  // the input is left as it was
  assert.deepEqual(items.c.p, ['at://x/radio.4000.track/2']);
});
