/** Sitemaps: URLs with <lastmod>, following sitemap indexes, product sub-sitemaps first. */
const PREFER = /product|store|shop|item|release|catalog/i;
const tag = (block, name) => block.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]]+?)\\s*(?:\\]\\]>)?\\s*</${name}>`, 'i'))?.[1]?.replace(/&amp;/g, '&') || null;

/** Parse one sitemap file: { index: bool, entries: [{ loc, lastmod }] }. */
export function parseSitemap(xml = '') {
  const index = /<sitemapindex/i.test(xml);
  const entries = [];
  for (const m of xml.matchAll(index ? /<sitemap>([\s\S]*?)<\/sitemap>/gi : /<url>([\s\S]*?)<\/url>/gi)) {
    const loc = tag(m[1], 'loc');
    if (loc) entries.push({ loc, lastmod: tag(m[1], 'lastmod') });
  }
  return { index, entries };
}

/** Read up to `maxFiles` sitemap files of the shop: [{ loc, lastmod, from }]. */
export async function sitemapEntries(ctx, { maxFiles = 3, extra = [] } = {}) {
  const declared = [...extra, ...ctx.robots.sitemaps];
  const todo = [...new Set(declared.length ? declared : [`${ctx.origin}/sitemap.xml`])];
  const done = new Set();
  const out = [];
  while (todo.length && done.size < maxFiles) {
    const file = todo.shift();
    if (done.has(file)) continue;
    done.add(file);
    const res = await ctx.get(file, { accept: 'application/xml,text/xml,*/*' });
    if (!res) break;
    if (!res.ok) continue;
    const { index, entries } = parseSitemap(res.text);
    if (index) todo.unshift(...entries.map((e) => e.loc).sort((a, b) => PREFER.test(b) - PREFER.test(a)));
    else for (const e of entries) out.push({ ...e, from: file });
  }
  return out;
}
