import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, issueAction } from './rules.js';
import { previousDay, record } from './history.js';
import { crawlNumbers } from './numbers.js';
import { report } from './report.js';

const settings = { recordsDropMax: 0.15, shopsDropMax: 0.05, siteMaxMB: 850, crawlErrorMax: 0.2, crawlMaxAgeHours: 36, keepDays: 3 };
const at = new Date('2026-11-06T12:00:00Z');
const base = { records: 1000, inStock: 900, shops: 100, siteMB: 500, crawl: { shops: 50, errors: 2, finishedAt: '2026-11-06T04:00:00Z' }, e2e: 'success' };
const prev = { day: '2026-11-05', ...base };
const ids = (r) => r.problems.map((p) => p.id);

test('healthy: numbers as yesterday', () => {
  assert.deepEqual(assess(base, prev, settings, at), { degraded: false, problems: [] });
});

test('first build: nothing to compare with, not degraded', () => {
  assert.equal(assess(base, null, settings, at).degraded, false);
});

test('records: a drop over the limit, not one at it', () => {
  assert.deepEqual(ids(assess({ ...base, records: 849 }, prev, settings, at)), ['records']);
  assert.deepEqual(ids(assess({ ...base, records: 850 }, prev, settings, at)), []);
  assert.deepEqual(ids(assess({ ...base, records: 5000 }, prev, settings, at)), [], 'growth is fine');
});

test('searchable shops: more than 5% fewer', () => {
  assert.deepEqual(ids(assess({ ...base, shops: 94 }, prev, settings, at)), ['shops']);
  assert.deepEqual(ids(assess({ ...base, shops: 95 }, prev, settings, at)), []);
});

test('no index at all is degraded, without drop messages', () => {
  assert.deepEqual(ids(assess({ ...base, records: null, shops: null }, prev, settings, at)), ['index']);
});

test('site size over the limit', () => {
  assert.deepEqual(ids(assess({ ...base, siteMB: 851 }, prev, settings, at)), ['size']);
  assert.deepEqual(ids(assess({ ...base, siteMB: null }, prev, settings, at)), []);
});

test('crawl: share of failed shops, and a stale crawl', () => {
  assert.deepEqual(ids(assess({ ...base, crawl: { ...base.crawl, errors: 11 } }, prev, settings, at)), ['crawl']);
  assert.deepEqual(ids(assess({ ...base, crawl: { ...base.crawl, errors: 10 } }, prev, settings, at)), []);
  assert.deepEqual(ids(assess({ ...base, crawl: { ...base.crawl, finishedAt: '2026-11-04T12:00:00Z' } }, prev, settings, at)), ['crawl-age']);
  assert.deepEqual(ids(assess({ ...base, crawl: null }, prev, settings, at)), []);
});

test('end-to-end tests: failed or not run', () => {
  assert.deepEqual(ids(assess({ ...base, e2e: 'failure' }, prev, settings, at)), ['e2e']);
  assert.deepEqual(ids(assess({ ...base, e2e: 'skipped' }, prev, settings, at)), ['e2e']);
  assert.deepEqual(ids(assess({ ...base, e2e: null }, prev, settings, at)), [], 'unknown (a local run)');
});

test('several problems at once', () => {
  const r = assess({ ...base, records: 100, shops: 10, e2e: 'failure' }, prev, settings, at);
  assert.equal(r.degraded, true);
  assert.deepEqual(ids(r), ['records', 'shops', 'e2e']);
});

test('issue: one issue, never a duplicate', () => {
  assert.deepEqual(issueAction(true, []), { action: 'create', number: null });
  assert.deepEqual(issueAction(true, [12]), { action: 'update', number: 12 });
  assert.deepEqual(issueAction(true, [12, 15]), { action: 'update', number: 12 });
  assert.deepEqual(issueAction(false, [12]), { action: 'close', number: 12 });
  assert.deepEqual(issueAction(false, []), { action: 'none', number: null });
});

test('history: compared with the latest earlier day, same-day builds replace, old days dropped', () => {
  let h = { days: {} };
  h = record(h, '2026-11-03', { records: 3 }, 3);
  h = record(h, '2026-11-04', { records: 4 }, 3);
  h = record(h, '2026-11-05', { records: 5 }, 3);
  assert.deepEqual(previousDay(h, '2026-11-06'), { day: '2026-11-05', records: 5 });
  h = record(h, '2026-11-06', { records: 6 }, 3);
  h = record(h, '2026-11-06', { records: 7 }, 3);
  assert.deepEqual(Object.keys(h.days), ['2026-11-04', '2026-11-05', '2026-11-06']);
  assert.equal(h.days['2026-11-06'].records, 7);
  assert.deepEqual(previousDay(h, '2026-11-06'), { day: '2026-11-05', records: 5 }, 'a second build today still compares with yesterday');
  assert.equal(previousDay({ days: {} }, '2026-11-06'), null);
  assert.equal(previousDay(null, '2026-11-06'), null);
});

test('crawl numbers from the crawl report', () => {
  const r = { finishedAt: 'x', shops: { a: { count: 3 }, b: { count: 0, error: 'timeout' }, c: { count: 0, partial: true } } };
  assert.deepEqual(crawlNumbers(r), { shops: 3, errors: 1, finishedAt: 'x' });
  assert.equal(crawlNumbers(null), null);
});

test('report: problems first, then the numbers of both days', () => {
  const today = { ...base, records: 100 };
  const text = report({ day: '2026-11-06', today, previous: prev, result: assess(today, prev, settings, at), runUrl: 'https://run' });
  assert.match(text, /\*\*degraded\*\*/);
  assert.match(text, /- Records down 90%/);
  assert.match(text, /\| Records \| 100 \| 1,000 \|/);
  assert.match(text, /Run: https:\/\/run/);
  assert.match(report({ day: 'd', today: base, previous: null, result: { degraded: false, problems: [] } }), /healthy/);
});
