import { catalog } from '../../lib/catalog.js';
import { json } from '../../lib/api.js';

/**
 * The pages a search can lead to besides records (src/lib/search/places.js): every shop with a page, and every
 * country with shops. Built with the site, not the index, so it follows data/shops the same day. Compact rows:
 * { shops: [[id, name, country, records]], countries: [[code, shops]] }, most records first.
 */
export const GET = () => {
  const c = catalog();
  return json({
    shops: c.visible.map((s) => [s.id, s.name, s.country, s.records]),
    countries: c.countries.map((x) => [x.code, x.shops.length]),
  });
};
