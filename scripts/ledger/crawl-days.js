import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../lib/json.js';

/**
 * The run report of a product file, when its source writes one:
 *   products.ndjson.gz          crawl-report.json
 *   products-site-<k>.ndjson.gz site-<k>-report.json
 */
function reportOf(file) {
  const name = path.basename(file);
  const dir = path.dirname(file);
  if (name === 'products.ndjson.gz') return path.join(dir, 'crawl-report.json');
  const site = /^products-site-(\d+)\.ndjson\.gz$/.exec(name);
  return site ? path.join(dir, `site-${site[1]}-report.json`) : null;
}

const utcDay = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * UTC day of each shop's crawl data: the report's finishedAt, else the file's modification time
 * (Discogs; tar keeps it through the data release). Shops that failed and only carry over
 * yesterday's records get null: their data is not a new crawl.
 * shopFiles: Map shopId -> Set of product files the shop's records came from.
 */
export function crawlDays(shopFiles) {
  const byFile = new Map();
  const fileInfo = (file) => {
    if (!byFile.has(file)) {
      const report = reportOf(file) && readJson(reportOf(file), null);
      const day = report?.finishedAt ? utcDay(report.finishedAt) : utcDay(fs.statSync(file).mtimeMs);
      byFile.set(file, { day, shops: report?.shops || {} });
    }
    return byFile.get(file);
  };
  const days = new Map();
  for (const [shop, set] of shopFiles) {
    let best = null;
    for (const file of set) {
      const { day, shops } = fileInfo(file);
      const r = shops[shop];
      if (r?.error && !r.count) continue;
      if (!best || day > best) best = day;
    }
    days.set(shop, best);
  }
  return days;
}
