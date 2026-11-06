/**
 * Markdown plugin (Sätteri, Astro's Markdown processor) for the docs: links between Markdown files
 * ("watchlist.md", "watchlist.md#views") become site links ("/docs/watchlist/"), so docs/*.md read the
 * same on GitHub and on the site. index.md is /docs/.
 */
export const docsHref = (url) => {
  const m = /^(?:\.\/)?([\w-]+)\.md(#.*)?$/.exec(url || '');
  return m ? `/docs/${m[1] === 'index' ? '' : `${m[1]}/`}${m[2] || ''}` : null;
};

export const docsLinks = {
  name: 'docs-links',
  link(node, context) {
    const href = docsHref(node.url);
    if (href) context.setProperty(node, 'url', href);
  },
};
