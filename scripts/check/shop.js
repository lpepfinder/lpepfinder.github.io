import { get } from '../lib/http.js';
import { parseRobots } from '../lib/robots.js';
import { hostOf } from '../lib/shops.js';
import { config } from '../lib/config.js';
import { detectPlatform, pageTitle } from '../platforms/detect.js';
import { adapters } from '../platforms/index.js';
import { mentionsFormat } from '../platforms/filter.js';

const PLATFORM_HOSTS = /\.(myshopify\.com|bigcartel\.com|bandcamp\.com|square\.site|wpcomstaging\.com)$/;
const PARKED = /domain (is )?for sale|buy this domain|parked free|sedoparking|this domain may be for sale|hugedomains/i;
const baseName = (host) => (host || '').replace(/^(www|shop|store)\./, '').split('.').slice(0, -1).join('.');

/**
 * Check one shop: reachable, allowed by robots.txt, platform, metadata,
 * and whether it still sells records. Returns its new state.
 */
export async function checkShop(shop, previous = {}) {
  const state = { checkedAt: new Date().toISOString(), fails: 0 };
  const home = await get(shop.url);
  // the site answers but refuses bots (Cloudflare and similar): alive, just not readable by us
  if ([401, 403, 429, 503].includes(home.status)) {
    await home.body?.cancel?.();
    return { ...state, url: new URL(home.url || shop.url).origin, status: 'listed', reason: `bot_protection_${home.status}`, platform: previous.platform || null, name: previous.name || null };
  }
  if (!home.ok) {
    const fails = (previous.fails || 0) + 1;
    // a single failure keeps the previous good state, to ride out blips
    if (previous.status === 'ok' && fails < 2) return { ...previous, fails, lastError: home.error || `http_${home.status}` };
    return { ...state, status: 'dead', reason: home.error || `http_${home.status}`, fails };
  }
  const html = (await home.text()).slice(0, 400_000);
  const finalUrl = new URL(home.url);
  state.url = finalUrl.origin;
  if (PARKED.test(html)) return { ...state, status: 'dead', reason: 'parked' };

  const movedTo = hostOf(finalUrl.href);
  const moved = movedTo !== shop.id && baseName(movedTo) !== baseName(shop.id) && !PLATFORM_HOSTS.test(movedTo);
  const looksMusic = mentionsFormat(html.replace(/<[^>]+>/g, ' '));
  if (moved && !looksMusic) return { ...state, status: 'moved', reason: `redirects_to_${movedTo}` };

  const robotsRes = await get(`${finalUrl.origin}/robots.txt`);
  const robots = parseRobots(robotsRes.ok ? await robotsRes.text() : '', config.crawl.botNames);
  state.crawlDelay = robots.crawlDelay;
  state.platform = detectPlatform(html, home.headers);
  state.name = pageTitle(html);

  const adapter = adapters[state.platform];
  if (adapter) {
    const path = state.platform === 'shopify' ? '/products.json' : '/wp-json/wc/store/v1/products';
    if (!robots.allowed(path) || !robots.allowed('/products/')) return { ...state, status: 'blocked', reason: 'robots_txt' };
    if ((robots.crawlDelay || 0) > config.crawl.maxCrawlDelaySeconds) state.slow = true;
    const info = await adapter.probe(finalUrl.origin);
    if (info.ok) {
      Object.assign(state, { ...info, name: info.name || state.name, ok: undefined });
      if (info.sampleSize >= 10 && info.musicRatio < config.products.minShopMusicRatio) {
        return { ...state, status: 'not-music', reason: `music_ratio_${info.musicRatio.toFixed(2)}` };
      }
      return { ...state, status: 'ok' };
    }
    state.apiError = info.reason;
  }
  return { ...state, status: 'listed', reason: adapter ? state.apiError : 'no_catalog_api' };
}
