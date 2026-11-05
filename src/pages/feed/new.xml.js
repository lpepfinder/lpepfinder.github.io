import config from '../../../data/config.json';
import { t, defaultLanguage as lang } from '../../lib/i18n.js';
import { newArrivals } from '../../lib/new-arrivals.js';
import { atomFeed } from '../../lib/atom.js';

/** /feed/new.xml: the newest arrivals at every shop. */
export const GET = ({ site }) => atomFeed({
  site, path: '/feed/new.xml', page: '/new/', title: t(lang, 'feedTitle'),
  records: newArrivals().all(config.newArrivals.feedItems).records,
});
