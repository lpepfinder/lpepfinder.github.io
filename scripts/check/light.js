import { get } from '../lib/http.js';
import { parseRobots } from '../lib/robots.js';
import { config } from '../lib/config.js';

const API_PATHS = { shopify: '/products.json', woocommerce: '/wp-json/wc/store/v1/products' };

/**
 * The light check (plan.js): robots.txt only. The previous state with today's crawl delay, or null when a full
 * check is needed instead (robots.txt unreachable, or the shop now blocks our bot: the full check records it).
 */
export async function lightCheck(prev) {
  const res = await get(`${prev.url}/robots.txt`);
  if (!res.ok && res.status !== 404) { await res.body?.cancel?.(); return null; }
  const robots = parseRobots(res.ok ? await res.text() : '', config.crawl.botNames);
  const path = API_PATHS[prev.platform];
  if ((path && !robots.allowed(path)) || !robots.allowed('/products/') || !robots.allowed('/')) return null;
  return { ...prev, crawlDelay: robots.crawlDelay, lightCheckedAt: new Date().toISOString() };
}
