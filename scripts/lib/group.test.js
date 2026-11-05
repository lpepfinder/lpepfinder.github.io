import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToGroups, groupView, orderGroups, totals } from '../../src/lib/search/group.js';

const rec = (title, shop, country, price, available = true) => ({ title, price, currency: 'EUR', available, url: `https://${shop}/${title}`, shop: { id: shop, name: shop, country } });
const sort = { country: 'DE', near: false, value: (o) => o.price };

test('copies of one release become one group; pages append and grow groups', () => {
  const groups = new Map();
  const first = addToGroups(groups, [rec('Miles Davis – Kind Of Blue (LP)', 'a', 'FR', 2500), rec('Aphex Twin - Syro', 'b', 'DE', 3000)]);
  assert.equal(first.added.length, 2);
  const next = addToGroups(groups, [rec('MILES DAVIS - KIND OF BLUE', 'c', 'DE', 2200), rec('LP', 'd', 'DE', 900)]);
  assert.equal(next.added.length, 1, 'a title without a key stays alone');
  assert.equal(next.grown.length, 1);
  assert.equal(groups.size, 3);
  assert.deepEqual([...groups.values()][0].offers.map((o) => o.shop.id), ['a', 'c']);
  assert.equal([...groups.values()][0].offers[0].format, 'lp');
});

test('in stock first, then cheapest; "from" is the cheapest copy in stock', () => {
  const groups = new Map();
  addToGroups(groups, [rec('Can - Tago Mago', 'a', 'FR', 1500, false), rec('Can - Tago Mago', 'b', 'FR', 3000), rec('Can - Tago Mago', 'c', 'DE', 2800)]);
  const v = groupView([...groups.values()][0], { inStock: false, formats: new Set() }, sort);
  assert.deepEqual(v.offers.map((o) => o.shop.id), ['c', 'b', 'a']);
  assert.equal(v.cheapest.shop.id, 'c');
  assert.deepEqual([v.inStock, v.soldOut, v.shops, v.local], [2, 1, 3, true]);
  const near = groupView([...groups.values()][0], { inStock: true, formats: new Set() }, { ...sort, country: 'FR', near: true });
  assert.deepEqual(near.offers.map((o) => o.shop.id), ['b', 'c']);
});

test('filters drop copies and empty groups; near puts local groups first', () => {
  const groups = new Map();
  addToGroups(groups, [rec('Neu! - Neu! 75 (LP)', 'a', 'FR', 2000), rec('Wire - Pink Flag 7"', 'b', 'DE', 900, false)]);
  const [neu, wire] = groups.values();
  assert.equal(groupView(wire, { inStock: true, formats: new Set() }, sort), null);
  assert.equal(groupView(neu, { inStock: false, formats: new Set(['7']) }, sort), null);
  const views = [groupView(neu, { formats: new Set() }, sort), { ...groupView(wire, { formats: new Set() }, sort), local: true }];
  assert.deepEqual(orderGroups(views, true).map((v) => v.offers[0].shop.id), ['b', 'a']);
  assert.deepEqual(totals(views), { records: 2, copies: 2, shops: 2 });
});
