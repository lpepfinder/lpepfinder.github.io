import fs from 'node:fs';
import path from 'node:path';
import { SHOPS_DIR } from '../lib/paths.js';
import { hostOf } from '../lib/shops.js';
import { writeJson } from '../lib/json.js';
import { countryCode } from '../lib/country.js';
import { checkShop } from '../check/shop.js';
import { parseIssueForm, countryFrom } from './parse.js';

/**
 * Handle a shop suggestion from the "Add a record shop" issue form, without a human:
 * check the site like the daily check does, add data/shops/<host>.json when it is a live
 * record shop, and write the reply for the issue to generated/submission-reply.md.
 * Exit code 0 = added, 2 = refused (reply explains why).
 */
const fields = parseIssueForm(process.env.ISSUE_BODY);
const reply = (text, code) => {
  fs.mkdirSync('generated', { recursive: true });
  fs.writeFileSync('generated/submission-reply.md', text + '\n');
  console.log(text);
  process.exit(code);
};

let url;
try { url = new URL(/^https?:\/\//.test(fields.Website) ? fields.Website : `https://${fields.Website}`).origin; } catch { reply('The website address could not be read. Please edit the issue with the full address, like https://example-records.com.', 2); }
const id = hostOf(url);
if (/facebook|instagram|linktr|bandcamp\.com$|discogs\.com|ebay\.|etsy\.com/.test(id)) reply(`${id} is not a shop's own website. We list independent shops with their own online store.`, 2);
const file = path.join(SHOPS_DIR, `${id}.json`);
if (fs.existsSync(file)) reply(`${id} is already listed: https://lpepfinder.com/shop/${id}/`, 2);

const state = await checkShop({ id, url });
if (!['ok', 'listed'].includes(state.status)) {
  reply(`We could not add ${id} automatically (check result: ${state.status}${state.reason ? `, ${state.reason}` : ''}). If this is a mistake, reply here and a maintainer will look.`, 2);
}
const finalId = hostOf(state.url || url);
const country = countryFrom(fields.Country, (v) => (v.length === 2 ? (countryCode(v) ? v : null) : countryCode(v))) || state.country || undefined;
writeJson(path.join(SHOPS_DIR, `${finalId}.json`), {
  url: state.url || url,
  name: fields['Shop name'] || undefined,
  country,
  city: fields.City || undefined,
  source: 'submission',
}, true);
const how = state.status === 'ok' ? `its ${state.platform} catalog will be searchable after the next daily update` : 'it is listed with a link; its catalog is read when we can';
reply(`Thanks! ${fields['Shop name'] || finalId} is added: ${how}. Page: https://lpepfinder.com/shop/${finalId}/`, 0);
