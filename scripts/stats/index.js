import fs from 'node:fs';
import path from 'node:path';
import { DATA, GENERATED } from '../lib/paths.js';
import { readJson, writeJson } from '../lib/json.js';
import { loadState } from '../lib/shops.js';

/**
 * Weekly snapshot of the data health in data/stats/<YYYY>-W<NN>.json: a history of
 * the numbers in git, and a commit that keeps GitHub from disabling the schedules
 * (scheduled workflows stop after 60 days without repository activity).
 */
const state = loadState();
const report = readJson(path.join(GENERATED, 'crawl-report.json'), {});
const statuses = Object.values(state).reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {});
const now = new Date();
const week = Math.ceil(((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
const sources = fs.readdirSync(GENERATED).filter((f) => /^products.*\.ndjson\.gz$/.test(f))
  .reduce((a, f) => ({ ...a, [f.replace(/^products-?|\.ndjson\.gz$/g, '') || 'shops']: fs.statSync(path.join(GENERATED, f)).size }), {});
const file = path.join(DATA, 'stats', `${now.getUTCFullYear()}-W${String(week).padStart(2, '0')}.json`);
// one snapshot (and one commit) per week
if (fs.existsSync(file)) { console.log('stats for this week already written'); process.exit(0); }
writeJson(file, { date: now.toISOString().slice(0, 10), shops: Object.keys(state).length, statuses, crawledRecords: report.total ?? null, sourceBytes: sources }, true);
console.log('stats written to', path.relative(process.cwd(), file));
