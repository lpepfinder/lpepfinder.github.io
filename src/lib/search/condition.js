import facets from '../../../data/facets.json' with { type: 'json' };

/** Grades best first, as listed in data/facets.json, with Mint before Near mint. */
const ORDER = ['m', ...facets.grades.map((g) => g.id).filter((id) => id !== 'm')];
const rank = (g) => ORDER.indexOf(g.id);

/**
 * Condition of a release's copies: { mix: "new" | "used" | "mixed", best, worst } where best and
 * worst are the grade codes of graded used copies (null when none is graded).
 */
export function conditionRange(offers) {
  const used = offers.filter((o) => o.used);
  const mix = !used.length ? 'new' : used.length === offers.length ? 'used' : 'mixed';
  const graded = used.map((o) => o.grade).filter(Boolean).sort((a, b) => rank(a) - rank(b));
  return { mix, best: graded[0]?.code || null, worst: graded.at(-1)?.code || null };
}

/** Lowest and highest of the values (comparable prices), with the offers they belong to. */
export function priceRange(offers, value) {
  const priced = offers.filter((o) => o.price != null).sort((a, b) => value(a) - value(b));
  return { low: priced[0] || null, high: priced.at(-1) || null };
}
