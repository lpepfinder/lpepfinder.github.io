import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPlaces, score } from '../../src/lib/search/places.js';

const names = { DE: ['Allemagne', 'Germany'], FR: ['France', 'France'], PT: ['Portugal', 'Portugal'] };
const countryNames = (code) => names[code];
const places = {
  countries: [['DE', 228], ['FR', 107], ['PT', 12]],
  shops: [
    ['flur.pt', 'Flur Discos', 'PT', 9000],
    ['roughtrade.com', 'Rough Trade', 'GB', 50000],
    ['paris-jazz-corner.com', 'Paris Jazz Corner', 'FR', 4000],
    ['records-rx.de', 'Records RX', 'DE', 10],
  ],
};
const find = (q) => findPlaces(q, places, countryNames).map((p) => p.code || p.id);

test('a name matches exactly, as words of the query, or by its start', () => {
  assert.equal(score('Germany', 'germany'), 0);
  assert.equal(score('Germany', 'records germany'), 1);
  assert.equal(score('Germany', 'germ'), 2);
  assert.equal(score('Germany', 'ge'), null);
  assert.equal(score('Germany', 'german jazz'), null);
});

test('countries in the reader language or English, shops by name or address', () => {
  assert.deepEqual(find('allemagne'), ['DE']);
  assert.deepEqual(find('Germany'), ['DE']);
  assert.deepEqual(find('vinyl germany'), ['DE']);
  assert.deepEqual(find('rough trade'), ['roughtrade.com']);
  assert.deepEqual(find('flur'), ['flur.pt']);
  assert.deepEqual(find('rough'), ['roughtrade.com']);
});

test('exact first, then countries, then shops with the most records; short queries find nothing', () => {
  assert.deepEqual(find('france'), ['FR']);
  assert.deepEqual(find('fra'), ['FR']);
  assert.deepEqual(find('paris jazz corner'), ['paris-jazz-corner.com']);
  assert.deepEqual(find('re'), []);
  assert.deepEqual(find('rec'), []);
  assert.deepEqual(find('jazz'), []);
  assert.equal(findPlaces('germany', null, countryNames).length, 0);
});

const artists = [['pink-floyd', 'Pink Floyd', 60], ['queen', 'Queen', 60], ['pink', 'Pink', 20], ['queens-of-the-stone-age', 'Queens Of The Stone Age', 40], ['love', 'Love', 12]];
const findA = (q) => findPlaces(q, places, countryNames, artists).map((p) => p.code || p.id || p.slug);

test('artists: by name or as words of the query; a one-word artist only as the whole query', () => {
  assert.deepEqual(findA('pink floyd'), ['pink-floyd']);
  assert.deepEqual(findA('pink floyd animals'), ['pink-floyd']);
  assert.deepEqual(findA('pink'), ['pink']);
  assert.deepEqual(findA('love will tear us apart'), []);
  assert.deepEqual(findA('france love'), ['FR']);
});

test('names that only start with the query show when nothing matches better', () => {
  assert.deepEqual(findA('queen'), ['queen']);
  assert.deepEqual(findA('quee'), ['queen', 'queens-of-the-stone-age']);
});
