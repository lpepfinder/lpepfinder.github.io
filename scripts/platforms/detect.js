/** Guess the shop software from homepage HTML and headers. */
const MARKERS = [
  ['shopify', /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i],
  ['woocommerce', /woocommerce|wc-block|\/wp-json\/wc\//i],
  ['bigcartel', /bigcartel/i],
  ['bandcamp', /bandcamp\.com|bcbits\.com/i],
  ['squarespace', /squarespace/i],
  ['wix', /wix\.com|wixstatic|_wixCIDX/i],
  ['square', /square\.site|squareup|weebly/i],
  ['ecwid', /ecwid/i],
  ['prestashop', /prestashop/i],
  ['magento', /Magento_|\/static\/version\d+\/|mage\/cookies/],
  ['shopware', /shopware/i],
  ['bigcommerce', /bigcommerce/i],
  ['opencart', /route=product|opencart/i],
  ['wordpress', /wp-content|wp-includes/i],
];

export function detectPlatform(html = '', headers = new Headers()) {
  if (headers.get('x-shopid') || headers.get('x-shopify-stage')) return 'shopify';
  for (const [name, re] of MARKERS) if (re.test(html)) return name;
  return 'unknown';
}

export const pageTitle = (html = '') => {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
  return (og || title || '').replace(/\s+/g, ' ').trim() || null;
};

/**
 * The shop's theme, for the status page's "what the shops use": Shopify's theme by its schema name (a shop's own
 * copy of Dawn is still Dawn; theme_store_id null: not from the Theme Store), WordPress by its parent theme's
 * folder (a child theme is named after its parent). null when the page doesn't say.
 */
export function detectTheme(html = '') {
  const shopify = html.match(/Shopify\.theme\s*=\s*(\{[^;<]*?\})\s*;/)?.[1];
  if (shopify) {
    try {
      const t = JSON.parse(shopify);
      const name = String(t.schema_name || t.name || '').trim().slice(0, 60);
      if (name) return { name, store: t.theme_store_id != null };
    } catch { /* not JSON: no theme */ }
  }
  const folders = [...new Set([...html.matchAll(/\/wp-content\/themes\/([\w.-]{1,60})\//g)].map((m) => m[1].toLowerCase()))];
  const parent = folders.find((f) => !/child/.test(f)) || folders[0]?.replace(/[-_]?child.*$/, '');
  return parent ? { name: parent } : null;
}
