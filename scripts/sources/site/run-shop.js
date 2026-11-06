import { openShop } from './context.js';
import { chooseMethod } from './methods/index.js';
import { recordCount } from './store.js';
import { reevaluate } from './yield.js';

/** One shop's run: robots.txt, pick a reader, read within today's budget. Returns a report line. */
export async function runShop(shop, st, { deadline, now }) {
  const t0 = Date.now();
  reevaluate(st);
  if (st.skipUntil && Date.parse(st.skipUntil) > Date.now()) return { skipped: st.skipReason || 'skip', records: recordCount(st) };
  if (st.skipUntil) { st.skipUntil = null; st.skipReason = null; }
  const ctx = await openShop(shop, st, { deadline, now });
  let method = null;
  try {
    method = ctx.canFetch() ? await chooseMethod(ctx) : null;
    if (method && ctx.canFetch()) await method.crawl(ctx);
  } catch (e) {
    ctx.stop(`error_${e.message}`.slice(0, 80));
  }
  st.lastRunAt = now;
  st.lastStop = ctx.stopped;
  return {
    method: method?.name || null,
    requests: ctx.requests,
    records: recordCount(st),
    stopped: ctx.stopped,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
