import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const SCRIPT = path.resolve(import.meta.dirname, 'merge.js');
const run = (cwd, env) => execFileSync(process.execPath, [SCRIPT, 'shards'], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'pipe' });

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  fs.mkdirSync(path.join(cwd, 'shards'));
  fs.mkdirSync(path.join(cwd, 'generated'));
  fs.writeFileSync(path.join(cwd, 'generated/products.ndjson.gz'), zlib.gzipSync('{"shop":"old"}\n'));
  for (const k of [0, 1]) {
    fs.writeFileSync(path.join(cwd, `shards/products-crawl-${k}.ndjson.gz`), zlib.gzipSync(`{"shop":"s${k}","n":1}\n{"shop":"s${k}","n":2}\n`));
    fs.writeFileSync(path.join(cwd, `shards/crawl-report-${k}.json`), JSON.stringify({ finishedAt: `2026-11-08T0${k + 5}:00:00Z`, seconds: 100 + k, total: 2, shops: { [`s${k}`]: { count: 2, seconds: 3 } } }));
  }
  return cwd;
}

test('shards join into the products and the report everything downstream reads', () => {
  const cwd = fixture();
  run(cwd, { CRAWL_SHARDS: '2' });
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(cwd, 'generated/products.ndjson.gz'))).toString().trim().split('\n').map(JSON.parse);
  assert.deepEqual(lines.map((p) => `${p.shop}${p.n}`), ['s01', 's02', 's11', 's12']);
  const report = JSON.parse(fs.readFileSync(path.join(cwd, 'generated/crawl-report.json'), 'utf8'));
  assert.equal(report.total, 4);
  assert.equal(report.finishedAt, '2026-11-08T06:00:00Z');
  assert.deepEqual(Object.keys(report.shops), ['s0', 's1']);
});

test('a missing shard merges nothing: the previous products stay', () => {
  const cwd = fixture();
  fs.rmSync(path.join(cwd, 'shards/crawl-report-1.json'));
  assert.throws(() => run(cwd, { CRAWL_SHARDS: '2' }));
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(cwd, 'generated/products.ndjson.gz'))).toString(), '{"shop":"old"}\n');
});
