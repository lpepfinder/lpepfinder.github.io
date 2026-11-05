import { regionCurrency, localeRegion, convert } from '../lib/currency.js';

/**
 * What we know about the viewer, from the browser only: region and currency from the
 * browser language, daily rates (public/rates.json), and the "Show covers" preference.
 */
const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
export const region = tags.map(localeRegion).find(Boolean) || null;
export const currency = regionCurrency(region);

let loading = null;
/** Rates per euro; {} when the file can't be read (approximate prices then stay hidden). */
export const rates = () => (loading ??= fetch('/rates.json').then((r) => (r.ok ? r.json() : null)).then((j) => j?.rates || {}).catch(() => ({})));

/** Price in the viewer's currency (cents), or null (no rate, unknown currency). */
export const toViewer = (cents, from, table) => (currency ? convert(cents, from, currency, table) : null);

/** Value to compare prices across currencies: euro cents when a rate is known, else the raw cents. */
export const comparable = (cents, from, table) => (cents == null ? Infinity : convert(cents, from, 'EUR', table) ?? cents);

const COVERS = 'vf.covers';
export function coversOn() {
  try {
    const v = localStorage.getItem(COVERS);
    if (v) return v === 'on';
  } catch {}
  return !navigator.connection?.saveData;
}
export function setCovers(on) {
  try { localStorage.setItem(COVERS, on ? 'on' : 'off'); } catch {}
}
