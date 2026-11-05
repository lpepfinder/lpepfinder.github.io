import { sleep } from '../../lib/pool.js';
import { parseRobots } from '../../lib/robots.js';
import { site, botNames, shopSettings } from './settings.js';
import { fetchPage, retryAfterSeconds, isBotWall } from './fetcher.js';
import { shopNames } from './extract/title.js';

const DAY = 864e5;

/**
 * Everything a reader needs for one shop and one run: its saved state, robots.txt rules,
 * and `get()`, which spends the shop's daily request budget and stops on rate limits or bot walls.
 */
export async function openShop(shop, st, { deadline, now }) {
  const settings = shopSettings(shop);
  const origin = new URL(shop.state.url).origin;
  const today = now.slice(0, 10);
  if (st.day?.d !== today) st.day = { d: today, used: 0 };
  const stopAt = Math.min(deadline, Date.now() + site.maxMinutesPerShop * 60_000);
  const ctx = {
    shop, st, origin, settings, now, today,
    platform: shop.state.platform || 'unknown',
    names: shopNames({ id: shop.id, name: shop.name, siteName: shop.state.name }),
    delayMs: settings.delayMs,
    robots: parseRobots(''),
    requests: 0,
    stopped: null,
    errorsInRow: 0,
  };
  ctx.stop = (reason) => { ctx.stopped ||= reason; };
  ctx.left = () => settings.pagesPerDay - st.day.used;
  ctx.canFetch = () => !ctx.stopped && ctx.left() > 0 && Date.now() < stopAt;
  ctx.allowed = (url) => {
    const u = new URL(url);
    return u.origin !== origin || ctx.robots.allowed(u.pathname + u.search);
  };
  ctx.get = async (url, opts = {}) => {
    if (!ctx.canFetch()) return null;
    if (!ctx.allowed(url)) return { ok: false, status: 'robots', text: '' };
    for (let attempt = 0; ; attempt++) {
      st.day.used++;
      ctx.requests++;
      const res = await fetchPage(url, { ...opts, delayMs: ctx.delayMs });
      if (isBotWall(res)) {
        ctx.stop('bot_protection');
        st.skipUntil = new Date(Date.now() + site.reevaluateDays * DAY).toISOString();
        return res;
      }
      if (res.status === 429 || res.status === 503) {
        const wait = retryAfterSeconds(res.headers?.get('retry-after'));
        if (attempt === 0 && wait != null && wait <= site.maxRetryAfterSeconds && Date.now() + wait * 1000 < stopAt) {
          await sleep(wait * 1000);
          continue;
        }
        ctx.stop(`rate_limited_${res.status}`);
        return res;
      }
      ctx.errorsInRow = res.ok || res.status === 404 || res.status === 410 ? 0 : ctx.errorsInRow + 1;
      if (ctx.errorsInRow >= 10) ctx.stop(`errors_${res.status || res.error}`);
      return res;
    }
  };

  const robots = await ctx.get(`${origin}/robots.txt`, { accept: 'text/plain' });
  if (!robots) return ctx;
  // a robots.txt that fails with a server error means "don't crawl now"
  if (robots.status === 0 || robots.status >= 500) ctx.stop(`robots_${robots.status || robots.error}`);
  else if (robots.ok && !/html/i.test(robots.type)) ctx.robots = parseRobots(robots.text, botNames);
  ctx.delayMs = Math.max(settings.delayMs, (ctx.robots.crawlDelay || 0) * 1000);
  return ctx;
}
