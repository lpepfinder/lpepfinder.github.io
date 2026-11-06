/**
 * data/regions.json: customs zones, so the browser can tell an offer from the viewer's own zone from an import.
 *   { "zones": [{ "id": "eu", "label": "zone.eu" (i18n key), "countries": ["AT", ...] }, ...] }
 * A country belongs to at most one zone; countries in no zone are their own zone.
 * Returns the list of errors.
 */
export function checkRegions(regions, isCountry) {
  const errors = [];
  const ids = new Set();
  const zoneOf = new Map();
  if (!Array.isArray(regions?.zones)) return ['regions.json: "zones" must be a list'];
  for (const [i, z] of regions.zones.entries()) {
    const where = `regions.json zone ${z?.id || i}`;
    if (typeof z?.id !== 'string' || !/^[a-z]{2,8}$/.test(z.id)) errors.push(`${where}: "id" must be 2-8 lowercase letters`);
    else if (ids.has(z.id)) errors.push(`${where}: duplicate id`);
    else ids.add(z.id);
    if (typeof z?.label !== 'string' || !z.label) errors.push(`${where}: missing "label"`);
    if (!Array.isArray(z?.countries) || !z.countries.length) { errors.push(`${where}: "countries" must be a non-empty list`); continue; }
    for (const c of z.countries) {
      if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c) || !isCountry(c)) errors.push(`${where}: "${c}" is not a country code`);
      else if (zoneOf.has(c)) errors.push(`${where}: "${c}" is already in zone ${zoneOf.get(c)}`);
      else zoneOf.set(c, z.id);
    }
  }
  return errors;
}
