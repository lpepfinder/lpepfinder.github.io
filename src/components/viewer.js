import { regionCurrency, localeRegion, convert } from '../lib/currency.js';
import table from '../../data/currencies.json' with { type: 'json' };

/**
 * What we know about the viewer, from the browser only: region from the browser language,
 * the "Prices in" currency (chosen, else from the region), daily rates (public/rates.json),
 * and the "Show covers" preference. Preferences live in localStorage, every access guarded.
 */
const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
export const region = tags.map(localeRegion).find(Boolean) || null;

/** Fired on window when the "Prices in" choice changes. */
export const CURRENCY_EVENT = 'vf-currency';
export const SHOP = 'shop';
const CURRENCY = 'vf.currency';
const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

/** The "Prices in" choice: a currency code, or "shop" for the shops' own prices. */
export function currencyChoice() {
  const saved = read(CURRENCY);
  if (saved === SHOP || table.choices.includes(saved)) return saved;
  const local = regionCurrency(region);
  return table.choices.includes(local) ? local : SHOP;
}
/** Currency to show prices in, or null for the shops' own prices. */
export const currency = () => (currencyChoice() === SHOP ? null : currencyChoice());
export function setCurrency(value) {
  write(CURRENCY, value);
  dispatchEvent(new Event(CURRENCY_EVENT));
}

let loading = null;
/** { date, rates } (rates per euro); rates {} when the file can't be read (prices then stay as they are). */
export const ratesFile = () => (loading ??= fetch('/rates.json').then((r) => (r.ok ? r.json() : null)).then((j) => ({ date: j?.date || null, rates: j?.rates || {} })).catch(() => ({ date: null, rates: {} })));
export const rates = () => ratesFile().then((f) => f.rates);

/** Price in the chosen currency (cents), or null (shop mode, same currency, no rate). */
export function toViewer(cents, from, rateTable) {
  const to = currency();
  return to && from && to !== from ? convert(cents, from, to, rateTable) : null;
}

/** Value to compare prices across currencies: euro cents when a rate is known, else the raw cents. */
export const comparable = (cents, from, rateTable) => (cents == null ? Infinity : convert(cents, from, 'EUR', rateTable) ?? cents);

const COVERS = 'vf.covers';
export function coversOn() {
  const v = read(COVERS);
  return v ? v === 'on' : !navigator.connection?.saveData;
}
export const setCovers = (on) => write(COVERS, on ? 'on' : 'off');
