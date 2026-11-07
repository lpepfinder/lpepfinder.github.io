import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from './collect.js';

const opts = { today: '2026-11-07', eventDays: 14, maxEvents: 10, topWanted: 5 };
const c = (did, wants, owned = []) => ({ did, wants: new Map(wants), owned });

test('counts, news since the last run, and the most wanted', () => {
  const collectors = [c('did:a', [['k1', 'A – One'], ['k2', 'A – Two']], ['k3']), c('did:b', [['k1', 'A – One']], ['k3']), c('did:new', [['k9', 'Z – Nine']])];
  const before = { 'did:a': ['k1'], 'did:b': ['k1'] };
  const old = [['2026-11-01', 'did:b', 'k1', 'A – One'], ['2026-10-01', 'did:a', 'k1', 'A – One'], ['2026-11-02', 'did:gone', 'k5', 'x']];
  const f = build(collectors, before, old, opts);
  assert.deepEqual(f.wanted, { k1: 2, k2: 1, k9: 1 });
  assert.deepEqual(f.owned, { k3: 2 });
  // new for did:a today; did:new's whole list is not news; old events kept within eventDays, of collectors still there
  assert.deepEqual(f.events, [['2026-11-07', 'did:a', 'k2', 'A – Two'], ['2026-11-01', 'did:b', 'k1', 'A – One']]);
  assert.deepEqual(f.top, ['k1']);
  assert.deepEqual(f.titles, { k1: 'A – One', k2: 'A – Two' });
  assert.deepEqual(f.state, { 'did:a': ['k1', 'k2'], 'did:b': ['k1'], 'did:new': ['k9'] });
});

test('a run twice the same day keeps its news once', () => {
  const collectors = [c('did:a', [['k1', 'One'], ['k2', 'Two']])];
  const first = build(collectors, { 'did:a': ['k1'] }, [], opts);
  const second = build(collectors, first.state, first.events, opts);
  assert.deepEqual(second.events, [['2026-11-07', 'did:a', 'k2', 'Two']]);
});
