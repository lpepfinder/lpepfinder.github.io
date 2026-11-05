import { config } from '../../lib/config.js';
import { sleep } from '../../lib/pool.js';

const API = 'https://api.discogs.com';

/** Official Discogs API client with its rate limit (25/min anonymous, 60/min with a token). */
export function discogsClient(token = process.env.DISCOGS_TOKEN) {
  const perMinute = config.discogs.requestsPerMinute[token ? 'token' : 'anonymous'];
  const gap = 60_000 / perMinute;
  let last = 0;
  return async function request(path) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetch(API + path, {
        headers: { 'user-agent': config.crawl.userAgent, ...(token ? { authorization: `Discogs token=${token}` } : {}) },
        signal: AbortSignal.timeout(30_000),
      }).catch(() => null);
      if (res?.status === 429) { await sleep(60_000); continue; }
      if (!res?.ok) return null;
      return res.json();
    }
    return null;
  };
}

/** One "For Sale" listing -> record. */
export const toRecord = (l) => ({
  title: l.release?.description || [l.release?.artist, l.release?.title].filter(Boolean).join(' - '),
  vendor: null,
  type: l.release?.format || null,
  price: l.price?.value > 0 ? Math.round(l.price.value * 100) : null,
  currency: l.price?.currency || null,
  path: l.uri,
  image: l.release?.thumbnail || null,
  condition: l.condition || null,
  // exact match key for the offer ledger and the Discogs wantlist import
  discogsRelease: l.release?.id || null,
  updated: l.posted || null,
});

/** All listings for sale of one seller, newest first. */
export async function* inventory(request, seller, maxPages) {
  for (let page = 1; page <= maxPages; page++) {
    const data = await request(`/users/${encodeURIComponent(seller)}/inventory?status=For%20Sale&sort=listed&sort_order=desc&per_page=100&page=${page}`);
    if (!data?.listings) return;
    yield data.listings;
    if (page >= (data.pagination?.pages || 0)) return;
  }
}
