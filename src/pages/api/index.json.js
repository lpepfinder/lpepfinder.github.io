import { json, abs, apiMeta } from '../../lib/api.js';

/** The API's front door: what there is and where (docs/agents.md). */
export const GET = ({ site }) => json({
  ...apiMeta(),
  docs: abs(site, '/docs/agents/'),
  endpoints: {
    shops: abs(site, '/api/shops.json'),
    artists: abs(site, '/api/artists.json'),
    // URL templates: {slug} and {id} stand for the values from the lists
    artist: `${abs(site, '/artist/')}{slug}.json`,
    dig: abs(site, '/dig.json'),
    feeds: { new: abs(site, '/feed/new.xml'), shop: `${abs(site, '/feed/shop/')}{id}.xml` },
    sitemap: abs(site, '/sitemap-index.xml'),
  },
  search: 'Searching any query runs in the browser on a static index (docs/data-formats.md); robots read the endpoints above instead.',
});
