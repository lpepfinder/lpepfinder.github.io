import { decode } from '../extract/structured.js';
import { runPass, json } from './pass.js';

/** Big Cartel stores on *.bigcartel.com: the public products.json, 100 products per page. */
export const name = 'bigcartel';
export const applies = (ctx) => /\.bigcartel\.com$/.test(new URL(ctx.origin).host);

const PAGE = 100;

/** products.json page -> [{ url, p }] */
export function bigcartelRecords(list, origin, currency) {
  return list.filter((p) => p.url).map((p) => {
    const options = p.options || [];
    return {
      url: new URL(p.url, origin).href,
      p: {
        title: decode(p.name || ''),
        price: Number(p.price) || Math.min(...options.map((o) => Number(o.price)).filter((n) => n > 0)) || null,
        currency,
        inStock: p.status !== 'sold-out' && (!options.length || options.some((o) => !o.sold_out)),
        image: p.images?.[0]?.url || null,
      },
    };
  });
}

export async function probe(ctx) {
  const list = json(await ctx.get(`${ctx.origin}/products.json?limit=1`, { accept: 'application/json' }));
  if (!Array.isArray(list)) return null;
  const store = json(await ctx.get(`${ctx.origin}/store.json`, { accept: 'application/json' }));
  return { currency: store?.currency?.code || (typeof store?.currency === 'string' ? store.currency : null) };
}

export function crawl(ctx) {
  return runPass(ctx, async (page) => {
    page ||= 1;
    const list = json(await ctx.get(`${ctx.origin}/products.json?limit=${PAGE}&page=${page}`, { accept: 'application/json' }));
    if (!Array.isArray(list)) return null;
    return { records: bigcartelRecords(list, ctx.origin, ctx.st.info.currency), next: list.length < PAGE ? null : page + 1 };
  });
}
