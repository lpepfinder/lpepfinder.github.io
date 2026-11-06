/**
 * Orders for lists people scan by name: A–Z in the page's language, ignoring leading
 * articles ("The Beatles" under B) and punctuation, with a letter for jump bars.
 */
const ARTICLES = /^(the|a|an|les|le|la|l'|los|las|el|die|der|das|il|lo|gli|de|het)\s+/i;
const collators = new Map();
const collator = (lang) => {
  if (!collators.has(lang)) collators.set(lang, new Intl.Collator(lang, { sensitivity: 'base', numeric: true, ignorePunctuation: true }));
  return collators.get(lang);
};

/** The part of a name to sort on. */
export const sortKey = (name) => String(name || '').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(ARTICLES, '');

/** Compare two names for an A–Z list in `lang`. */
export const byName = (lang, pick = (x) => x) => (a, b) => collator(lang).compare(sortKey(pick(a)), sortKey(pick(b)));

/** "A"…"Z" for Latin letters (accents folded), "#" for digits and other scripts. */
export function letterOf(name) {
  const c = sortKey(name).normalize('NFKD').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/** Group items by `key`, groups ordered by `order`, items inside by `inside`. */
export function groupBy(items, key, order, inside) {
  const groups = new Map();
  for (const item of items) {
    const k = key(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  return [...groups].sort(([a], [b]) => order(a, b)).map(([k, list]) => [k, list.sort(inside)]);
}
