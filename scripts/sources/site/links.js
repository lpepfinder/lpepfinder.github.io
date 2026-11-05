/**
 * Same-site link discovery and URL priority: listing pages and product-looking URLs first,
 * never carts, accounts, searches, faceted filters or files.
 */
const SKIP_PATH = /\/(cart|checkout|basket|warenkorb|panier|account|login|logout|register|signin|sign-in|my-account|wishlist|compare|admin|wp-admin|wp-login|feed|comments|tag|author|search|suche|recherche|cdn-cgi|_nuxt|_next|static|assets|media|wp-content|wp-includes|wp-json|xmlrpc|graphql)(\/|$|\?)/i;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|css|js|mjs|json|pdf|zip|mp3|mp4|wav|flac|ogg|woff2?|ttf|xml|txt|rss|atom)(\?|$)/i;
const SKIP_QUERY = /[?&](add-to-cart|add_to_cart|orderby|sort|order|filter_|min_price|max_price|attribute|lang=|currency|share|replytocom|variant|q=|s=|query=|search|limit|dir=|mode=|view=)/i;
const TRACKING = /^(utm_|fbclid|gclid|ref$|srsltid|_pos|_sid|_ss|sessionid|PHPSESSID|osCsid|zenid)/i;
const PRODUCT_RE = /\/(product|products|produkt|produkte|produit|producto|prodotto|item|items|release|releases|record|records|vinyl|lp|album|albums|shop\/p|p|catalog\/product|artikel|article|detail|details|product-page)\/[^/?#]+\/?$|\/\d{3,}[-/][^/?#]+\/?$|-p-\d+|[?&](product_id|id_product|productid|pid|item)=\d+|\.html?$/i;
// last segments that name a list, not an item
const LIST_WORD = /\/(list|all|index|category|categories|search|page|new|used|upcoming|preorders?|sale|catalog|shop)\/?$/i;

export const PRODUCT_URL = { test: (path) => PRODUCT_RE.test(path) && !LIST_WORD.test(path.split('?')[0]) };
export const LISTING_URL = /\/(shop|store|collections?|category|categories|kategorie|categorie|genres?|labels?|new|neu|nouveautes|releases|catalog|catalogue|products|vinyl|records|browse|list|stock|tienda|negozio|boutique)(\/|$|\?)|[?&](page|p|paged|pg|start|offset)=\d+|\/page\/\d+/i;

const sameSite = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '');

/** Absolute URL on the shop's own host without tracking parameters, or null when not worth fetching. */
export function canonical(href, base) {
  let u;
  try { u = new URL(String(href).replace(/&amp;/g, '&'), base); } catch { return null; }
  const b = new URL(base);
  if (!/^https?:$/.test(u.protocol) || !sameSite(u.host, b.host)) return null;
  u.hash = '';
  u.protocol = b.protocol;
  u.host = b.host;
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  if (SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname) || SKIP_QUERY.test(u.search) || u.search.length > 80) return null;
  return u.href;
}

export function links(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>/gi)) {
    if (/rel\s*=\s*["'][^"']*nofollow/i.test(m[0])) continue;
    const c = canonical(m[1], base);
    if (c) out.add(c);
  }
  return [...out];
}

const pathOf = (url) => { const u = new URL(url); return u.pathname + u.search; };
export const isProductUrl = (url) => PRODUCT_URL.test(pathOf(url));

/** Lower is fetched sooner. Listing pages fan out; product pages are leaves. */
export function priority(url, depth) {
  const path = pathOf(url);
  if (depth === 0) return 0;
  if (PRODUCT_URL.test(path)) return depth + 2;
  if (LISTING_URL.test(path)) return depth;
  return depth + 4;
}
