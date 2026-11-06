import { artistOf, slugify } from '../lib/text.js';

const productUrl = (shop, d) => (d.path.startsWith('http') ? d.path : new URL(shop.state.url || shop.url).origin + d.path);
const record = (shop, d) => ({
  title: d.title, price: d.price, currency: d.currency || shop.state.currency || null,
  shop: shop.id, url: productUrl(shop, d), image: d.image || null, updated: d.updated || null,
});

/** Newest product update among records, for the sitemap <lastmod> (null when shops don't say). */
const lastmod = (records) => records.reduce((max, r) => (r.updated && r.updated > (max || '') ? r.updated : max), null);

const inStock = (d) => d.available !== false;

/**
 * Aggregates for static SEO pages: per-shop stats and artist pages comparing
 * shops. Records in stock only: sold-out ones are searchable but not listed here.
 */
export function buildSiteData({ docs, shops, byShop, seo }) {
  const artists = new Map();
  for (const d of docs) {
    if (!inStock(d)) continue;
    const name = artistOf(d.title, d.vendor);
    const slug = name && slugify(name);
    if (!slug || slug.length < 2) continue;
    let a = artists.get(slug);
    if (!a) artists.set(slug, (a = { slug, names: new Map(), records: [], shops: new Set() }));
    a.names.set(name, (a.names.get(name) || 0) + 1);
    a.shops.add(d.shop);
    if (a.records.length < seo.artistMaxRecordsPerPage * 3) a.records.push(record(shops.get(d.shop), d));
  }
  const artistPages = [...artists.values()]
    .filter((a) => a.records.length >= seo.artistMinRecords && a.shops.size >= seo.artistMinShops)
    .sort((a, b) => b.shops.size - a.shops.size || b.records.length - a.records.length)
    .slice(0, seo.artistMaxPages)
    .map((a) => {
      const records = a.records
        .sort((x, y) => (x.price ?? Infinity) - (y.price ?? Infinity))
        .slice(0, seo.artistMaxRecordsPerPage);
      return {
        slug: a.slug,
        name: [...a.names.entries()].sort((x, y) => y[1] - x[1])[0][0],
        // shops among the records shown, so "120 records at N shops" never has N > shown
        shopCount: new Set(records.map((r) => r.shop)).size,
        lastmod: lastmod(records),
        records,
      };
    });

  const shopStats = {};
  for (const [id, all] of byShop) {
    const shop = shops.get(id);
    const list = all.filter(inStock);
    shopStats[id] = { records: list.length, lastmod: lastmod(list), latest: list.slice(0, seo.shopLatestRecords).map((d) => record(shop, d)) };
  }
  return { builtAt: new Date().toISOString(), totalRecords: docs.filter(inStock).length, shopStats, artists: artistPages };
}

/**
 * search/artists.json for "top hits" in search: [[slug, name, recordCount], ...], artist page order
 * (most shops first), the first `max` (search.maxArtists: 4,000 keep it under 60 KB gzipped).
 * recordCount is the artist page's: records shown there.
 */
export const artistList = (artists, max) => artists.slice(0, max).map((a) => [a.slug, a.name, a.records.length]);
