/**
 * Same record, same key, across shops: "Miles Davis – Kind Of Blue (LP, 180g)" and
 * "MILES DAVIS - KIND OF BLUE" both become one 12-hex key. Shared by the indexer
 * (Node) and the browser (watchlist), like tokenize.js.
 * Rules live in data/release-key.json.
 */
import rules from '../../../data/release-key.json' with { type: 'json' };

const DROP = new Set(rules.dropWords);
const SIZE = /\b(?:7|10|12)\s?(?:"|”|''|inch|in\b)/g;

/** Words that identify the record, in order, without formats, conditions and colours. */
export function releaseWords(title) {
  let t = String(title || '').toLowerCase();
  if (rules.dropBrackets) t = t.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ');
  t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/\b\d{3,}\s?g(ram)?s?\b/g, ' ')
    .replace(SIZE, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  return t.split(' ').filter((w) => w && !DROP.has(w));
}

/** FNV-1a, 48 bits, as 12 hex characters. */
export function hash48(s) {
  let h = 0xcbf29ce484222325n;
  for (const c of new TextEncoder().encode(s)) h = BigInt.asUintN(64, (h ^ BigInt(c)) * 0x100000001b3n);
  return (h & 0xffffffffffffn).toString(16).padStart(12, '0');
}

/** Release key of a title, or null when too little is left to be meaningful. */
export function releaseKey(title) {
  const words = releaseWords(title);
  return words.length >= 2 ? hash48(words.join(' ')) : null;
}
