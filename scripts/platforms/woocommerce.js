import { getJson } from '../lib/http.js';
import { sleep } from '../lib/pool.js';
import { decodeEntities } from '../lib/text.js';
import { keepProduct, musicRatio } from './filter.js';

const PAGE_SIZE = 100;
const api = (origin, q) => `${origin}/wp-json/wc/store/v1/products?${q}`;
const text = (p) => [decodeEntities(p.name), ...(p.categories || []).map((c) => c.name), ...(p.tags || []).map((t) => t.name)].join(' ');

export async function probe(origin) {
  const sample = await getJson(api(origin, 'per_page=100'));
  if (!sample.ok || !Array.isArray(sample.data)) return { ok: false, reason: `store_api_${sample.status || sample.error}` };
  return {
    ok: true,
    currency: sample.data[0]?.prices?.currency_code || null,
    total: Number(sample.headers.get('x-wp-total')) || null,
    musicRatio: musicRatio(sample.data.map((p) => [decodeEntities(p.name), text(p)])),
    sampleSize: sample.data.length,
  };
}

export async function* crawl(shop, { maxPages, delayMs, inStockOnly, deadline, strict }) {
  const origin = new URL(shop.url).origin;
  const stock = inStockOnly ? '&stock_status=instock' : '';
  for (let page = 1; page <= maxPages && Date.now() < deadline; page++) {
    const res = await getJson(api(origin, `per_page=${PAGE_SIZE}&page=${page}&orderby=date&order=desc${stock}`), { retries: 4 });
    if (!res.ok || !Array.isArray(res.data)) {
      if (page === 1) throw new Error(`store_api_${res.status || res.error}`);
      return;
    }
    for (const p of res.data) {
      if (inStockOnly && p.is_in_stock === false) continue;
      if (!keepProduct(decodeEntities(p.name), text(p), strict)) continue;
      const minor = p.prices?.currency_minor_unit ?? 2;
      const raw = Number(p.prices?.price);
      let url; try { url = new URL(p.permalink); } catch { continue; }
      yield {
        available: p.is_in_stock !== false,
        title: decodeEntities(p.name).trim(),
        vendor: null,
        type: p.categories?.[0]?.name || null,
        price: raw > 0 ? Math.round((raw / 10 ** minor) * 100) : null,
        currency: p.prices?.currency_code || null,
        path: url.host.replace(/^www\./, '') === new URL(origin).host.replace(/^www\./, '') ? url.pathname : url.href,
        image: (p.images?.[0]?.thumbnail || p.images?.[0]?.src || '').replace(/^https?:/, '') || null,
        updated: null,
        extra: [p.sku, ...(p.tags || []).map((t) => t.name)].filter(Boolean).join(' ').slice(0, 200) || null,
      };
    }
    if (res.data.length < PAGE_SIZE) return;
    await sleep(delayMs);
  }
}
