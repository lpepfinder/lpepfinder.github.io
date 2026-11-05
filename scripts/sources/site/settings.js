import { config } from '../../lib/config.js';

/** config.json "site" block, plus the shared bot identity from "crawl". */
export const site = config.site;
export const userAgent = config.crawl.userAgent;
export const botNames = config.crawl.botNames;

/** Settings for one shop: defaults, the shop file's optional "crawl" object, env overrides for test runs. */
export function shopSettings(shop) {
  const o = shop.crawl || {};
  return {
    pagesPerDay: Number(process.env.SITE_PAGES) || o.pagesPerDay || site.pagesPerDay,
    // overrides can only slow us down, never go below the default spacing
    delayMs: Math.max(site.delayMs, o.delayMs || 0),
    method: o.method || null,
    start: o.start || [],
  };
}
