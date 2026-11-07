import { catalog } from '../../lib/catalog.js';
import { json, abs, apiRecord, API_VERSION } from '../../lib/api.js';
import { artistProfile, apiProfile } from '../../lib/enrich.js';
import config from '../../../data/config.json' with { type: 'json' };

/** One artist's records in stock across shops, cheapest first, as on its page; `profile`: who they are, from open sources, with credits (docs/sources.md), or null. */
export function getStaticPaths() {
  return catalog().artists.map((artist) => ({ params: { slug: artist.slug }, props: { artist } }));
}

export const GET = ({ site, props: { artist } }) => json({
  version: API_VERSION, name: artist.name, slug: artist.slug, page: abs(site, `/artist/${artist.slug}/`),
  profile: apiProfile(artistProfile(artist.slug), config.defaultLanguage),
  shops: artist.shopCount, records: artist.records.map((r) => apiRecord(site, r)),
});
