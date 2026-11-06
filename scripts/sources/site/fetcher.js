import { gunzipSync } from 'node:zlib';
import { sleep } from '../../lib/pool.js';
import { site, userAgent } from './settings.js';

/** Last request time per host: requests to one host are at least `delayMs` apart. */
const lastHit = new Map();

const TEXTUAL = /html|xml|json|text|javascript|rss|atom/;

async function readCapped(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
    if (n > maxBytes) { await reader.cancel(); break; }
  }
  return Buffer.concat(chunks);
}

/**
 * One polite GET: bot user agent, per-host spacing, timeout, size cap, conditional headers.
 * Never throws: network errors come back as { ok: false, status: 0, error }.
 */
export async function fetchPage(url, { delayMs = site.delayMs, accept = 'text/html,application/xhtml+xml,*/*;q=0.8', etag, lastModified } = {}) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) || 0) + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  const headers = { 'user-agent': userAgent, accept };
  if (etag) headers['if-none-match'] = etag;
  if (lastModified) headers['if-modified-since'] = lastModified;
  let res;
  try {
    res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(site.timeoutMs) });
  } catch (e) {
    return { ok: false, status: 0, error: e.cause?.code || e.name || 'fetch_error', text: '' };
  } finally {
    lastHit.set(host, Date.now());
  }
  const type = res.headers.get('content-type') || '';
  const base = { ok: res.ok, status: res.status, url: res.url || url, type, headers: res.headers, text: '' };
  if (res.status === 304) { await res.body?.cancel(); return { ...base, ok: true }; }
  const gz = /\.gz$/.test(new URL(url).pathname);
  if (!gz && type && !TEXTUAL.test(type)) { await res.body?.cancel(); return base; }
  try {
    const buf = await readCapped(res, site.maxBytes);
    base.text = (gz && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8');
  } catch (e) {
    return { ...base, ok: false, error: e.cause?.code || e.name };
  }
  return base;
}

/** Retry-After as seconds (number or HTTP date), or null. */
export function retryAfterSeconds(value) {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, n);
  const d = Date.parse(value);
  return Number.isFinite(d) ? Math.max(0, (d - Date.now()) / 1000) : null;
}

const CHALLENGE = /challenge-platform|cf-chl|cf_chl|captcha|just a moment\.\.\.|attention required|access denied|ddos-guard|sucuri website firewall|perimeterx|datadome/i;

// AWS WAF answers 202 with a JavaScript challenge page instead of the site
const AWS_WAF = /awsWafCookieDomainList|gokuProps/;

/** A bot wall (Cloudflare challenge, AWS WAF and similar). We never try to get past one. */
export const isBotWall = (res) =>
  res.headers?.get?.('cf-mitigated') === 'challenge' ||
  (res.status === 202 && AWS_WAF.test((res.text || '').slice(0, 20000))) ||
  ([401, 403, 503].includes(res.status) && CHALLENGE.test((res.text || '').slice(0, 20000)));
