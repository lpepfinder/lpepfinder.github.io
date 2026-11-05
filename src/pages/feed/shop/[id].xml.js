import config from '../../../../data/config.json';
import { t, defaultLanguage as lang } from '../../../lib/i18n.js';
import { catalog } from '../../../lib/catalog.js';
import { newArrivals } from '../../../lib/new-arrivals.js';
import { atomFeed } from '../../../lib/atom.js';

/** /feed/shop/<id>.xml for every shop with a searchable catalog, also in weeks without new records. */
export function getStaticPaths() {
  return catalog().visible.filter((s) => s.records).map((shop) => ({ params: { id: shop.id }, props: { shop } }));
}

export const GET = ({ site, props: { shop } }) => atomFeed({
  site, path: `/feed/shop/${shop.id}.xml`, page: `/shop/${shop.id}/`, title: t(lang, 'feedShopTitle', { shop: shop.name }),
  records: newArrivals().shop(shop.id, config.newArrivals.feedItems).records,
});
