import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../lib/json.js';
import { PUBLIC, files } from '../lib/paths.js';

/** Apparent size of a directory in MB (what GitHub Pages counts), null when it doesn't exist. */
export function sizeMB(dir) {
  if (!fs.existsSync(dir)) return null;
  let bytes = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else bytes += fs.statSync(p).size;
    }
  };
  walk(dir);
  return Math.round(bytes / 2 ** 20);
}

/** Crawled shops and those that failed, from generated/crawl-report.json (null without one). */
export function crawlNumbers(report) {
  if (!report?.shops) return null;
  const shops = Object.values(report.shops);
  return { shops: shops.length, errors: shops.filter((s) => s.error).length, finishedAt: report.finishedAt || null };
}

/**
 * Today's numbers: records (in stock first, then sold out) and searchable shops from the search index meta,
 * the built site's size, the crawl report, and the end-to-end tests' outcome (a GitHub step outcome).
 */
export function collect({ dist = 'dist', e2e = null } = {}) {
  const meta = readJson(path.join(PUBLIC, 'search', 'meta.json'), null);
  return {
    records: meta?.docs ?? null,
    inStock: meta?.soldOutFrom ?? null,
    shops: meta?.shops ?? null,
    siteMB: sizeMB(dist),
    crawl: crawlNumbers(readJson(files.crawlReport, null)),
    e2e: e2e || null,
  };
}
