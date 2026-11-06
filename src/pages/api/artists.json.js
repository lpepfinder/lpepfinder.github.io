import { catalog } from '../../lib/catalog.js';
import { json, abs, apiMeta } from '../../lib/api.js';

/** Artists with records in stock at several shops, with their page and their JSON (records and offers). */
export const GET = ({ site }) => json({
  ...apiMeta(),
  artists: catalog().artists.map((a) => ({ slug: a.slug, name: a.name, shops: a.shopCount, records: a.records.length, page: abs(site, `/artist/${a.slug}/`), json: abs(site, `/artist/${a.slug}.json`) })),
});
