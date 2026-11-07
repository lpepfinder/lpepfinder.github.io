/**
 * The machine-readable side of the site (/api/*.json): the same data the pages show, as JSON, for robots and
 * AI agents (docs/agents.md). Shapes are kept small and stable; fields may be added, never renamed.
 */
import config from '../../data/config.json' with { type: 'json' };
import { catalog } from './catalog.js';

export const API_VERSION = 1;
export const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8' } });
export const abs = (site, path) => new URL(path, site).href;

/**
 * A record as the API gives it: title, price in cents with its currency, whether it's in stock, the shop (id, name,
 * country, page) and the link to buy. The artist page's list reads the same file (vf-release-list.js).
 */
export const apiRecord = (site, r) => {
  const shop = catalog().shopsById.get(r.shop);
  return {
    title: r.title, priceCents: r.price ?? null, currency: r.currency || null, available: r.available !== false,
    shop: r.shop, shopName: shop?.name || r.shop, country: shop?.country || null,
    shopPage: abs(site, `/shop/${r.shop}/`), url: r.url, image: r.image ? (r.image.startsWith('//') ? `https:${r.image}` : r.image) : null,
  };
};

export function apiShop(site, s) {
  return {
    id: s.id, name: s.name, url: s.url, country: s.country, city: s.city, records: s.records, searchable: s.records > 0,
    bluesky: s.bluesky ? { handle: s.bluesky.handle, verified: !!s.bluesky.verified } : null,
    page: abs(site, `/shop/${s.id}/`),
  };
}

export const apiMeta = () => {
  const c = catalog();
  return { name: config.name, version: API_VERSION, builtAt: c.builtAt, records: c.totalRecords, shops: c.visible.length, countries: c.countries.length };
};
