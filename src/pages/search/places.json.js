import { catalog } from '../../lib/catalog.js';
import { json } from '../../lib/api.js';
import { cityNames } from '../../lib/cities.js';

/**
 * The pages a search can lead to besides records (src/lib/search/places.js): every shop with a page, every
 * country with shops, and every city with a page. Built with the site, not the index, so it follows data/shops
 * the same day. Compact rows: { shops: [[id, name, country, records]], countries: [[code, shops]],
 * cities: [[country, slug, shops, { en, fr…: name }, [local spellings]]] }, most records or shops first.
 */
export const GET = () => {
  const c = catalog();
  return json({
    shops: c.visible.map((s) => [s.id, s.name, s.country, s.records]),
    countries: c.countries.map((x) => [x.code, x.shops.length]),
    cities: c.countries.flatMap((x) => x.pages.map((city) => [x.code, city.slug, city.shops.length, ...cityNames(x.code, city.name)])),
  });
};
