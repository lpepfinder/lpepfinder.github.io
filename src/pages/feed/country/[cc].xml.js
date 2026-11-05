import config from '../../../../data/config.json';
import { t, defaultLanguage as lang, countryName } from '../../../lib/i18n.js';
import { catalog } from '../../../lib/catalog.js';
import { newArrivals } from '../../../lib/new-arrivals.js';
import { atomFeed } from '../../../lib/atom.js';

/** /feed/country/<cc>.xml for every country with a searchable shop, also in weeks without new records. */
export function getStaticPaths() {
  const codes = new Set([...catalog().visible.filter((s) => s.records && s.country).map((s) => s.country), ...newArrivals().countryCodes]);
  return [...codes].map((cc) => ({ params: { cc: cc.toLowerCase() }, props: { cc } }));
}

export const GET = ({ site, props: { cc } }) => {
  const n = newArrivals();
  return atomFeed({
    site, path: `/feed/country/${cc.toLowerCase()}.xml`,
    // the country page exists only in weeks with new records there
    page: n.countries[cc] ? `/new/${cc.toLowerCase()}/` : '/new/',
    title: t(lang, 'feedCountryTitle', { country: countryName(lang, cc) }),
    records: n.country(cc, config.newArrivals.feedItems).records,
  });
};
