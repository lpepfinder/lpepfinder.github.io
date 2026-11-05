import path from 'node:path';
import config from '../../data/config.json' with { type: 'json' };
import { readJson } from '../../scripts/lib/json.js';
import { GENERATED } from '../../scripts/lib/paths.js';

const EMPTY = { day: null, days: config.newArrivals.days, total: 0, shops: 0, items: [], all: { count: 0, items: [] }, countries: {}, formats: {}, byShop: {} };
const NONE = { count: 0, items: [] };
let cached;

/** New arrivals built by scripts/ledger/new-arrivals.js; built once per Astro build. */
export function newArrivals() {
  if (cached) return cached;
  const data = { ...EMPTY, ...readJson(path.join(GENERATED, 'new-arrivals.json'), {}) };
  /** { count, records } of one scope, at most `limit` records. */
  const pick = (s = NONE, limit = Infinity) => ({ count: s.count, records: s.items.slice(0, limit).map((i) => data.items[i]) });
  cached = {
    ...data,
    all: (limit) => pick(data.all, limit),
    country: (cc, limit) => pick(data.countries[cc], limit),
    format: (f, limit) => pick(data.formats[f], limit),
    shop: (id, limit) => pick(data.byShop[id], limit),
    // scopes with records, largest first
    countryCodes: Object.keys(data.countries).sort((a, b) => data.countries[b].count - data.countries[a].count),
    formatIds: Object.keys(data.formats),
  };
  return cached;
}
