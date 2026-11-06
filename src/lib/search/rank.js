/**
 * Ranking on the client. Doc ids are in title order (artist first), so the
 * records of one artist sit in a few neighbouring chunks.
 */

/** Ids from the chunks with the most matches: at least `min` ids, then up to maxIds or maxChunks. */
export function pickWindow(ids, docsPerChunk, { min = 30, maxIds = 200, maxChunks = 4 } = {}) {
  const byChunk = new Map();
  for (const id of ids) {
    const c = Math.floor(id / docsPerChunk);
    if (!byChunk.has(c)) byChunk.set(c, []);
    byChunk.get(c).push(id);
  }
  const chunks = [...byChunk.values()].sort((a, b) => b.length - a.length);
  const window = [];
  for (const [i, list] of chunks.entries()) {
    if (window.length >= maxIds || (i >= maxChunks && window.length >= min)) break;
    window.push(...list);
  }
  return window.sort((a, b) => a - b);
}

/**
 * Order loaded docs, best match first: in stock before sold out; inside each, titles
 * that start with the query, then titles containing the exact phrase, then the
 * rest (all words, any order). Inside each tier shops take turns, so no single
 * shop floods the top. docs: [{ id, shop, title, soldOut }] in id order; phrase: normalized query.
 */
export function diversify(docs, phrase, normalize) {
  const groups = [[], [], [], [], [], []];
  for (const d of docs) {
    const t = normalize(d.title);
    const match = !phrase ? 2 : t.startsWith(phrase) ? 0 : t.includes(phrase) ? 1 : 2;
    groups[(d.soldOut ? 3 : 0) + match].push(d);
  }
  return groups.flatMap(roundRobin).map((d) => d.id);
}

function roundRobin(docs) {
  const queues = new Map();
  for (const d of docs) {
    if (!queues.has(d.shop)) queues.set(d.shop, []);
    queues.get(d.shop).push(d);
  }
  const lists = [...queues.values()];
  const out = [];
  for (let i = 0; out.length < docs.length; i++) for (const q of lists) if (i < q.length) out.push(q[i]);
  return out;
}
