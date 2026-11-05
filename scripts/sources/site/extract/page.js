import { meta, jsonLdProduct, microdataProduct, ogProduct } from './structured.js';
import { appState, productsFromState, productFromState } from './app-state.js';
import { text, prices, addToCart, soldOut, h1, pageTitle, artistTitle } from './signals.js';
import { stripShopName } from './title.js';
import { isProductUrl } from '../links.js';

const abs = (u, base) => { try { return u ? new URL(u, base).href : null; } catch { return null; } };

/**
 * Classify a page as a product page and extract { title, price, currency, inStock, image }.
 * Strong signals (structured data) first, then weak HTML heuristics that must agree.
 * Also returns `items`: products embedded in the app state of listing pages (Nuxt/Next).
 */
export function extractProduct(html, url, { names = [] } = {}) {
  const m = meta(html);
  const og = ogProduct(m);
  const items = productsFromState(appState(html));
  const own = productFromState(items, url);
  const strong = jsonLdProduct(html) || own || microdataProduct(html);
  const t = text(html).slice(0, 20000);
  const heading = h1(html);
  const cart = addToCart(html);
  const sold = soldOut(t);
  const found = prices(t);
  const signals = { strong: strong?.via || null, og: !!og, items: items.length, cart, sold, prices: found.length };

  let p = null;
  if (strong && (strong.price != null || og)) p = { ...strong };
  else if (og && og.price != null) p = { ...og };
  else if ((og || artistTitle(heading)) && found.length && found.length <= 6 && (cart || sold)) {
    // a single product page shows few prices; listing pages show many
    p = { via: 'heuristic', title: heading || og?.title, ...found[0], inStock: null };
  } else if (isProductUrl(url) && found.length && found.length <= 3 && cart) {
    // product-looking URL + add-to-cart + one price: plain-HTML shop systems (EC-CUBE, osCommerce...)
    p = { via: 'heuristic-url', title: artistTitle(heading) ? heading : pageTitle(html), ...found[0], inStock: true };
  }
  const listItems = items.filter((i) => i !== own).map((i) => ({ ...i, url: abs(i.url, url), image: abs(i.image, url) }));
  if (!p) return { product: null, items: listItems, signals };
  p.title = stripShopName(p.title || og?.title || heading || m['og:title'] || pageTitle(html), [...names, m['og:site_name']]);
  p.currency ||= og?.currency || found[0]?.currency || null;
  if (p.price == null) p.price = og?.price ?? found[0]?.price ?? null;
  p.image = abs(p.image || og?.image || m['og:image'], url);
  if (p.inStock == null) p.inStock = og?.inStock ?? (cart ? true : sold ? false : null);
  return { product: { url, ...p }, items: listItems, signals };
}
