/** Fetches of the watch data files under /w/ (index.json, d/<date>.json, now/<xxx>.json). */
export const BASE = '/w/';

export const json = (path, init) => fetch(BASE + path, init).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export const index = () => json('index.json', { cache: 'no-cache' });
export const day = (date) => json(`d/${date}.json`);

/**
 * Current state for release keys, one request per shard (first 3 hex of the key),
 * a few at a time; onProgress(done, total) after each shard.
 */
export async function now(keys, onProgress = () => {}) {
  const shards = [...new Set(keys.map((k) => k.slice(0, 3)))];
  const total = shards.length;
  const found = {};
  let done = 0;
  const next = async () => {
    for (let s; (s = shards.pop());) {
      Object.assign(found, await json(`now/${s}.json`));
      onProgress(++done, total);
    }
  };
  await Promise.all(Array.from({ length: 6 }, next));
  return found;
}
