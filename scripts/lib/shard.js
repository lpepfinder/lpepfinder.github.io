import { createHash } from 'node:crypto';

/** Stable shard of a shop: hash(id) % shards. The site crawler and the catalog crawl split shops the same way. */
export const shardOf = (id, shards) => parseInt(createHash('sha1').update(id).digest('hex').slice(0, 8), 16) % shards;
