import { site } from '../settings.js';
import * as squarespace from './squarespace-json.js';
import * as bigcartel from './bigcartel.js';
import * as squareOnline from './square-online.js';
import * as magento from './magento-graphql.js';
import * as appData from './app-data.js';
import * as sitemap from './sitemap.js';
import * as generic from './generic.js';

/** Readers, platform-specific fast paths first; the generic crawler always applies. */
export const methods = [squarespace, bigcartel, squareOnline, magento, appData, sitemap, generic];
const byName = Object.fromEntries(methods.map((m) => [m.name, m]));

const DAY = 864e5;

/** The reader for this shop: forced by its shop file, remembered from a recent probe, or probed now. */
export async function chooseMethod(ctx) {
  const { st, settings } = ctx;
  const fresh = st.method && st.probedAt && Date.now() - Date.parse(st.probedAt) < site.reprobeDays * DAY;
  if (settings.method && settings.method !== st.method) return use(st, settings.method, {}, ctx);
  if (settings.method || fresh) return byName[st.method];
  for (const m of methods) {
    if (!m.applies(ctx)) continue;
    const info = await m.probe(ctx);
    if (!ctx.canFetch()) return null;
    if (info) return use(st, m.name, info, ctx);
  }
  return null;
}

function use(st, name, info, ctx) {
  if (st.method !== name) {
    // API passes and page crawls keep different bookkeeping: start a fresh pass
    st.open = false;
    st.cursor = null;
    st.doneOn = null;
  }
  Object.assign(st, { method: name, info, probedAt: ctx.now });
  return byName[name];
}
