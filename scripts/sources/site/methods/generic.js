import { crawlPages } from '../crawler.js';
import { seedPages } from '../seeds.js';
import { isProductUrl } from '../links.js';

/** Any site: follow same-site links from the home page, product-looking sitemap URLs as extra seeds. */
export const name = 'generic';
export const applies = () => true;
export const probe = async () => ({});
export const crawl = (ctx) => crawlPages(ctx, { follow: true, seed: (c) => seedPages(c, { filter: isProductUrl }) });
