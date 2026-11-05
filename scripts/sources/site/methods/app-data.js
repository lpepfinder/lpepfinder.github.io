import { appState, productsFromState } from '../extract/app-state.js';
import * as generic from './generic.js';

/**
 * Nuxt / Next shops (oye-records.com): listing pages carry their records in the page's own
 * __NUXT_DATA__ / __NEXT_DATA__ state, so one listing page yields dozens of records.
 * Crawled like any site; the probe only checks that the home page publishes such state.
 */
export const name = 'app-data';
export const applies = () => true;

export async function probe(ctx) {
  const res = await ctx.get(`${ctx.origin}/`);
  if (!res?.ok) return null;
  const state = appState(res.text);
  return state && productsFromState(state).length ? { kind: state.kind } : null;
}

export const crawl = generic.crawl;
