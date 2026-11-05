/**
 * Approximate prices in the viewer's currency. Rates are per euro (ECB, public/rates.json);
 * regions map to currencies in data/currencies.json. Shared by the browser and the tests.
 */
import table from '../../data/currencies.json' with { type: 'json' };

const EURO = new Set(table.euro);

/** Currency of a region ("DE" → "EUR", "GB" → "GBP"), or null. */
export const regionCurrency = (region) => (!region ? null : EURO.has(region) ? 'EUR' : table.regions[region] || null);

/** Region of a BCP 47 language tag ("en-GB" → "GB", "ja" → "JP"), or null. */
export function localeRegion(tag) {
  try { return new Intl.Locale(tag).maximize().region || null; } catch { return null; }
}

/** cents in `from` as cents in `to`; null when a rate is missing. */
export function convert(cents, from, to, rates) {
  if (cents == null || !from || !to) return null;
  if (from === to) return cents;
  const a = rates?.[from], b = rates?.[to];
  return a && b ? Math.round((cents / a) * b) : null;
}
