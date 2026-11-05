import { tokenize, shardKey, shardFile } from './tokenize.js';

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

  async postings(token, prefix) {
    const shard = (await this.json(`i/${shardFile(shardKey(token))}.json`)) || {};
    const keys = prefix && token.length >= 3
      ? Object.keys(shard).filter((k) => k.startsWith(token)).slice(0, 64)
      : shard[token] ? [token] : [];
    if (!keys.length) return [];
    const lists = keys.map((k) => decode(shard[k]));
    return lists.length === 1 ? lists[0] : union(lists);
  }

  /** All matching doc ids, in rank order. */
  async match(query) {
    await this.ready;
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const lists = await Promise.all(tokens.map((t, i) => this.postings(t, i === tokens.length - 1)));
    return intersect(lists);
  }

  /** Records for a slice of matched ids. */
  async records(ids) {
    const per = this.meta.docsPerChunk;
    const chunks = [...new Set(ids.map((id) => Math.floor(id / per)))];
    const loaded = new Map(await Promise.all(chunks.map(async (c) => [c, await this.json(`d/${c}.json`)])));
    return ids.map((id) => {
      const row = loaded.get(Math.floor(id / per))?.[id % per];
      if (!row) return null;
      const [shopIdx, title, price, path, image, currency] = row;
      const [shopId, shopName, origin, country, shopCurrency] = this.shops[shopIdx];
      return {
        title, price, image: image || null,
        url: path.startsWith('http') ? path : origin + path,
        currency: currency || shopCurrency,
        shop: { id: shopId, name: shopName, country },
      };
    }).filter(Boolean);
  }
}

const decode = (s) => {
  let prev = 0;
  return s.split('.').map((d) => (prev += parseInt(d, 36)));
};

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
