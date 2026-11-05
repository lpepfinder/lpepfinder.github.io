import config from '../../data/config.json';
import { catalog } from '../lib/catalog.js';

export function GET({ site }) {
  const c = catalog();
  const url = (p) => new URL(p, site).href;
  return new Response(`# ${config.name}

> Free search engine for vinyl records in stock at ${c.visible.length} independent record shops in ${c.countries.length} countries (${c.totalRecords} records, crawled daily). Formerly ${config.formerNames.join(', ')}.

- Search: ${url('/')}?q=ARTIST+TITLE
- Record shops by country: ${url('/shops/')}
- Artists with records in stock at several shops: ${url('/artists/')}
- About and data sources: ${url('/about/')}
- Data status: ${url('/status/')}
`);
}
