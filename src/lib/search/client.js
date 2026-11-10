import { tokenize, normalize, shardKey, shardFile } from './tokenize.js';
import { pickWindow, diversify } from './rank.js';
import { closest } from './suggest.js';
import { findPlaces } from './places.js';
import { decodeShard, postingIds, decodeChunk, isGzip } from './codec.js';

/** Browser side of the static index built by src/index/search-index.js. */
export class SearchClient {
  constructor(base = '/search/') {
    this.base = base;
    this.cache = new Map();
    this.ready = Promise.all([this.json('meta.json'), this.json('shops.json')])
      .then(([meta, shops]) => {
        if (!meta || !shops) throw new Error('search index unavailable');
        this.meta = meta;
        this.shops = shops;
      });
    this.ready.catch(() => {});
  }

  json(file) {
    if (!this.cache.has(file)) {
      this.cache.set(file, fetch(this.base + file).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    }
    return this.cache.get(file);
  }

  /** A gzip-compressed index file (codec.js) as bytes, or null. */
  bin(file, decode) {
    if (!this.cache.has(file)) {
      this.cache.set(file, fetch(this.base + file)
        .then(async (r) => (r.ok ? decode(await gunzip(new Uint8Array(await r.arrayBuffer()))) : null))
        .catch(() => null));
    }
    return this.cache.get(file);
  }

  /** Decoded shard of a token: Map token -> entry (codec.js). */
  async shard(token) {
    return (await this.bin(`i/${shardFile(shardKey(token))}.bin`, decodeShard)) || new Map();
  }

  async postings(token, prefix) {
    const shard = await this.shard(token);
    const keys = prefix && token.length >= 3
      ? [...shard.keys()].filter((k) => k.startsWith(token)).slice(0, 64)
      : shard.has(token) ? [token] : [];
    if (!keys.length) return [];
    const lists = keys.map((k) => postingIds(shard.get(k)));
    return lists.length === 1 ? lists[0] : union(lists);
  }

  /** All matching doc ids, in rank order. */
  async match(query) {
    await this.ready;
    // words too common to be indexed ("records", "vinyl") don't narrow the search: skip them
    const common = new Set(this.meta.common || []);
    const tokens = tokenize(query).filter((t, _, all) => !common.has(t) || all.every((x) => common.has(x)));
    if (!tokens.length) return [];
    const lists = await Promise.all(tokens.map((t, i) => this.postings(t, i === tokens.length - 1)));
    return intersect(lists);
  }

  /**
   * Rank order for matched ids: the densest chunks (an artist's records are
   * neighbours) are loaded and diversified by shop; the rest follow in id order.
   * Sold-out records (ids from meta.soldOutFrom on) always come last.
   */
  async rank(ids, query, per = 30) {
    await this.ready;
    const isOut = (id) => id >= (this.meta.soldOutFrom ?? Infinity);
    const inStock = ids.filter((id) => !isOut(id));
    const window = pickWindow(inStock.length ? inStock : ids, this.meta.docsPerChunk, { min: per });
    const rows = await this.rows(window);
    const docs = window.map((id, i) => rows[i] && { id, shop: rows[i][0], title: rows[i][1], soldOut: isOut(id) }).filter(Boolean);
    const top = diversify(docs, normalize(query), normalize);
    const seen = new Set(top);
    const order = [...top, ...ids.filter((id) => !seen.has(id))];
    return [...order.filter((id) => !isOut(id)), ...order.filter(isOut)];
  }

  /** Shops and countries whose name matches the query (places.js); countryNames(code) -> [names]. */
  async places(query, countryNames) {
    return findPlaces(query, await this.json('places.json'), countryNames);
  }

  /**
   * For a query that found nothing: { spelling } with each unknown word replaced by the closest
   * known one of its shard, when that finds records; { without: { word, query, count } } for
   * the word whose removal finds the most. Uses only shard files already in the cache or one per word.
   */
  async suggest(query) {
    const tokens = tokenize(query);
    const out = {};
    const fixed = await Promise.all(tokens.map(async (t, i) => {
      if ((await this.postings(t, i === tokens.length - 1)).length) return t;
      const counts = Object.fromEntries([...(await this.shard(t))].map(([k, e]) => [k, e.count]));
      return closest(t, counts) || t;
    }));
    const spelling = fixed.join(' ');
    if (spelling !== tokens.join(' ') && (await this.match(spelling)).length) out.spelling = spelling;
    if (tokens.length > 1) {
      const tries = await Promise.all(tokens.map(async (word) => {
        const rest = tokens.filter((t) => t !== word).join(' ');
        return { word, query: rest, count: (await this.match(rest)).length };
      }));
      const best = tries.sort((a, b) => b.count - a.count)[0];
      if (best.count) out.without = best;
    }
    return out;
  }

  /** Raw d/ rows for ids (null when missing). */
  async rows(ids) {
    const per = this.meta.docsPerChunk;
    const chunks = [...new Set(ids.map((id) => Math.floor(id / per)))];
    const loaded = new Map(await Promise.all(chunks.map(async (c) => [c, await this.bin(`d/${c}.bin`, decodeChunk)])));
    return ids.map((id) => loaded.get(Math.floor(id / per))?.[id % per] || null);
  }

  /** How many matched ids are sold out (ids from meta.soldOutFrom on). */
  soldOut(ids) {
    const from = this.meta.soldOutFrom ?? Infinity;
    return ids.reduce((n, id) => n + (id >= from), 0);
  }

  /** Records for a slice of matched ids. */
  async records(ids) {
    const rows = await this.rows(ids);
    return rows.map((row) => {
      if (!row) return null;
      const [shopIdx, title, price, path, image, currency, soldOut, lastInStock, firstSeen, wasPrice, lowPrice90] = row;
      const [shopId, shopName, origin, country, shopCurrency, lastCrawl, shipsTo, imagePrefix] = this.shops[shopIdx];
      return {
        title, price, image: !image ? null : image.startsWith('~') ? imagePrefix + image.slice(1) : image,
        available: soldOut !== 1, lastInStock: lastInStock || null,
        url: path.startsWith('http') ? path : path.startsWith('~') ? `${origin}/products/${path.slice(1)}` : origin + path,
        currency: currency || shopCurrency,
        // from the offer ledger: firstSeen "YYYY-MM-DD"; wasPrice (cents) before a drop in the last 14 days;
        // lowPrice90 (cents) is the price itself when the row has no lower one but the ledger knows the offer
        firstSeen: firstSeen || null, wasPrice: wasPrice || null,
        lowPrice90: lowPrice90 || (firstSeen && price != null ? price : null),
        // lastCrawl: "YYYY-MM-DD" or null; shipsTo: ISO codes ("*" rest of world), [] when unknown
        shop: { id: shopId, name: shopName, country, lastCrawl: lastCrawl || null, shipsTo: shipsTo || [] },
      };
    }).filter(Boolean);
  }
}

/** Bytes of a gzip file; the host may already have decoded them (Content-Encoding). */
async function gunzip(bytes) {
  if (!isGzip(bytes)) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function union(lists) {
  const set = new Set();
  for (const l of lists) for (const id of l) set.add(id);
  return [...set].sort((a, b) => a - b);
}

function intersect(lists) {
  if (lists.some((l) => !l.length)) return [];
  const [first, ...rest] = [...lists].sort((a, b) => a.length - b.length);
  const sets = rest.map((l) => new Set(l));
  return first.filter((id) => sets.every((s) => s.has(id)));
}
