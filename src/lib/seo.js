import config from '../../data/config.json' with { type: 'json' };

/** "Primary keyword · Brand": the brand goes last. */
export const pageTitle = (text) => `${text} · ${config.name}`;

/** Shorten a name for titles, on a word boundary when possible. */
export function truncate(s, max = 30) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max / 2 ? cut.lastIndexOf(' ') : cut.length).trim()}…`;
}

/** schema.org BreadcrumbList from [{ name, href }], hrefs relative to the site. */
export const breadcrumbLd = (items, site) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: new URL(item.href, site).href })),
});
