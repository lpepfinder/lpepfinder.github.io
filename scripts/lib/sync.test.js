import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.addEventListener ??= () => {};
globalThis.dispatchEvent ??= () => true;
const { plan, wantRecord } = await import('../../src/lib/atproto/sync.js');

test('sync plan: creates, updates and deletes; Discogs-managed wants stay out', () => {
  const items = {
    aaaaaaaaaaaa: { t: 'A – One', a: '2026-11-07' },
    bbbbbbbbbbbb: { t: 'B – Two', a: '2026-11-07', m: 2000 },
    cccccccccccc: { t: 'C – Three', a: '2026-11-07', d: 1, w: 5 },
  };
  const synced = { bbbbbbbbbbbb: JSON.stringify({ ...wantRecord({ t: 'B – Two', a: '2026-11-07' }), createdAt: undefined }), dddddddddddd: 'x' };
  const { writes, next } = plan(items, synced);
  assert.deepEqual(writes.map((w) => [w.$type.split('#')[1], w.rkey]), [['create', 'aaaaaaaaaaaa'], ['update', 'bbbbbbbbbbbb'], ['delete', 'dddddddddddd']]);
  assert.deepEqual(Object.keys(next), ['aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
  assert.equal(wantRecord(items.cccccccccccc), null);
  assert.equal(writes[0].value.$type, 'com.lpepfinder.want');
});
