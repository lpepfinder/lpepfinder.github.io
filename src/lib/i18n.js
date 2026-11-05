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

/** Dotted keys of a string group ("watch" → "watch.watch", "watch.notify", …). */
const groupKeys = (group, o = lookup(defaultLanguage, group)) => Object.entries(o || {})
  .flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? groupKeys(`${group}.${k}`, v) : [`${group}.${k}`]));

/** Strings the browser components need; `groups` adds whole groups for one page (e.g. "watchPage"). */
export const clientStrings = (lang, groups = []) => Object.fromEntries([
  'searchTitle', 'searching', 'showingOf', 'emptyTitle', 'indexError',
  'conditionUsed', 'soldOut', 'lastInStock', ...FORMAT_IDS.map((id) => `formats.${id}`),
  ...['watch', 'results', ...groups].flatMap((g) => groupKeys(g)),
].map((k) => [k, lookup(lang, k) ?? lookup(defaultLanguage, k)]));

const pluralRules = Object.fromEntries(languages.map((l) => [l, new Intl.PluralRules(l)]));
/**
 * A count sentence: plural strings are objects of Intl.PluralRules categories ({ one, other }),
 * chosen by `count`; {count} is the formatted number unless `vars` sets it.
 */
export function tn(lang, key, count, vars = {}) {
  const value = lookup(lang, key) ?? lookup(defaultLanguage, key);
  const form = value && typeof value === 'object' ? value[pluralRules[lang].select(count)] ?? value.other : value;
  const all = { count: number(lang, count), ...vars };
  return String(form ?? key).replace(/\{(\w+)\}/g, (_, k) => all[k] ?? '');
}

const regionNames = Object.fromEntries(languages.map((l) => [l, new Intl.DisplayNames([l], { type: 'region' })]));
export const countryName = (lang, code) => { try { return regionNames[lang].of(code); } catch { return code; } };
export const number = (lang, n) => new Intl.NumberFormat(lang).format(n);
export const date = (lang, iso) => new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(iso));
/** A "YYYY-MM-DD" UTC day, short. */
export const day = (lang, d) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
export function price(lang, cents, currency) {
  if (cents == null) return '';
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency || 'EUR' }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
