/** The search index (/search/) is for the site's own search in the browser: robots read /api/ (see /llms.txt). */
export const GET = ({ site }) => new Response(`User-agent: *
Allow: /
Disallow: /search/

# Data for robots and AI agents: ${new URL('/llms.txt', site).href} and ${new URL('/api/index.json', site).href}
Sitemap: ${new URL('/sitemap-index.xml', site).href}
`);
