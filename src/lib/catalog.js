import path from 'node:path';
import { loadShops, loadState } from '../../scripts/lib/shops.js';
import { readJson } from '../../scripts/lib/json.js';
import { GENERATED } from '../../scripts/lib/paths.js';
import { cleanShopName } from '../../scripts/lib/text.js';

const VISIBLE = new Set(['ok', 'listed']);
let cached;

/** Shops, countries and artists for the pages; built once per Astro build. */
export function catalog() {
  if (cached) return cached;
  const state = loadState();
  const data = readJson(path.join(GENERATED, 'site-data.json'), { totalRecords: 0, shopStats: {}, artists: [], builtAt: new Date().toISOString() });
  const shops = loadShops().filter((s) => !s.disabled).map((s) => {
    const st = state[s.id] || {};
    const stats = data.shopStats[s.id] || { records: 0, latest: [] };
    return {
      id: s.id,
      name: s.name || cleanShopName(st.name || '') || s.id,
      url: st.url || s.url,
      country: (st.country || s.country || '').toUpperCase() || null,
      city: s.city || st.city || null,
      status: st.status || 'unchecked',
      reason: st.reason || null,
      deadSince: st.deadSince || null,
      lastAliveAt: st.lastAliveAt || null,
      history: st.history || [],
      records: stats.records,
      lastmod: stats.lastmod || null,
      latest: stats.latest,
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
