import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupId, place } from './locate.js';

test('OpenStreetMap elements as Nominatim ids', () => {
  assert.equal(lookupId('node/123'), 'N123');
  assert.equal(lookupId('way/45'), 'W45');
  assert.equal(lookupId('relation/6'), 'R6');
  assert.equal(lookupId('area/6'), null);
  assert.equal(lookupId(undefined), null);
});

test('a place: a real country code, and the city, town or village', () => {
  assert.deepEqual(place({ city: 'New York', suburb: 'Brooklyn', country_code: 'us' }), { country: 'US', city: 'New York' });
  assert.deepEqual(place({ town: 'Hebden Bridge', country_code: 'gb' }), { country: 'GB', city: 'Hebden Bridge' });
  assert.deepEqual(place({ village: 'Lille Skensved', country_code: 'dk' }), { country: 'DK', city: 'Lille Skensved' });
  assert.deepEqual(place({ country_code: 'zz' }), { country: undefined, city: undefined });
  assert.deepEqual(place(), { country: undefined, city: undefined });
});
