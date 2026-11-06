/**
 * Can a shop sell to the viewer, and at what cost? From the shop's country and shipping countries
 * (search/shops.json) and the customs zones (regions.json, data/regions.json):
 *   local    same country
 *   zone     same customs zone (no import duties, e.g. both in the EU)
 *   ships    ships to the viewer's country, import duties may apply
 *   no       known not to ship there
 *   unknown  no shipping data, or the viewer's country is unknown
 */
export function reach(shop, viewer, zones = []) {
  if (!viewer || !shop?.country) return 'unknown';
  if (shop.country === viewer) return 'local';
  const zone = (cc) => zones.find((z) => z.countries.includes(cc))?.id;
  if (zone(viewer) && zone(viewer) === zone(shop.country)) return 'zone';
  const to = shop.shipsTo || [];
  if (!to.length) return 'unknown';
  return to.includes(viewer) || to.includes('*') ? 'ships' : 'no';
}

/** Cheapest first among reaches: shops with no customs before the others. */
export const noCustoms = (r) => r === 'local' || r === 'zone';
