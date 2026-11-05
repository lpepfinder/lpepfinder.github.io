import { createHash } from 'node:crypto';

/** One shop's listing of one record: 12 hex characters of sha1(shop + path). */
export const offerKey = (shop, path) => createHash('sha1').update(`${shop}\n${path}`).digest('hex').slice(0, 12);

/** Absolute product URL: paths are relative to the shop's origin unless they are full URLs (Discogs). */
export function productUrl(shop, path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = shop?.state?.url || shop?.url;
  return base ? new URL(base).origin + path : null;
}
