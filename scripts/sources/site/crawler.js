import { site } from './settings.js';
import { extractProduct } from './extract/page.js';
import { links, canonical, isProductUrl, priority } from './links.js';
import { createQueue } from './frontier.js';
import { toRecord } from './record.js';
import { addUrl, putRecord, markPage, recordCount } from './store.js';
import { checkYield, countPage, skipEmpty, checkSeeds } from './yield.js';
import { revisitDays, productDays } from './schedule.js';

const DAY = 864e5;
const segment = (u) => { const p = new URL(u).pathname.replace(/\/$/, ''); return p.slice(0, p.lastIndexOf('/') + 1); };
const sameHost = (a, b) => new URL(a).host.replace(/^www\./, '') === new URL(b).host.replace(/^www\./, '');

/**
 * Incremental page crawler for one shop. Every known URL has a due date: new URLs and
 * sitemap entries with a newer <lastmod> are due at once, listing pages every few days,
 * product pages every couple of weeks (ETag / Last-Modified sent when we have them).
 * `seed(ctx)` adds start URLs (home, sitemaps, Common Crawl); with `follow`, same-site
 * links found on fetched pages are added too.
 */
export async function crawlPages(ctx, { follow = true, seed }) {
  const { st } = ctx;
  const now = Date.now();
  await seed(ctx);
  st.learned ||= [];
  const learned = new Set(st.learned);
  const isProduct = (u) => isProductUrl(u) || learned.has(segment(u));
  const queue = createQueue({ isProduct, share: site.productLaneShare });
  const enqueue = (url) => {
    const s = st.seen[url];
    // new product pages before re-checks of known ones; Common Crawl URLs after the shop's own
    queue.push(url, priority(url, s.d ?? 1) + (s.k === 'p' ? 10 : 0) + (s.s === 'cc' && !s.t ? 2 : 0));
  };
  for (const [url, s] of Object.entries(st.seen)) if ((s.n || 0) <= now && ctx.allowed(url)) enqueue(url);
  const discover = (url, depth) => {
    if (url && ctx.allowed(url) && addUrl(st, url, depth, site.maxUrls)) enqueue(url);
  };

  const pDays = productDays(ctx, recordCount(st));
  const pending = []; // listing items without a URL, until a product URL template is known
  const urlOf = (i) => (i.url ? canonical(i.url, ctx.origin) : st.template && i.slug ? st.template.replace('{slug}', encodeURIComponent(i.slug)) : null);
  const putItem = (i, url) => {
    const r = toRecord(i);
    if (r && url) putRecord(st, url, r, ctx.now, revisitDays(pDays), { d: st.seen[url]?.d ?? 1 });
  };

  while (queue.size() && ctx.canFetch()) {
    const url = queue.pop();
    const prev = st.seen[url];
    if (!prev) continue;
    // validators only for record pages: listings are always read again, for their links
    const res = await ctx.get(url, prev.r ? { etag: prev.e, lastModified: prev.l } : {});
    if (!res) break;
    if (prev.s === 'cc' && !prev.t) checkSeeds(st, res.ok);
    if (res.status === 304) { Object.assign(prev, { t: ctx.now, n: revisitDays(pDays) }); continue; }
    if (!res.ok) {
      markPage(st, url, ctx.now, revisitDays(res.status === 404 || res.status === 410 ? site.revisit.goneDays : site.revisit.otherDays), 'x');
      continue;
    }
    if (!/html/i.test(res.type || 'text/html') || !sameHost(res.url, ctx.origin)) {
      markPage(st, url, ctx.now, revisitDays(site.revisit.goneDays), 'x');
      continue;
    }
    const finalUrl = canonical(res.url, ctx.origin) || url;
    const { product, items } = extractProduct(res.text, finalUrl, { names: ctx.names });
    const record = toRecord(product);
    const found = follow ? links(res.text, res.url) : [];
    if (record) {
      putRecord(st, url, record, ctx.now, revisitDays(pDays), { e: res.headers.get('etag') || undefined, l: res.headers.get('last-modified') || undefined });
    } else {
      const listing = items.length > 0 || found.filter(isProduct).length >= 3;
      const depth = prev.d ?? 1;
      const days = listing ? (depth <= 1 ? site.revisit.listingDays : site.revisit.deepListingDays) : site.revisit.otherDays;
      markPage(st, url, ctx.now, revisitDays(days), listing ? 'l' : 'x');
    }
    if (product) {
      const seg = segment(finalUrl);
      if (seg.length > 1 && !learned.has(seg)) { learned.add(seg); st.learned.push(seg); }
      if (!st.template && product.slug && finalUrl.endsWith('/' + product.slug)) st.template = finalUrl.slice(0, -product.slug.length) + '{slug}';
    }
    for (const i of items) {
      const u = urlOf(i);
      if (u) putItem(i, u);
      else if (i.slug && pending.length < 5000) pending.push(i);
    }
    if (st.template && pending.length) for (const i of pending.splice(0)) putItem(i, urlOf(i));
    countPage(st, ctx, !!product || items.length > 0);
    if ((prev.d ?? 1) < site.maxDepth) for (const l of found) discover(l, (prev.d ?? 1) + 1);
    if (checkYield(st, ctx)) return;
  }
  if (!queue.size()) skipEmpty(st, ctx);
}

/** Records still current: confirmed within the shop's record lifetime. */
export function liveRecords(st) {
  const maxAge = Math.max(site.recordMaxAgeDays, 3 * (st.productDays || 0)) * DAY;
  return Object.entries(st.seen).filter(([, s]) => s.r && Date.now() - Date.parse(s.t) < maxAge);
}
