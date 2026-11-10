import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/cities.json' with { type: 'json' };
import { cityOf, cityName, citySlug } from '../../src/lib/cities.js';

test('one name per city: local spellings, districts and wards count with the city', () => {
  assert.equal(cityOf('GB', 'Greater London'), 'London');
  assert.equal(cityOf('GB', ' London '), 'London');
  assert.equal(cityOf('JP', '渋谷区'), 'Tokyo');
  assert.equal(cityOf('JP', 'kyoto'), 'Kyoto');
  assert.equal(cityOf('AT', 'Wien'), 'Vienna');
  assert.equal(cityOf('US', 'Brooklyn'), 'New York');
  // the country matters: London, Ontario stays London; a city not listed keeps its spelling
  assert.equal(cityOf('CA', 'London'), 'London');
  assert.equal(cityOf('FR', 'Rennes'), 'Rennes');
  assert.equal(cityOf('FR', ''), null);
  assert.equal(cityOf('FR', undefined), null);
});

test('a city in the page language, and its URL from the English name', () => {
  assert.equal(cityName('de', 'AT', 'Vienna'), 'Wien');
  assert.equal(cityName('en', 'AT', 'Vienna'), 'Vienna');
  assert.equal(cityName('fr', 'FR', 'Rennes'), 'Rennes');
  assert.equal(citySlug('Saint Petersburg'), 'saint-petersburg');
  assert.equal(citySlug('Montréal'), 'montreal');
  assert.equal(citySlug('Newcastle upon Tyne'), 'newcastle-upon-tyne');
  assert.equal(citySlug('大阪市'), '');
});

test('data/cities.json: every city has a URL, and no spelling belongs to two cities', () => {
  for (const [cc, cities] of Object.entries(data.cities)) {
    const seen = new Map();
    for (const [name, city] of Object.entries(cities)) {
      assert.ok(citySlug(name), `${cc} ${name}: no Latin letters for its URL`);
      for (const alias of [name, ...(city.aliases || [])]) {
        const k = alias.toLowerCase();
        assert.ok(!seen.has(k), `${cc} "${alias}" is both ${seen.get(k)} and ${name}`);
        seen.set(k, name);
      }
    }
  }
});
