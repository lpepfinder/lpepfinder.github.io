import fs from 'node:fs';
import path from 'node:path';
import { DATA, PUBLIC } from '../lib/paths.js';
import { config } from '../lib/config.js';
import { get } from '../lib/http.js';
import { readJson, writeJson } from '../lib/json.js';
import { parseEcb } from './parse.js';

/**
 * Daily currency rates for the "≈ €24" hints: ECB reference rates (1 EUR = rate) into
 * data/rates.json (kept in the repo, CMS-editable, used as is when the ECB can't be reached),
 * then copied to public/rates.json for the browser.
 */
const file = path.join(DATA, 'rates.json');
const previous = readJson(file, null);
const res = await get(config.rates.url, { accept: 'application/xml', retries: 1 });
const fresh = res.ok ? parseEcb(await res.text()) : null;
if (fresh) {
  writeJson(file, { description: previous?.description || '', base: 'EUR', date: fresh.date, rates: { EUR: 1, ...fresh.rates } }, true);
  console.log('rates', fresh.date, Object.keys(fresh.rates).length, 'currencies');
} else {
  console.warn('rates: ECB unreachable, keeping', previous?.date || 'no file');
}
if (fs.existsSync(file)) {
  const { base, date, rates } = readJson(file);
  writeJson(path.join(PUBLIC, 'rates.json'), { base, date, rates });
}
