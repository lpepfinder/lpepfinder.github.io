import { config } from './config.js';
import { sleep } from './pool.js';

const { userAgent, timeoutMs } = config.crawl;

/**
 * Polite GET: identifies the bot, times out, retries on 429/503 honouring Retry-After.
 * Returns { ok, status, url, headers, text(), json() } or { ok:false, error }.
 */
export async function get(url, { accept = '*/*', retries = 2, redirect = 'follow', headers = {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        redirect,
        headers: { 'user-agent': userAgent, accept, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      return { ok: false, status: 0, error: e.cause?.code || e.name || 'fetch_error' };
    }
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      // honour Retry-After, else back off 15s, 30s, 60s...
      const wait = Math.min(Number(res.headers.get('retry-after')) || 15 * 2 ** attempt, 120);
      await res.body?.cancel();
      await sleep(wait * 1000);
      continue;
    }
    return res;
  }
}

export async function getJson(url, opts) {
  const res = await get(url, { accept: 'application/json', ...opts });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  try {
    return { ok: true, status: res.status, headers: res.headers, data: await res.json() };
  } catch {
    return { ok: false, status: res.status, error: 'invalid_json' };
  }
}
