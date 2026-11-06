/**
 * Catalog numbers ("KDJ-38", "WARP LP 123", "UR 001"): the most reliable way to match a
 * Discogs want to a shop listing, whose title rarely matches word for word.
 * Shared by the builder (catalog-number index, scripts/ledger/watch-files.js) and the browser.
 */
import { releaseWords, hash48 } from '../search/release-key.js';

/** Letters then digits, optionally one trailing letter: "kdj38", "warplp123", "ur001b". */
const SHAPE = /^\p{L}{2,8}\d{2,6}\p{L}?$/u;
/** Letter parts that are formats or counters, not labels. */
const NOT_LABEL = new Set(['lp', 'ep', 'cd', 'mc', 'vol', 'no', 'nr', 'pt', 'part', 'side', 'disc', 'cat', 'op', 'track', 'tracks', 'year', 'xlp', 'mm', 'rpm', 'inch', 'cm', 'kg', 'gr', 'gram', 'bpm']);

const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const valid = (c) => SHAPE.test(c) && !NOT_LABEL.has(c.replace(/\d.*$/u, ''));

/** A catalog number as Discogs gives it -> its matching form, or null ("none", "n/a", digits only). */
export function normCatno(catno) {
  const c = fold(catno).replace(/[^\p{L}\p{N}]+/gu, '');
  return valid(c) ? c : null;
}

/** Catalog numbers found in a listing's title and extra text (SKU, tags): joins of 1 to 3 words. */
export function catnosIn(text) {
  const words = fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < words.length; i++) {
    let joined = '';
    for (let n = 0; n < 3 && i + n < words.length; n++) {
      joined += words[i + n];
      if (valid(joined)) out.add(joined);
    }
  }
  return [...out];
}

/** Shard of the catalog-number index: the first two characters. */
export const catShard = (c) => c.slice(0, 2);

/** 4 hex of a word, to check a catalog-number match against the artist without storing titles. */
export const wordTag = (word) => hash48(word).slice(0, 4);

/** Tag of a listing's first word (usually the artist), null when the title has none. */
export const firstWordTag = (title) => {
  const w = releaseWords(title)[0];
  return w ? wordTag(w) : null;
};

/** Tags of every word of a want's artist and title: a match is kept when the listing starts with one. */
export const wantTags = (artist, title) => new Set(releaseWords(`${artist} ${title}`).map(wordTag));
