const CODE = /^[A-Z]{2}$/;

/**
 * Countries a shop ships to, from Shopify's /meta.json `ships_to_countries`:
 * sorted unique ISO 3166-1 alpha-2 codes. "*" (Shopify's "rest of world" zone) is kept as "*".
 * [] when unknown (field missing, not a list, nothing valid in it).
 */
export function shipsTo(list) {
  if (!Array.isArray(list)) return [];
  const codes = new Set();
  for (const c of list) {
    const code = typeof c === 'string' ? c.trim().toUpperCase() : '';
    if (CODE.test(code) || code === '*') codes.add(code);
  }
  return [...codes].sort();
}
