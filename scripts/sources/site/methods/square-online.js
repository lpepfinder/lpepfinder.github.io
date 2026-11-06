import { site } from '../settings.js';
import { decode } from '../extract/structured.js';
import { runPass, json } from './pass.js';

/**
 * Square Online (ex Weebly) stores: pages are drawn by JavaScript, but every page carries the
 * store's ids in window.__BOOTSTRAP_STATE__, and the storefront reads its catalog from the
 * shop's own /app/store/api products endpoint: names, prices, stock, 200 per request.
 */
export const name = 'square-online';
export const applies = (ctx) => ctx.platform === 'square' || /\.square\.site$/.test(new URL(ctx.origin).host);

/** Store ids from a page's bootstrap state: { user, site, currency }, or null. */
export function squareStore(html = '') {
  const m = html.match(/__BOOTSTRAP_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  let d;
  try { d = JSON.parse(m[1]); } catch { return null; }
  const user = d.siteData?.user?.id;
  const props = d.siteData?.site?.properties || {};
  const siteId = props.catalogSiteId || props.classicSiteID;
  return user && siteId ? { user: String(user), site: String(siteId), currency: d.storeInfo?.currency || null } : null;
}

const endpoint = (ctx, { user, site: siteId }, page, size) =>
  `${ctx.origin}/app/store/api/v28/editor/users/${user}/sites/${siteId}/products?page=${page}&per_page=${size}`;

/** products response -> [{ url, p }]; tickets, donations and other non-physical items are left out. */
export function squareOnlineRecords(d, origin, currency) {
  return (d?.data || [])
    .filter((i) => (i.absolute_site_link || i.site_link) && (!i.product_type || i.product_type === 'physical') && i.visibility !== 'hidden')
    .map((i) => ({
      url: new URL(i.absolute_site_link || i.site_link, origin + '/').href,
      p: {
        title: decode(i.name || ''),
        price: Number(i.price?.low ?? i.price?.regular_low) || null,
        currency,
        inStock: !(i.badges?.out_of_stock || i.inventory?.all_variations_sold_out),
        image: i.thumbnail?.data?.absolute_url || null,
      },
    }));
}

export async function probe(ctx) {
  const home = await ctx.get(`${ctx.origin}/`);
  const store = home?.ok ? squareStore(home.text) : null;
  if (!store) return null;
  const d = json(await ctx.get(endpoint(ctx, store, 1, 1), { accept: 'application/json' }));
  const total = d?.meta?.pagination?.total;
  return total > 0 ? { ...store, total } : null;
}

export function crawl(ctx) {
  const info = ctx.st.info;
  return runPass(ctx, async (page) => {
    page ||= 1;
    const d = json(await ctx.get(endpoint(ctx, info, page, site.squareOnlinePageSize), { accept: 'application/json' }));
    if (!Array.isArray(d?.data)) return null;
    const pages = d.meta?.pagination?.total_pages || 1;
    return { records: squareOnlineRecords(d, ctx.origin, info.currency), next: page < pages ? page + 1 : null };
  });
}
