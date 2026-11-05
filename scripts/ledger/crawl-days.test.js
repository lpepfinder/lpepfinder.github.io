import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyDay, emptyLedger } from './diff.js';
import { crawlDays } from './crawl-days.js';
import { settings, urlOf, offer } from './fixtures.js';

const run = (ledger, offers, day, crawled) => applyDay(ledger, offers, day, { settings, urlOf, crawlDays: new Map([['a.com', crawled]]) });

test('the new-shop guard counts days of crawl data, not ledger runs', () => {
  const ledger = emptyLedger();
  run(ledger, [offer('a.com', '/1')], '2026-11-01', '2026-11-01');
  // a push deploy the next morning, before the daily crawl: same data, no new crawl
  run(ledger, [offer('a.com', '/1')], '2026-11-02', '2026-11-01');
  assert.equal(ledger.meta.shops['a.com'].crawls, 1);
  assert.deepEqual(run(ledger, [offer('a.com', '/1'), offer('a.com', '/2')], '2026-11-03', '2026-11-03'), []);
  // a failed crawl carrying over old records is no new crawl either
  assert.deepEqual(run(ledger, [offer('a.com', '/1'), offer('a.com', '/2'), offer('a.com', '/3')], '2026-11-04', null), []);
  assert.equal(ledger.meta.shops['a.com'].crawls, 2);
  const events = run(ledger, [offer('a.com', '/1'), offer('a.com', '/2'), offer('a.com', '/3'), offer('a.com', '/4')], '2026-11-05', '2026-11-05');
  assert.deepEqual(events.map((e) => e[6]), ['https://a.com/4']);
  assert.deepEqual(ledger.meta.shops['a.com'], { crawls: 3, lastCrawl: '2026-11-05' });
});

test('crawl days come from the run reports, failed shops get none, other files their date', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'days-'));
  try {
    const file = (name) => { const f = path.join(dir, name); fs.writeFileSync(f, ''); return f; };
    const crawl = file('products.ndjson.gz');
    const site = file('products-site-2.ndjson.gz');
    const discogs = file('products-discogs.ndjson.gz');
    fs.utimesSync(discogs, new Date('2026-10-30T12:00:00Z'), new Date('2026-10-30T12:00:00Z'));
    fs.writeFileSync(path.join(dir, 'crawl-report.json'), JSON.stringify({ finishedAt: '2026-11-05T04:10:00Z', shops: { 'a.com': { count: 3 }, 'b.com': { count: 0, error: 'HTTP 500', carried: 9 } } }));
    fs.writeFileSync(path.join(dir, 'site-2-report.json'), JSON.stringify({ finishedAt: '2026-11-04T23:59:00Z', shops: {} }));
    const days = crawlDays(new Map([
      ['a.com', new Set([crawl])], ['b.com', new Set([crawl])], ['c.com', new Set([site])], ['d.com', new Set([discogs, site])],
    ]));
    assert.deepEqual(Object.fromEntries(days), { 'a.com': '2026-11-05', 'b.com': null, 'c.com': '2026-11-04', 'd.com': '2026-11-04' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
