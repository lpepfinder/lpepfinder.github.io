import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './day.js';
import { buildNewArrivals } from './new-arrivals.js';
import { offer, run, settled } from './fixtures.js';

const shops = new Map([
  ['a.com', { id: 'a.com', url: 'https://a.com', state: { country: 'de' } }],
  ['b.com', { id: 'b.com', url: 'https://b.com', state: { country: 'fr' } }],
]);
const settings = { days: 7, pageItems: 3, shopItems: 2, feedItems: 2 };
const docsOf = (offers) => offers.map((o) => ({ ...o }));

test('new arrivals: last 7 days, still in stock, newest first, shops take turns', () => {
  const base = [offer('a.com', '/0'), offer('b.com', '/0')];
  const ledger = settled(base);
  const day3 = [...base, offer('a.com', '/old')];
  run(ledger, day3, '2026-11-03');
  const day4 = [...day3, offer('a.com', '/a1 12"'), offer('a.com', '/a2'), offer('a.com', '/a3'), offer('b.com', '/b1'), offer('b.com', '/sold')];
  run(ledger, day4, '2026-11-04');
  const today = [...day4.filter((o) => o.path !== '/sold'), offer('b.com', '/sold', { available: false })];
  run(ledger, today, addDays('2026-11-03', 7));
  const data = buildNewArrivals({ ledger, docs: docsOf(today), shops, settings });
  // '/old' is 7 days old (out of the window), '/sold' is no longer in stock
  assert.equal(data.total, 4);
  assert.equal(data.shops, 2);
  const titles = (s) => s.items.map((i) => data.items[i].title);
  assert.deepEqual(titles(data.all), ['Artist – /a1 12"', 'Artist – /b1', 'Artist – /a2']);
  assert.deepEqual(data.all.count, 4);
  assert.deepEqual(Object.keys(data.countries).sort(), ['DE', 'FR']);
  assert.deepEqual([data.byShop['a.com'].count, data.byShop['a.com'].items.length], [3, 2]);
  assert.deepEqual(Object.keys(data.formats), ['12']);
  assert.equal(data.items[0].url, 'https://a.com/a1 12"');
  assert.equal(data.items[0].day, '2026-11-04');
});
