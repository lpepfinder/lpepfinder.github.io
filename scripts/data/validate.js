import fs from 'node:fs';
import path from 'node:path';
import { SHOPS_DIR, I18N_DIR } from '../lib/paths.js';
import { config } from '../lib/config.js';

/** Validate the curated data against data/schemas (dependency-free subset of JSON Schema). */
const schema = JSON.parse(fs.readFileSync(path.join(SHOPS_DIR, '../schemas/shop.schema.json'), 'utf8'));
const errors = [];
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
// real, current ISO 3166-1 codes only (FX, YU... are not)
const isCountry = (c) => !['FX', 'YU', 'CS', 'SU', 'ZZ', 'EU'].includes(c) && regions.of(c) !== c;

function check(obj, sch, where) {
  for (const key of sch.required || []) if (obj[key] == null) errors.push(`${where}: missing "${key}"`);
  for (const [key, value] of Object.entries(obj)) {
    const prop = sch.properties?.[key];
    if (!prop) { if (sch.additionalProperties === false) errors.push(`${where}: unknown field "${key}"`); continue; }
    if (prop.type === 'string' && typeof value !== 'string') errors.push(`${where}: "${key}" must be a string`);
    if (prop.type === 'boolean' && typeof value !== 'boolean') errors.push(`${where}: "${key}" must be true/false`);
    if (prop.pattern && typeof value === 'string' && !new RegExp(prop.pattern).test(value)) errors.push(`${where}: "${key}" does not match ${prop.pattern}`);
    if (prop.enum && !prop.enum.includes(value)) errors.push(`${where}: "${key}" must be one of ${prop.enum.join(', ')}`);
  }
}

const files = fs.readdirSync(SHOPS_DIR).filter((f) => f.endsWith('.json'));
for (const f of files) {
  let shop;
  try { shop = JSON.parse(fs.readFileSync(path.join(SHOPS_DIR, f), 'utf8')); } catch (e) { errors.push(`${f}: invalid JSON`); continue; }
  check(shop, schema, f);
  if (shop.country && !isCountry(shop.country)) errors.push(`${f}: "${shop.country}" is not a country code`);
  try {
    const host = new URL(shop.url).hostname.replace(/^www\./, '');
    if (host !== f.slice(0, -5)) errors.push(`${f}: file name must be the url host "${host}.json"`);
  } catch { /* reported by pattern */ }
}

const en = JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${config.defaultLanguage}.json`), 'utf8'));
for (const lang of config.languages) {
  const strings = JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8'));
  for (const key of Object.keys(en)) if (!(key in strings)) errors.push(`i18n/${lang}.json: missing "${key}"`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`${errors.length} data errors`);
  process.exit(1);
}
console.log(`data ok: ${files.length} shops, ${config.languages.length} languages`);
