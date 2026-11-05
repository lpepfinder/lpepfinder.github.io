import { sitemapEntries } from '../sitemap.js';
import { decode } from '../extract/structured.js';
import { runPass, json } from './pass.js';

/**
 * Squarespace: every page answers with its JSON model when asked with ?format=json.
 * A store collection lists 200 products per request, with variants, prices and stock.
 */
export const name = 'squarespace-json';
export const applies = (ctx) => ctx.platform === 'squarespace';

const withFormat = (path) => path + (path.includes('?') ? '&' : '?') + 'format=json';
const isStore = (d) => Array.isArray(d?.items) && d.items.some((i) => i.variants || i.structuredContent?.variants);

/** One collection page -> [{ url, p }] */
export function squarespaceRecords(d, origin) {
  return (d.items || []).filter((i) => i.fullUrl && (i.variants || i.structuredContent?.variants)).map((i) => {
    const variants = i.variants || i.structuredContent.variants;
    const prices = variants
      .map((v) => (v.onSale && Number(v.salePriceMoney?.value) > 0 ? Number(v.salePriceMoney.value) : Number(v.priceMoney?.value ?? v.price / 100)))
      .filter((n) => n > 0);
    return {
      url: new URL(i.fullUrl, origin).href,
      p: {
        title: decode(i.title || ''),
        price: prices.length ? Math.min(...prices) : null,
        currency: variants[0]?.priceMoney?.currency || null,
        inStock: variants.some((v) => v.unlimited || v.qtyInStock > 0),
        image: i.assetUrl || null,
      },
    };
  });
}

export async function probe(ctx) {
  const paths = new Set();
  for (const e of await sitemapEntries(ctx, { maxFiles: 2 })) {
    const m = new URL(e.loc, ctx.origin).pathname.match(/^(.*)\/p\/[^/]+\/?$/);
    if (m) paths.add(m[1] || '/');
  }
  if (!paths.size) ['/shop', '/store'].forEach((p) => paths.add(p));
  const collections = [];
  for (const path of [...paths].slice(0, 6)) {
    if (isStore(json(await ctx.get(ctx.origin + withFormat(path), { accept: 'application/json' })))) collections.push(path);
  }
  return collections.length ? { collections } : null;
}

export function crawl(ctx) {
  const { collections } = ctx.st.info;
  return runPass(ctx, async (cursor) => {
    const { i = 0, next = null } = cursor || {};
    const d = json(await ctx.get(ctx.origin + withFormat(next || collections[i]), { accept: 'application/json' }));
    if (!d) return null;
    const more = d.pagination?.nextPage && d.pagination.nextPageUrl;
    const nextCursor = more ? { i, next: d.pagination.nextPageUrl } : i + 1 < collections.length ? { i: i + 1, next: null } : null;
    return { records: squarespaceRecords(d, ctx.origin), next: nextCursor };
  });
}
