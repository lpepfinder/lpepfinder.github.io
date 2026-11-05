import { site } from './settings.js';
import { canonical } from './links.js';
import { addUrl } from './store.js';
import { sitemapEntries } from './sitemap.js';

const DAY = 864e5;

/**
 * Start URLs of a shop's crawl: home page, the shop file's `crawl.start` paths and,
 * every `sitemapDays`, its sitemap entries that pass `filter`. A known URL whose
 * <lastmod> is newer than our last fetch falls due again.
 */
export async function seedPages(ctx, { filter, maxFiles = site.sitemapFiles } = {}) {
  const { st, origin } = ctx;
  addUrl(st, `${origin}/`, 0, site.maxUrls);
  for (const p of ctx.settings.start) {
    const u = canonical(p, origin);
    if (u) addUrl(st, u, 1, site.maxUrls);
  }
  if (!filter || (st.sitemapAt && Date.now() - Date.parse(st.sitemapAt) < site.sitemapDays * DAY)) return;
  const entries = await sitemapEntries(ctx, { maxFiles });
  for (const e of entries) {
    const u = canonical(e.loc, origin);
    if (!u || !filter(u, e)) continue;
    const s = st.seen[u];
    if (!s) addUrl(st, u, 1, site.maxUrls, e.lastmod ? { m: e.lastmod } : {});
    else if (e.lastmod && e.lastmod !== s.m) {
      s.m = e.lastmod;
      if (s.t && Date.parse(e.lastmod) > Date.parse(s.t)) s.n = 0;
    }
  }
  if (entries.length || ctx.canFetch()) st.sitemapAt = ctx.now;
}
