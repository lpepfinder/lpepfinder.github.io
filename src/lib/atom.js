import config from '../../data/config.json' with { type: 'json' };
import { t, price, defaultLanguage as lang } from './i18n.js';
import { catalog } from './catalog.js';
import { newArrivals } from './new-arrivals.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const host = new URL(config.baseUrl).host;

/** One record: links straight to the shop's product page; the id stays the same while it is listed. */
function entry(r, shops) {
  const shop = shops.get(r.shop)?.name || r.shop;
  const kind = [r.format && t(lang, `formats.${r.format}`), r.used && t(lang, 'conditionUsed')].filter(Boolean).join(' · ');
  const summary = [t(lang, 'feedItemSummary', { price: price(lang, r.price, r.currency), shop }), kind].filter(Boolean).join(' · ');
  return `  <entry>
    <title>${esc(r.title)}</title>
    <link rel="alternate" type="text/html" href="${esc(r.url)}"/>
    <id>tag:${host},${r.day}:offer/${r.offerKey}</id>
    <updated>${r.day}T00:00:00Z</updated>
    <summary>${esc(summary)}</summary>${r.image ? `\n    <link rel="enclosure" href="${esc(r.image.startsWith('//') ? `https:${r.image}` : r.image)}"/>` : ''}
  </entry>`;
}

/**
 * Atom feed Response for one scope of new arrivals. path: the feed's own path; page: our HTML page
 * for it (gets ?ref=feed, to count feed visits); records: newest first.
 */
export function atomFeed({ path, page, title, records, site }) {
  const shops = catalog().shopsById;
  const self = new URL(path, site).href;
  const alternate = new URL(page, site);
  alternate.searchParams.set('ref', 'feed');
  const updated = newArrivals().builtAt || new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
  <title>${esc(title)}</title>
  <subtitle>${esc(t(lang, 'feedSubtitle'))}</subtitle>
  <link rel="self" type="application/atom+xml" href="${esc(self)}"/>
  <link rel="alternate" type="text/html" href="${esc(alternate.href)}"/>
  <id>${esc(self)}</id>
  <updated>${updated}</updated>
  <author><name>${esc(config.name)}</name><uri>${esc(config.baseUrl)}/</uri></author>
  <icon>${esc(new URL('/favicon.png', site).href)}</icon>
${records.map((r) => entry(r, shops)).join('\n')}
</feed>
`;
  return new Response(xml, { headers: { 'content-type': 'application/atom+xml; charset=utf-8' } });
}
