import { loadShops, loadState } from '../lib/shops.js';
import { writeJson, readJson } from '../lib/json.js';
import { files } from '../lib/paths.js';
import { pool } from '../lib/pool.js';
import { config } from '../lib/config.js';
import { checkShop, catalogUrl } from './shop.js';
import { checkKind } from './plan.js';
import { lightCheck } from './light.js';
import { withHistory } from './history.js';

/**
 * Health check of every shop; writes generated/shops-state.json with each shop's history. Each shop gets the
 * check it needs today (plan.js): full, robots.txt only, or none.
 */
const shops = loadShops().filter((s) => !s.disabled);
const previous = loadState();
const only = process.argv[2];
const todo = only ? shops.filter((s) => s.id.includes(only)) : shops;
const next = only ? previous : {};
const started = Date.now();
let done = 0;

// yesterday's crawl: a shop whose catalog failed gets its full check today
const crawled = readJson(files.crawlReport, {}).shops || {};
const kinds = {};
await pool(todo, config.crawl.concurrency * 2, async (shop) => {
  const prev = previous[shop.id];
  let kind = only ? 'full' : checkKind(prev, { source: catalogUrl(shop), crawlError: !!crawled[shop.id]?.error, ...config.check });
  try {
    if (kind === 'skip') next[shop.id] = prev;
    else if (kind === 'light') next[shop.id] = await lightCheck(prev);
    if (!next[shop.id]) { kind = 'full'; next[shop.id] = await checkShop(shop, prev); }
  } catch (e) {
    next[shop.id] = { status: 'dead', reason: `check_error_${e.message}`.slice(0, 80), checkedAt: new Date().toISOString() };
  }
  kinds[kind] = (kinds[kind] || 0) + 1;
  if (++done % 100 === 0) console.log(`checked ${done}/${todo.length}`);
});

// the same shop listed under two domains (one redirects to the other): keep the first
const byOrigin = new Map();
for (const [id, st] of Object.entries(next)) {
  if (st.status !== 'ok' && st.status !== 'listed') continue;
  const origin = (st.url || '').replace('://www.', '://');
  if (byOrigin.has(origin)) Object.assign(st, { status: 'duplicate', reason: `same_as_${byOrigin.get(origin)}` });
  else byOrigin.set(origin, id);
}

const checked = new Set(todo.map((s) => s.id));
for (const id of checked) if (next[id]) next[id] = withHistory(next[id], previous[id]);
// shops removed from data/shops keep no state; their history stays in git

writeJson(files.state, next, true);
const counts = Object.values(next).reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {});
console.log('check done in', Math.round((Date.now() - started) / 1000), 's', counts, 'checks', kinds);
