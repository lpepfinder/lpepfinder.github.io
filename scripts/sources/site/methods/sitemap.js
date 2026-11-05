import { site } from '../settings.js';
import { sitemapEntries } from '../sitemap.js';
import { extractProduct } from '../extract/page.js';
import { isProductUrl } from '../links.js';
import { crawlPages } from '../crawler.js';
import { seedPages } from '../seeds.js';

/**
 * Wix, closed WooCommerce, PrestaShop, OpenCart, BigCommerce...: the product sitemap lists
 * every product page, and those pages carry JSON-LD / microdata / og:price.
 * Only sitemap URLs are fetched (no link following).
 */
export const name = 'sitemap';
export const applies = (ctx) => site.sitemapPlatforms.includes(ctx.platform);

const isProductEntry = (url, e) => isProductUrl(url) || /product/i.test(e.from || '');
const SITEMAP_FILES = 20;

export async function probe(ctx) {
  const extra = ctx.platform === 'bigcommerce' ? [`${ctx.origin}/xmlsitemap.php`] : [];
  const products = (await sitemapEntries(ctx, { maxFiles: 4, extra })).filter((e) => isProductEntry(new URL(e.loc, ctx.origin).href, e));
  if (products.length < 5) return null;
  for (const e of [products[Math.floor(products.length / 2)], products[0]]) {
    const res = await ctx.get(new URL(e.loc, ctx.origin).href);
    if (!res?.ok) continue;
    const { product } = extractProduct(res.text, res.url, { names: ctx.names });
    if (product && !/heuristic/.test(product.via) && product.price > 0) return { products: products.length, via: product.via };
  }
  return null;
}

export const crawl = (ctx) => crawlPages(ctx, { follow: false, seed: (c) => seedPages(c, { filter: isProductEntry, maxFiles: SITEMAP_FILES }) });
