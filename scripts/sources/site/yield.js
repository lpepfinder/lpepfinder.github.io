import { site } from './settings.js';
import { recordCount } from './store.js';

const DAY = 864e5;

/**
 * Quality gate. Shops where fewer than `minProductRatio` of the first `evaluateAfterPages`
 * pages held records, or that have no record once every known URL was fetched,
 * drop to a monthly re-check (`reevaluateDays`). Shops with records keep their full budget.
 */
const skip = (st, ctx, reason) => {
  st.skipUntil = new Date(Date.now() + site.reevaluateDays * DAY).toISOString();
  st.skipReason = reason;
  st.eval = null;
  ctx.stop(reason);
};

export function countPage(st, ctx, productive) {
  if (!st.eval || (!st.eval.passed && Date.now() - Date.parse(st.eval.since) > site.reevaluateDays * DAY)) st.eval = { since: ctx.now, pages: 0, good: 0 };
  st.eval.pages++;
  if (productive) st.eval.good++;
}

/** After each page: true when the shop was just found to be low-yield (and is now skipped). */
export function checkYield(st, ctx) {
  const e = st.eval;
  if (!e || e.passed || e.pages < site.evaluateAfterPages) return false;
  if (e.good / e.pages >= site.minProductRatio) { e.passed = true; return false; }
  skip(st, ctx, `low_yield_${e.good}/${e.pages}`);
  return true;
}

/** After a run that fetched everything it knew about: no records at all means skip. */
export function skipEmpty(st, ctx) {
  if (Object.values(st.seen).some((s) => !s.t) || recordCount(st) > 0) return;
  skip(st, ctx, 'no_records');
}
