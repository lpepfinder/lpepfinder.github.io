import config from '../../data/config.json';
import { catalog } from '../lib/catalog.js';

/** For AI agents and robots (llmstxt.org): what the site is, and where its data is as JSON (docs/agents.md). */
export function GET({ site }) {
  const c = catalog();
  const url = (p) => new URL(p, site).href;
  return new Response(`# ${config.name}

> Free search engine for vinyl records in stock at ${c.visible.length} independent record shops in ${c.countries.length} countries (${c.totalRecords} records, updated daily). No marketplace: every record links to the shop that sells it. Formerly ${config.formerNames.join(', ')}.

The pages are made for people; the same data is published as JSON for robots. Search runs in the browser on a static index, so a URL like /?q=… returns an empty page to a robot: read the JSON below instead.

## Data (JSON)

- [API index](${url('/api/index.json')}): endpoints, counts, build time
- [Shops](${url('/api/shops.json')}): every shop, its site, place, records in stock, Bluesky account (verified when the shop's domain is its handle)
- [Artists](${url('/api/artists.json')}): artists in stock at several shops; each has /artist/{slug}.json with every record, price and shop link, and who the artist is (open data, with sources and licences)
- [Dig](${url('/dig.json')}): this week's records new in the shops, back in stock, and price drops

## Feeds and pages

- [New arrivals feed](${url('/feed/new.xml')}) (Atom); per shop: /feed/shop/{id}.xml
- [Sitemap](${url('/sitemap-index.xml')})
- [Docs for robots and agents](${url('/docs/agents/')}): formats, links between files, etiquette
- [Docs](${url('/docs/')}): how the site works, for people and contributors
`);
}
