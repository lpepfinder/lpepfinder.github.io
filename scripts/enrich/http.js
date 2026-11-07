import { getJson } from '../lib/http.js';
import { sleep } from '../lib/pool.js';
import { config } from '../lib/config.js';

/**
 * JSON from the open sources, one request at a time per host, at least config.enrich.paceMs[host] apart
 * (a key matches the host or a parent domain: "wikipedia.org" covers en.wikipedia.org). Identifies the bot
 * (config.crawl.userAgent, with the site's address as contact), retries on 429/503 (scripts/lib/http.js).
 * Returns the data, or null (not found, error). `count` tells how many requests each host got.
 */
const next = new Map();
export const count = new Map();

const paceFor = (host) => {
  const key = Object.keys(config.enrich.paceMs).find((k) => host === k || host.endsWith(`.${k}`));
  return key ? config.enrich.paceMs[key] : 1000;
};

export async function json(url) {
  const host = new URL(url).host;
  const at = next.get(host) || 0;
  next.set(host, Math.max(at, Date.now()) + paceFor(host));
  if (at > Date.now()) await sleep(at - Date.now());
  count.set(host, (count.get(host) || 0) + 1);
  const res = await getJson(url);
  return res.ok ? res.data : null;
}
