import { createHash } from 'node:crypto';
import { loadShops, loadState } from '../../lib/shops.js';

/** Stable shard of a shop: hash(id) % shards. */
export const shardOf = (id, shards) => parseInt(createHash('sha1').update(id).digest('hex').slice(0, 8), 16) % shards;

/**
 * Shops for the site crawler: alive ("listed") but without a catalog API we read, not
 * not behind a bot wall, not Shopify-hosted
 * (those belong to the Shopify adapter), and not opted out in their shop file.
 */
export function targetShops({ shard = 0, shards = 1, only = [] } = {}) {
  const state = loadState();
  return loadShops()
    .filter((s) => !s.disabled && !s.crawl?.skip)
    .map((s) => ({ ...s, state: state[s.id] }))
    .filter((s) => s.state?.status === 'listed' && s.state.url)
    .filter((s) => !/^bot_protection/.test(s.state.reason || ''))
    .filter((s) => s.state.platform !== 'shopify' && !/\.myshopify\.com$/.test(new URL(s.state.url).host))
    .filter((s) => (only.length ? only.includes(s.id) : shardOf(s.id, shards) === shard));
}
