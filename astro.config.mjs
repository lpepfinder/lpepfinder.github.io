import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import config from './data/config.json' with { type: 'json' };
import { catalog } from './src/lib/catalog.js';
import { newArrivals } from './src/lib/new-arrivals.js';
import { satteri } from '@astrojs/markdown-satteri';
import { docsLinks } from './src/lib/docs-links.js';

const locales = Object.fromEntries(config.languages.map((l) => [l, l]));
const c = catalog();
// shop pages without records are noindex, keep them out of the sitemap too
const noindex = new Set(c.visible.filter((s) => !s.records).map((s) => `/shop/${s.id}/`));
// an empty /new/ page is noindex too (no new records this week)
if (!newArrivals().total) noindex.add('/new/');
// <lastmod>: the newest product update of a shop or artist page when shops report it, else the build date for hubs
const lastmods = new Map([
  ...c.visible.filter((s) => s.lastmod).map((s) => [`/shop/${s.id}/`, s.lastmod]),
  ...c.artists.filter((a) => a.lastmod).map((a) => [`/artist/${a.slug}/`, a.lastmod]),
]);
const isDetail = (path) => /^\/(shop|artist)\//.test(path);
const withLastmod = (item) => {
  const path = new URL(item.url).pathname;
  const lastmod = lastmods.get(path) || (isDetail(path) ? null : c.builtAt);
  return lastmod ? { ...item, lastmod } : item;
};
const only = (re) => (item) => (re.test(new URL(item.url).pathname) ? withLastmod(item) : undefined);

export default defineConfig({
  site: config.baseUrl,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: config.defaultLanguage,
    locales: config.languages,
    routing: { prefixDefaultLocale: false },
  },
  // docs/*.md link to each other as "page.md": on the site, /docs/page/
  markdown: { processor: satteri({ mdastPlugins: [docsLinks] }) },
  integrations: [
    sitemap({
      i18n: { defaultLocale: config.defaultLanguage, locales },
      filter: (page) => !/\/(status|404|watch)\/?$/.test(page) && !noindex.has(new URL(page).pathname),
      serialize: withLastmod,
      // sitemap-shops-0.xml, sitemap-artists-0.xml, sitemap-new-0.xml (rolling new-arrivals pages); hubs stay in sitemap-0.xml
      chunks: { shops: only(/^\/shop\//), artists: only(/^\/artist\//), new: only(/^\/new\//) },
    }),
  ],
});
