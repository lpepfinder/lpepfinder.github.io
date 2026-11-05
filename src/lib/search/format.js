import facets from '../../../data/facets.json' with { type: 'json' };

/**
 * Format and condition from a product title, with the CMS-editable table in
 * data/facets.json. Shared by the index builder and the browser: first match wins.
 */
const formats = facets.formats.map((f) => ({ ...f, re: new RegExp(f.pattern, 'iu') }));
const used = new RegExp(facets.used, 'iu');

export const FORMAT_IDS = formats.map((f) => f.id);

export function detectFormat(title) {
  const s = String(title || '');
  return { format: formats.find((f) => f.re.test(s))?.id || null, used: used.test(s) };
}
