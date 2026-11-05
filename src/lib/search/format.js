import facets from '../../../data/facets.json' with { type: 'json' };

/**
 * Format and condition from a product title, with the CMS-editable table in
 * data/facets.json. Shared by the index builder and the browser: first match wins.
 * Used-condition grades (Goldmine codes) become words in the browser: "Near mint (NM)".
 */
const formats = facets.formats.map((f) => ({ ...f, re: new RegExp(f.pattern, 'iu') }));
const used = new RegExp(facets.used, 'iu');
// grades: a code (NM, VG+) counts anywhere; a word ("mint") only in a title already marked used
const grades = facets.grades.map((g) => ({ ...g, codes: new RegExp(g.codes, 'u'), words: new RegExp(g.words, 'u') }));

export const FORMAT_IDS = formats.map((f) => f.id);

/** The grade written first ("VG+/NM": the record before the sleeve). */
function first(s, kind) {
  let best = null;
  for (const g of grades) {
    const i = s.search(g[kind]);
    if (i >= 0 && (!best || i < best.i)) best = { ...g, i };
  }
  return best;
}

/** { format, used, grade: { id, code } | null } of a product title. */
export function detectFormat(title) {
  const s = String(title || '');
  const isUsed = used.test(s);
  const g = first(s, 'codes') || (isUsed ? first(s, 'words') : null);
  return { format: formats.find((f) => f.re.test(s))?.id || null, used: isUsed || !!g, grade: g ? { id: g.id, code: g.code } : null };
}
