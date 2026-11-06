/**
 * "Did you mean": the closest known token in a token's own shard (same first three letters),
 * by edit distance (at most `max`), the most frequent first. Shared by the browser and the tests.
 */

/** Levenshtein distance, or max + 1 as soon as it is known to be larger. */
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** How many records a shard entry lists: a count, or (older format) "base36 deltas joined by .". */
const frequency = (postings) => (typeof postings === 'number' ? postings : postings.split('.').length);

/** Closest token to `token` among the keys of its shard ({ token: record count }), or null. */
export function closest(token, shard, max = 2) {
  let best = null;
  for (const [key, postings] of Object.entries(shard)) {
    if (key === token) continue;
    const d = distance(token, key, max);
    if (d > max) continue;
    const f = frequency(postings);
    if (!best || d < best.d || (d === best.d && f > best.f)) best = { key, d, f };
  }
  return best?.key || null;
}
