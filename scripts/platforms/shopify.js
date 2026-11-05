import { getJson } from '../lib/http.js';
import { sleep } from '../lib/pool.js';
import { decodeEntities, displayTitle } from '../lib/text.js';
import { keepProduct, musicRatio } from './filter.js';

const PAGE_SIZE = 250;
const text = (p) => [p.title, p.product_type, p.vendor, ...(Array.isArray(p.tags) ? p.tags : [p.tags])].join(' ');

/** Shop metadata and a catalog sample. */
export async function probe(origin) {
  const meta = await getJson(`${origin}/meta.json`);
  const sample = await getJson(`${origin}/products.json?limit=100`);
  if (!sample.ok) return { ok: false, reason: `products_json_${sample.status || sample.error}` };
  const products = sample.data.products || [];
  return {
    ok: true,
    name: meta.data?.name || null,
    city: meta.data?.city || null,
    country: meta.data?.country || null,
    currency: meta.data?.currency || null,
    // shops often put the artist in `vendor` and only the album in `title`
    musicRatio: musicRatio(products.map((p) => [displayTitle(p.title, p.vendor), text(p)])),
    sampleSize: products.length,
  };
}

function toRecord(p, inStockOnly) {
  const prices = (p.variants || []).filter((v) => v.available || !inStockOnly).map((v) => parseFloat(v.price)).filter((n) => n > 0);
  return {
    title: decodeEntities(p.title).trim(),
    vendor: p.vendor || null,
    type: p.product_type || null,
    price: prices.length ? Math.round(Math.min(...prices) * 100) : null,
    path: `/products/${p.handle}`,
    image: p.images?.[0]?.src?.replace(/^https?:/, '') || null,
    updated: p.updated_at || p.published_at || null,
  };
}

/**
 * Page through one products.json list. Returns true when it stopped at the
 * platform limit (25k products per list) rather than at the end of the list.
 */
async function* list(url, opts, seen, budget, firstIsFatal) {
  const { maxPages, delayMs, inStockOnly, deadline, strict } = opts;
  for (let page = 1; page <= maxPages; page++) {
    if (Date.now() > deadline || budget.left-- <= 0) return false;
    const res = await getJson(`${url}?limit=${PAGE_SIZE}&page=${page}`, { retries: 4 });
    if (!res.ok) {
      if (page === 1 && firstIsFatal) throw new Error(`products_json_${res.status || res.error}`);
      return page > maxPages - 1 || res.status === 400; // Shopify answers 400 past the limit
    }
    const products = res.data.products || [];
    for (const p of products) {
      if (seen.has(p.handle)) continue;
      seen.add(p.handle);
      if (inStockOnly && !p.variants?.some((v) => v.available)) continue;
      if (!keepProduct(p.title, text(p), strict)) continue;
      yield toRecord(p, inStockOnly);
    }
    if (products.length < PAGE_SIZE) return false;
    await sleep(delayMs);
  }
  return true;
}

/** Yield in-stock music products: the main list, then collections when the main list is capped. */
export async function* crawl(shop, opts) {
  const seen = new Set();
  const budget = { left: opts.maxRequests ?? Infinity };
  const capped = yield* list(`${shop.url}/products.json`, opts, seen, budget, true);
  if (!capped) return;
  for (let page = 1; page <= 40 && budget.left > 0 && Date.now() < opts.deadline; page++) {
    const res = await getJson(`${shop.url}/collections.json?limit=250&page=${page}`, { retries: 4 });
    const collections = res.ok ? res.data.collections || [] : [];
    budget.left--;
    for (const c of collections.sort((a, b) => (b.products_count || 0) - (a.products_count || 0))) {
      if (c.products_count === 0) continue;
      yield* list(`${shop.url}/collections/${c.handle}/products.json`, opts, seen, budget, false);
    }
    if (collections.length < 250) return;
  }
}
