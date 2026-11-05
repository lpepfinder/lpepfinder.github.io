import { site } from '../settings.js';
import { decode } from '../extract/structured.js';
import { runPass, json } from './pass.js';

/**
 * Magento 2: the documented storefront GraphQL `products` query, when the shop leaves it open.
 * Paged and resumable; large catalogs take a few days per pass.
 */
export const name = 'magento-graphql';
export const applies = (ctx) => ctx.platform === 'magento';

const query = (page, size) => `{products(search:"",pageSize:${size},currentPage:${page}){total_count page_info{total_pages} items{name url_key url_suffix canonical_url stock_status small_image{url} price_range{minimum_price{final_price{value currency}}}}}}`;
const endpoint = (ctx, page, size) => `${ctx.origin}/graphql?query=${encodeURIComponent(query(page, size))}`;

/** GraphQL response -> [{ url, p }] */
export function magentoRecords(d, origin) {
  return (d?.data?.products?.items || []).filter((i) => i.url_key || i.canonical_url).map((i) => {
    const price = i.price_range?.minimum_price?.final_price;
    return {
      url: new URL(i.canonical_url || `${i.url_key}${i.url_suffix ?? '.html'}`, origin + '/').href,
      p: {
        title: decode(i.name || ''),
        price: price?.value ?? null,
        currency: price?.currency || null,
        inStock: i.stock_status ? i.stock_status === 'IN_STOCK' : null,
        image: i.small_image?.url || null,
      },
    };
  });
}

export async function probe(ctx) {
  const d = json(await ctx.get(endpoint(ctx, 1, 1), { accept: 'application/json' }));
  const total = d?.data?.products?.total_count;
  return total > 0 && !d.errors ? { total } : null;
}

export function crawl(ctx) {
  const size = site.magentoPageSize;
  return runPass(ctx, async (page) => {
    page ||= 1;
    const d = json(await ctx.get(endpoint(ctx, page, size), { accept: 'application/json' }));
    if (!d?.data?.products) return null;
    const pages = d.data.products.page_info?.total_pages || 1;
    return { records: magentoRecords(d, ctx.origin), next: page < pages ? page + 1 : null };
  });
}
