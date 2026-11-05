import { toRecord } from '../record.js';
import { beginPass, endPass, putRecord, recordCount } from '../store.js';

/**
 * Paged reading of a public catalog endpoint, resumable across days.
 * `readPage(cursor)` returns { records: [{ url, p }], next } (next = null at the end),
 * or null on failure. A failed or empty pass makes the shop probe again next run.
 */
export async function runPass(ctx, readPage) {
  const { st } = ctx;
  if (!beginPass(st, ctx.today)) return;
  for (;;) {
    if (!ctx.canFetch()) return;
    const page = await readPage(st.cursor ?? null);
    if (!page) {
      if (ctx.canFetch()) st.probedAt = null;
      return;
    }
    for (const { url, p } of page.records) {
      const r = toRecord(p);
      if (r) putRecord(st, url, r, ctx.now, 0);
    }
    if (page.next == null) {
      endPass(st, ctx.today);
      if (!recordCount(st)) st.probedAt = null;
      return;
    }
    st.cursor = page.next;
  }
}

export const json = (res) => {
  if (!res?.ok) return null;
  try { return JSON.parse(res.text); } catch { return null; }
};
