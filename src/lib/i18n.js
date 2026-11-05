import config from '../../data/config.json' with { type: 'json' };
import en from '../../data/i18n/en.json' with { type: 'json' };
import fr from '../../data/i18n/fr.json' with { type: 'json' };
import de from '../../data/i18n/de.json' with { type: 'json' };
import es from '../../data/i18n/es.json' with { type: 'json' };
import it from '../../data/i18n/it.json' with { type: 'json' };
import ja from '../../data/i18n/ja.json' with { type: 'json' };
import { FORMAT_IDS } from './search/format.js';

const dict = { en, fr, de, es, it, ja };
export const languages = config.languages;
export const defaultLanguage = config.defaultLanguage;

const lookup = (lang, key) => key.split('.').reduce((o, k) => o?.[k], dict[lang]);

/** Translate a key; strings get {var} replacement, arrays are returned as-is. */
export function t(lang, key, vars = {}) {
  const value = lookup(lang, key) ?? lookup(defaultLanguage, key) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : value;
}

/** getStaticPaths entries for [...locale] routes: default language at the root. */
export const localeParams = () => languages.map((lang) => ({ params: { locale: lang === defaultLanguage ? undefined : lang }, props: { lang } }));

export const localPath = (lang, path) => (lang === defaultLanguage ? path : `/${lang}${path}`);

/** Strings the browser components need. */
export const clientStrings = (lang) => Object.fromEntries([
  'searchTitle', 'resultsCount', 'searching', 'showingOf', 'emptyTitle', 'indexError', 'resultShop', 'resultCountry',
  'resultFormat', 'conditionUsed', ...FORMAT_IDS.map((id) => `formats.${id}`),
].map((k) => [k, lookup(lang, k) ?? lookup(defaultLanguage, k)]));

const regionNames = Object.fromEntries(languages.map((l) => [l, new Intl.DisplayNames([l], { type: 'region' })]));
export const countryName = (lang, code) => { try { return regionNames[lang].of(code); } catch { return code; } };
export const number = (lang, n) => new Intl.NumberFormat(lang).format(n);
export const date = (lang, iso) => new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(iso));
export function price(lang, cents, currency) {
  if (cents == null) return '';
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency || 'EUR' }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
