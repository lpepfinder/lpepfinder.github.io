/** UI strings rendered by the page builder into <script type="application/json" data-i18n>. */
const el = document.querySelector('script[data-i18n]');
const strings = el ? JSON.parse(el.textContent) : {};

export const lang = document.documentElement.lang || 'en';

export function t(key, vars = {}) {
  const s = strings[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export const formatNumber = (n) => new Intl.NumberFormat(lang).format(n);

/** "YYYY-MM-DD" (a UTC day) as a short local date. */
export const formatDay = (day) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

const regions = new Intl.DisplayNames([lang], { type: 'region' });
export const countryName = (cc) => { try { return regions.of(cc); } catch { return cc; } };

export function formatPrice(cents, currency) {
  if (cents == null) return '';
  if (!currency) return (cents / 100).toFixed(2);
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(cents / 100); } catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

/** Plural strings are objects of Intl.PluralRules categories ({ one, other }); {count} is formatted. */
const plurals = new Intl.PluralRules(lang);
export function tn(key, count, vars = {}) {
  const form = `${key}.${plurals.select(count)}`;
  return t(form in strings ? form : `${key}.other`, { ...vars, count: formatNumber(count) });
}
