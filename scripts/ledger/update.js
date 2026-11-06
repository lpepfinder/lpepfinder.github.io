import fs from 'node:fs';
import path from 'node:path';
import { releaseKey } from '../../src/lib/search/release-key.js';
import { applyDay, emptyLedger } from './diff.js';
import { readLedger, readMeta, writeLedger } from './store.js';
import { offerKey, productUrl } from './keys.js';

export const LEDGER_FILE = 'ledger.ndjson.gz';
// the ledger as it was before the last day was applied: a second run on the same day starts from it
export const BASE_FILE = 'ledger-prev.ndjson.gz';

/**
 * Update the offer ledger in `dir` with today's catalog docs (display titles, see catalog.js).
 * crawlDays: the day of each shop's crawl data (crawl-days.js), for the new-shop guard.
 * Sets offerKey and releaseKey on each doc; a doc whose price the quality gate removed (priceFlag) clears the row's price. Running twice on one UTC day gives the same result:
 * the second run starts again from the ledger of the day before (BASE_FILE).
 */
export async function updateLedger({ docs, shops, day, dir, settings, crawlDays }) {
  const current = path.join(dir, LEDGER_FILE);
  const previous = path.join(dir, BASE_FILE);
  const meta = await readMeta(current);
  if (meta?.day > day) throw new Error(`ledger is at ${meta.day}, later than ${day}`);
  const rerun = meta?.day === day;
  if (meta && !rerun) fs.copyFileSync(current, previous);
  const ledger = (meta ? await readLedger(previous) : null) || emptyLedger();
  if (rerun) console.log('ledger: second run on', day, 'starts again from', ledger.meta.day || 'an empty ledger');

  const offers = docs.map((d) => {
    d.offerKey = offerKey(d.shop, d.path);
    d.releaseKey = releaseKey(d.title);
    return {
      offerKey: d.offerKey, releaseKey: d.releaseKey, shop: d.shop, path: d.path, title: d.title,
      price: d.price, currency: d.currency || shops.get(d.shop)?.state.currency || null, available: d.available !== false,
      ...(d.priceFlag && { priceFlag: d.priceFlag }),
    };
  });
  const events = applyDay(ledger, offers, day, { settings, crawlDays, urlOf: (id, p) => productUrl(shops.get(id), p) });
  await writeLedger(current, ledger);
  return { ledger, events };
}
