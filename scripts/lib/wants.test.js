import test from 'node:test';
import assert from 'node:assert/strict';
import { normCatno, catnosIn, firstWordTag } from '../../src/lib/watch/catno.js';
import { fromCsv, fromApi, artistName } from '../../src/lib/watch/discogs.js';
import { wantRecords, catalogKeys, mergeRows } from '../../src/lib/watch/wants.js';
import { hits, sortHits, baskets } from '../../src/lib/watch/hits.js';
import { reach } from '../../src/lib/watch/reach.js';
import { releaseKey } from '../../src/lib/search/release-key.js';

test('catalog numbers: Discogs form and listing form meet', () => {
  assert.equal(normCatno('KDJ-38'), 'kdj38');
  assert.equal(normCatno('WARP LP 21'), 'warplp21');
  assert.equal(normCatno('none'), null);
  assert.equal(normCatno('LP 21'), null);
  assert.ok(catnosIn('Moodymann - Anotha Black Sunday KDJ-38 (LP)').includes('kdj38'));
  assert.ok(catnosIn('Aphex Twin – Selected Ambient Works WARP LP 21').includes('warplp21'));
  assert.deepEqual(catnosIn('Riversun – I See You [2xLP] 180g'), []);
});

test('Discogs CSV export and API wants', () => {
  const csv = 'Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,Notes\n"KDJ-38","Moodymann (2)","Anotha Black Sunday","KDJ","LP",4,2000,123,"a, note"\n';
  assert.deepEqual(fromCsv(csv), [{ id: 123, artist: 'Moodymann', title: 'Anotha Black Sunday', catno: 'KDJ-38', rating: 4 }]);
  assert.equal(fromCsv('a,b\n1,2'), null);
  const api = fromApi({ rating: 0, basic_information: { id: 9, title: 'Approaching The Gaz Giant', labels: [{ catno: 'OYE 01' }], artists: [{ name: 'C/Fe', join: '&' }, { name: 'Other (3)', anv: '' }] } });
  assert.deepEqual(api, { id: 9, artist: 'C/Fe & Other', title: 'Approaching The Gaz Giant', catno: 'OYE 01', rating: 0 });
  assert.equal(artistName('Prince*'), 'Prince');
});

test('a want gets the release key of shop titles, its catalog number and rating', () => {
  const [r] = wantRecords([{ id: 1, artist: 'Miles Davis', title: 'Kind Of Blue', catno: 'CL 1355', rating: 5 }]);
  assert.equal(r.key, releaseKey('MILES DAVIS - KIND OF BLUE (LP, 180g)'));
  assert.deepEqual(r.fields, { w: 1, c: 'cl1355', r: 5 });
});

test('catalog-number matches are kept only when the listing starts with a word of the want', () => {
  const items = { k1: { t: 'Moodymann – Anotha Black Sunday', c: 'kdj38' } };
  const tag = firstWordTag('Moodymann - Anotha Black Sunday KDJ-38 (Mint)');
  const other = firstWordTag('Somebody Else - Thing KDJ-38');
  assert.deepEqual(catalogKeys(items, { kdj38: [`aaaaaaaaaaaa:${tag}`, `bbbbbbbbbbbb:${other}`] }), { k1: ['aaaaaaaaaaaa'] });
  items.k1.n = ['aaaaaaaaaaaa'];
  assert.deepEqual(catalogKeys(items, { kdj38: [`aaaaaaaaaaaa:${tag}`] }), {});
});

test('merged rows: counts added, each shop at its lowest price, cheapest first', () => {
  const merged = mergeRows([[1, 0, 2000, 'EUR', [0, 2000]], [2, 1, 1500, 'EUR', [1, 1500, 0, 1800]], null]);
  assert.deepEqual(merged, [3, 1, 1500, 'EUR', [1, 1500, 0, 1800]]);
  assert.deepEqual(mergeRows([null, [0, 1, 900, 'EUR']]), [0, 1, 900, 'EUR']);
});

test('reach: same country, customs zone, ships, does not ship', () => {
  const zones = [{ id: 'eu', countries: ['DE', 'FR'] }];
  assert.equal(reach({ country: 'FR' }, 'FR', zones), 'local');
  assert.equal(reach({ country: 'DE' }, 'FR', zones), 'zone');
  assert.equal(reach({ country: 'GB', shipsTo: ['*'] }, 'FR', zones), 'ships');
  assert.equal(reach({ country: 'US', shipsTo: ['US'] }, 'FR', zones), 'no');
  assert.equal(reach({ country: 'US' }, 'FR', zones), 'unknown');
});

test('hits: filters, sorts and baskets', () => {
  const shops = new Map([['a', { name: 'A', country: 'FR', currency: 'EUR' }], ['b', { name: 'B', country: 'US', currency: 'EUR', shipsTo: ['US'] }]]);
  const items = { x: { t: 'X – One', a: '2026-11-01', f: '2026-11-05' }, y: { t: 'Y – Two', a: '2026-11-02', r: 5 }, z: { t: 'Z – Three', a: '2026-11-03' } };
  const rows = { x: [2, 0, 1000, 'EUR', [0, 1000, 1, 1200]], y: [1, 0, 3000, 'EUR', [1, 3000]], z: [0, 1, 500, 'EUR'] };
  const args = { items, rows, shopIds: ['a', 'b'], shops, value: (c) => c, reachOf: (s) => reach(s, 'FR', []) };
  const all = hits(args);
  assert.deepEqual(all.map((h) => h.key), ['x', 'y']);
  assert.deepEqual(sortHits(all, 'new').map((h) => h.key), ['x', 'y']);
  assert.deepEqual(sortHits(all, 'price-desc').map((h) => h.key), ['y', 'x']);
  assert.deepEqual(sortHits(all, 'rating').map((h) => h.key), ['y', 'x']);
  assert.deepEqual(sortHits(all, 'rare').map((h) => h.key), ['y', 'x']);
  // y is only at a shop that doesn't ship to France
  assert.deepEqual(hits({ ...args, filters: { ships: true } }).map((h) => h.key), ['x']);
  assert.deepEqual(hits({ ...args, filters: { max: 2000 } }).map((h) => h.key), ['x']);
  const b = baskets(all);
  assert.deepEqual(b.map((s) => [s.id, s.hits.length, s.cents]), [['b', 2, 4200], ['a', 1, 1000]]);
});
