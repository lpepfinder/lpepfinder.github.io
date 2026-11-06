/**
 * Daily health report, run by Deploy after the build and the end-to-end tests:
 *   node scripts/health/index.js --history generated/health.json [--issue]
 * Compares today's numbers (numbers.js) with the last build of an earlier day (history.js), against the
 * thresholds in data/config.json "health" (rules.js); saves today's numbers in the history file;
 * with --issue, opens/updates or closes the one GitHub issue labelled "health" (issue.js).
 * Env: E2E_OUTCOME (the e2e step's outcome), RUN_URL (link to the workflow run), DIST (default dist).
 */
import { parseArgs } from 'node:util';
import { config } from '../lib/config.js';
import { readJson, writeJson } from '../lib/json.js';
import { collect } from './numbers.js';
import { assess } from './rules.js';
import { previousDay, record } from './history.js';
import { report } from './report.js';
import { syncIssue } from './issue.js';

const { values: args } = parseArgs({ options: { history: { type: 'string', default: 'generated/health.json' }, issue: { type: 'boolean', default: false } } });
const settings = config.health;
const now = new Date();
const day = now.toISOString().slice(0, 10);

const history = readJson(args.history, { days: {} });
const today = collect({ dist: process.env.DIST || 'dist', e2e: process.env.E2E_OUTCOME });
const previous = previousDay(history, day);
const result = assess(today, previous, settings, now);
const body = report({ day, today, previous, result, runUrl: process.env.RUN_URL });

// a build without an index tells nothing about the data: keep the last good numbers as the baseline
if (today.records > 0) writeJson(args.history, record(history, day, today, settings.keepDays), true);
console.log(body);
if (args.issue) console.log('health issue:', syncIssue({ degraded: result.degraded, body, day, label: settings.label }));
