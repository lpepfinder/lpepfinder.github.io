/** Fetches of the watch data files under /w/ (index.json, d/<date>.json, now/<xxx>.json, cat/<xx>.json, shops.json). */
import config from '../../../data/watch.json' with { type: 'json' };
import * as cache from './now-cache.js';
import { catShard } from './catno.js';

export const BASE = '/w/';
/** Fired on window while `now` shards load: detail { done, total }. */
export const PROGRESS = 'vf-watch-progress';

export const json = (path, init) => fetch(BASE + path, init).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export const index = () => json('index.json', { cache: 'no-cache' });
export const day = (date) => json(`d/${date}.json`);

let shopList = null;
/** Shop ids for the shop indexes in `now` entries (same build). */
export const shops = () => (shopList ??= json('shops.json').then((s) => s || []));

/** One shard: {} when it doesn't exist (no release with that prefix), null on a network error. */
const shard = (s) => fetch(`${BASE}now/${s}.json`).then((r) => (r.ok ? r.json() : r.status === 404 ? {} : null)).catch(() => null);

let queue = Promise.resolve();

/**
 * Current state for release keys: { key: [inStock, soldOut, minCents, currency, shops?] } for the
 * keys found. One request per shard (first 3 hex of the key), config.nowConcurrency at a time,
 * cached per data build (now-cache.js) so only keys not checked yet are fetched. Calls run one
 * after the other, so the header check and the watch page never fetch a shard twice.
 */
export function now(keys) {
  queue = queue.then(() => load(keys), () => load(keys));
  return queue;
}

async function load(keys) {
  const c = cache.open((await index())?.builtAt || null);
  const byShard = new Map();
  for (const k of keys) {
    if (c.checked.has(k)) continue;
    const s = k.slice(0, 3);
    if (!byShard.has(s)) byShard.set(s, []);
    byShard.get(s).push(k);
  }
  const todo = [...byShard.keys()];
  const total = todo.length;
  let done = 0;
  const progress = () => dispatchEvent(new CustomEvent(PROGRESS, { detail: { done, total } }));
  const next = async () => {
    for (let s; (s = todo.pop());) {
      const rows = await shard(s);
      if (rows) for (const k of byShard.get(s)) {
        c.checked.add(k);
        if (rows[k]) c.rows[k] = rows[k];
      }
      done++;
      if (done % config.nowSaveEvery === 0) cache.save(c);
      progress();
    }
  };
  if (total) {
    progress();
    await Promise.all(Array.from({ length: config.nowConcurrency }, next));
    cache.save(c);
  }
  return Object.fromEntries(keys.filter((k) => c.rows[k]).map((k) => [k, c.rows[k]]));
}

/**
 * Catalog-number entries ({ catno: ["releaseKey:tag", …] }) for the numbers given, one request per
 * shard (first two characters), config.nowConcurrency at a time. The browser's HTTP cache keeps them for the day.
 */
export async function cat(catnos) {
  const byShard = new Map();
  for (const c of new Set(catnos)) {
    const s = catShard(c);
    if (!byShard.has(s)) byShard.set(s, []);
    byShard.get(s).push(c);
  }
  const todo = [...byShard.keys()];
  const out = {};
  const next = async () => {
    for (let s; (s = todo.pop());) {
      const rows = await json(`cat/${encodeURIComponent(s)}.json`);
      if (rows) for (const c of byShard.get(s)) if (rows[c]) out[c] = rows[c];
    }
  };
  await Promise.all(Array.from({ length: config.nowConcurrency }, next));
  return out;
}
