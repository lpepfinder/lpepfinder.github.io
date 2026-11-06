import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDig } from './dig.js';
import { buildNewArrivals } from './new-arrivals.js';
import { offer, run, settled } from './fixtures.js';

const shops = new Map([['a.com', { id: 'a.com', name: 'A', url: 'https://a.com', state: { country: 'de' } }], ['b.com', { id: 'b.com', name: 'B', url: 'https://b.com', state: { country: 'fr' } }]]);
const dig = { days: 7, perCrate: 10, dropMin: 0.1, dropMax: 0.7 };

test('dig: new, back in stock and price drops, still in stock today', () => {
  const base = [offer('a.com', '/back'), offer('b.com', '/cheap', { price: 3000 }), offer('b.com', '/tiny', { price: 3000 }), offer('b.com', '/error', { price: 229900 })];
  const ledger = settled(base);
  run(ledger, [offer('a.com', '/back', { available: false }), ...base.slice(1)], '2026-11-03');
  const today = [offer('a.com', '/back'), offer('b.com', '/cheap', { price: 2000 }), offer('b.com', '/tiny', { price: 2900 }), offer('b.com', '/error', { price: 1699 }), offer('a.com', '/new 12"')];
  run(ledger, today, '2026-11-04');
  const docs = today.map((o) => ({ ...o, wasPrice: { '/cheap': 3000, '/tiny': 3000, '/error': 229900 }[o.path] ?? null }));
  const arrivals = buildNewArrivals({ ledger, docs, shops, settings: { days: 7, pageItems: 10, shopItems: 10, feedItems: 10 } });
  const data = buildDig({ ledger, docs, shops, arrivals, settings: dig });
  const summary = data.items.map(([crate, , title, cents, , , , shop, format, was]) => [crate, title, cents, data.shops[shop][0], format, was]);
  assert.deepEqual(summary, [
    ['new', 'Artist – /new 12"', 2000, 'a.com', '12', 0],
    ['restock', 'Artist – /back', 2000, 'a.com', '', 0],
    // 3% off is not a drop, 99% off is a pricing error
    ['drop', 'Artist – /cheap', 2000, 'b.com', '', 3000],
  ]);
  assert.deepEqual(data.shops[0].slice(0, 3), ['a.com', 'A', 'DE']);
});
