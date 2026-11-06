import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkRegions } from './regions.js';

const isCountry = (c) => c !== 'XX';

test('data/regions.json is valid and the EU zone has all 27 members', () => {
  const regions = JSON.parse(fs.readFileSync(new URL('../../data/regions.json', import.meta.url), 'utf8'));
  assert.deepEqual(checkRegions(regions, isCountry), []);
  assert.equal(regions.zones.find((z) => z.id === 'eu').countries.length, 27);
});

test('a country in two zones, a bad code and a duplicate id are errors', () => {
  const errors = checkRegions({
    zones: [
      { id: 'aa', label: 'zone.aa', countries: ['DE', 'XX'] },
      { id: 'bb', label: 'zone.bb', countries: ['DE'] },
      { id: 'aa', label: 'zone.aa', countries: ['FR'] },
    ],
  }, isCountry);
  assert.equal(errors.length, 3);
});
