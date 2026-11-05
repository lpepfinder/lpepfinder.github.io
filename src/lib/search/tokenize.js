/**
 * Shared by the index builder (Node) and the search component (browser):
 * both sides must split text into the same tokens.
 */
export const STOPWORDS = new Set([
  'the', 'and', 'of', 'a', 'an', 'in', 'on', 'to', 'for', 'by', 'with',
  'lp', 'vinyl', 'new', 'used', 'sealed',
  'le', 'la', 'les', 'de', 'des', 'du', 'et', 'der', 'die', 'das', 'und', 'el', 'los', 'il', 'di',
]);

export const normalize = (s) => String(s || '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[’'`]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/**
 * Unique tokens of 2+ characters, stopwords removed. Catalog numbers written
 * with a space or dash ("UR-001", "AX 001") also give the joined form ("ur001").
 */
export function tokenize(s) {
  const out = new Set();
  const words = normalize(s).split(' ');
  words.forEach((t, i) => {
    if (t.length >= 2 && !STOPWORDS.has(t)) out.add(t);
    const next = words[i + 1];
    if (next && /^\p{L}{1,6}$/u.test(t) && /^\d{1,6}$/.test(next)) out.add(t + next);
    if (/^\p{L}{1,6}\d{1,6}$/u.test(t)) out.add(t);
  });
  return [...out];
}

/** Index shard for a token: its first three characters. */
export const shardKey = (token) => token.slice(0, 3);

/** File-system and URL safe shard file name. */
export const shardFile = (key) => [...key].map((c) => (/[a-z0-9]/.test(c) ? c : '_' + c.codePointAt(0).toString(36))).join('');
