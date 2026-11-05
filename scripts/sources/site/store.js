import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { GENERATED } from '../../lib/paths.js';

/**
 * Site crawler state of one shard, one entry per shop:
 * - method, info, probedAt: the reader chosen by probing
 * - seen: the shop's URL registry, URL -> {
 *     d: link depth, n: next due (epoch ms, 0 = now), t: last fetched (ISO),
 *     k: kind (p product, l listing, x other), r: record, f: first seen,
 *     e: ETag, l: Last-Modified, m: sitemap lastmod, c: API pass number }
 * - cycle, open, doneOn, cursor: API readers' current pass
 * - day: requests used today; eval: product yield; skipUntil; sitemapAt; ccAt
 */
export const stateFile = (shard) => path.join(GENERATED, `site-${shard}-state.json.gz`);
export const outputFile = (shard) => path.join(GENERATED, `products-site-${shard}.ndjson.gz`);
export const reportFile = (shard) => path.join(GENERATED, `site-${shard}-report.json`);

export function loadSiteState(file) {
  if (!fs.existsSync(file)) return { version: 2, shops: {} };
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
}

export function saveSiteState(state, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', zlib.gzipSync(JSON.stringify(state)));
  fs.renameSync(file + '.tmp', file);
}

export const shopState = (state, id) => (state.shops[id] ||= { seen: {}, cycle: 0, open: false });

/** Add a URL to the registry (due now), unless known or the registry is full. */
export function addUrl(st, url, depth, max, extra = {}) {
  if (st.seen[url]) return false;
  if (Object.keys(st.seen).length >= max) return false;
  st.seen[url] = { d: depth, n: 0, ...extra };
  return true;
}

/** Store a record found at `url`; `next` is when to look at it again (epoch ms). */
export function putRecord(st, url, r, now, next, extra = {}) {
  const prev = st.seen[url] || {};
  st.seen[url] = { ...prev, ...extra, k: 'p', r, c: st.cycle, t: now, n: next, f: prev.r ? prev.f || prev.t : now };
}

/** A fetched page that holds no record. */
export function markPage(st, url, now, next, kind, extra = {}) {
  const { r, f, e, l, ...prev } = st.seen[url] || {};
  st.seen[url] = { ...prev, ...extra, k: kind, c: st.cycle, t: now, n: next };
}

/** API readers: start a pass unless one already ended today. False = nothing to do. */
export function beginPass(st, today) {
  if (st.open) return true;
  if (st.doneOn === today) return false;
  st.cycle = (st.cycle || 0) + 1;
  st.open = true;
  st.cursor = null;
  return true;
}

/** API readers: the pass is complete, drop records it did not see again. */
export function endPass(st, today) {
  for (const [url, s] of Object.entries(st.seen)) if (s.r && s.c < st.cycle) delete st.seen[url];
  st.open = false;
  st.doneOn = today;
  st.cursor = null;
}

export const recordCount = (st) => Object.values(st.seen).reduce((n, s) => n + (s.r ? 1 : 0), 0);
