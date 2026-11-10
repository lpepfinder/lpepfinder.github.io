import path from 'node:path';
import { loadShops, loadState } from '../../scripts/lib/shops.js';
import { readJson } from '../../scripts/lib/json.js';
import { GENERATED } from '../../scripts/lib/paths.js';
import { cleanShopName } from '../../scripts/lib/text.js';
import { cityOf, citySlug } from './cities.js';
import config from '../../data/config.json' with { type: 'json' };

const VISIBLE = new Set(['ok', 'listed']);
let cached;

/**
 * Shops, countries and artists for the pages; built once per Astro build. A country's `cities`, most shops
 * first: { name, slug, shops, records }, those with a page (seo.cityMinShops shops and a slug) in `pages`.
 */
export function catalog() {
  if (cached) return cached;
  const state = loadState();
  const data = readJson(path.join(GENERATED, 'site-data.json'), { totalRecords: 0, shopStats: {}, artists: [], builtAt: new Date().toISOString() });
  const shops = loadShops().filter((s) => !s.disabled).map((s) => {
    const st = state[s.id] || {};
    const stats = data.shopStats[s.id] || { records: 0, latest: [] };
    const country = (st.country || s.country || '').toUpperCase() || null;
    return {
      id: s.id,
      name: s.name || cleanShopName(st.name || '') || s.id,
      url: st.url || s.url,
      country,
      city: cityOf(country, s.city || st.city),
      status: st.status || 'unchecked',
      reason: st.reason || null,
      deadSince: st.deadSince || null,
      lastAliveAt: st.lastAliveAt || null,
      history: st.history || [],
      records: stats.records,
      lastmod: stats.lastmod || null,
      latest: stats.latest,
      // { handle, did, verified } from the daily check, else as set in data/shops (scripts/check/bluesky.js)
      bluesky: st.bluesky || s.bluesky || null,
    };
  });
  const unchecked = !Object.keys(state).length;
  const visible = shops.filter((s) => VISIBLE.has(s.status) || unchecked)
    .sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
  const countries = new Map();
  for (const s of visible) {
    if (!s.country) continue;
    const c = countries.get(s.country) || { code: s.country, shops: [], records: 0 };
    c.shops.push(s);
    c.records += s.records;
    countries.set(s.country, c);
  }
  for (const c of countries.values()) {
    const cities = new Map();
    for (const s of c.shops) {
      if (!s.city) continue;
      const city = cities.get(s.city) || { name: s.city, slug: citySlug(s.city), shops: [], records: 0 };
      city.shops.push(s);
      city.records += s.records;
      cities.set(s.city, city);
    }
    c.cities = [...cities.values()].sort((a, b) => b.shops.length - a.shops.length || a.name.localeCompare(b.name));
    c.pages = c.cities.filter((x) => x.slug && x.shops.length >= config.seo.cityMinShops);
  }
  cached = {
    shops, visible,
    shopsById: new Map(shops.map((s) => [s.id, s])),
    statusCounts: shops.reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {}),
    countries: [...countries.values()].sort((a, b) => b.shops.length - a.shops.length),
    artists: data.artists,
    totalRecords: data.totalRecords,
    builtAt: data.builtAt,
  };
  return cached;
}
