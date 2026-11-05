import { decodeEntities } from '../../../lib/text.js';

/** Standard structured data: JSON-LD Product, microdata Product, OpenGraph product tags. */
export const decode = (s = '') => decodeEntities(s).trim();

/** <meta property|name|itemprop=... content=...> as a lowercase-keyed map (first wins). */
export function meta(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = m[0];
    const key = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const val = tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i) || [];
    if (key && (val[1] ?? val[2]) != null && !(key in out)) out[key] = decode(val[1] ?? val[2]);
  }
  return out;
}

const isType = (o, t) => [].concat(o?.['@type'] || []).some((x) => String(x).toLowerCase() === t);
const TYPES = ['product', 'productgroup', 'musicalbum', 'musicrelease'];
const IN_STOCK = /instock|limitedavailability|preorder|presale|onlineonly/i;

function* walk(node, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  yield node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) yield* walk(v, seen);
}

const firstImage = (img) => {
  const i = [].concat(img || [])[0];
  return typeof i === 'string' ? i : i?.url || i?.contentUrl || null;
};

/** "1.234,56", "1,234.56", "12,9", 12.9 -> number. */
export const toNumber = (v) => {
  if (v == null || v === '') return null;
  let s = String(v).replace(/[^\d.,]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
};

export function jsonLdProduct(html) {
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const o of walk(data)) {
      if (!TYPES.some((t) => isType(o, t))) continue;
      const offers = [].concat(o.offers || o.hasVariant?.flatMap?.((v) => v.offers || []) || []);
      const flat = offers.flatMap((x) => (x?.offers ? [].concat(x.offers) : [x])).filter(Boolean);
      const offer = flat.find((x) => IN_STOCK.test(x.availability || '')) || flat[0] || {};
      const price = offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price;
      if (price == null && !isType(o, 'product')) continue;
      const artist = o.byArtist?.name || (typeof o.byArtist === 'string' ? o.byArtist : null);
      const name = decode(String(o.name || ''));
      return {
        via: 'jsonld',
        title: artist && !name.toLowerCase().includes(artist.toLowerCase()) ? `${artist} - ${name}` : name,
        price: toNumber(price),
        currency: offer.priceCurrency || offer.priceSpecification?.priceCurrency || null,
        inStock: offer.availability ? IN_STOCK.test(offer.availability) : null,
        image: firstImage(o.image),
      };
    }
  }
  return null;
}

export function microdataProduct(html) {
  if (!/itemtype\s*=\s*["']https?:\/\/schema\.org\/Product["']/i.test(html)) return null;
  const prop = (name) => {
    const m = html.match(new RegExp(`itemprop\\s*=\\s*["']${name}["'][^>]*?(?:content\\s*=\\s*["']([^"']*)["']|>([^<]*)<)`, 'i'));
    return m ? decode(m[1] ?? m[2]) : null;
  };
  const avail = html.match(/itemprop\s*=\s*["']availability["'][^>]*?(?:content|href)\s*=\s*["']([^"']*)/i)?.[1];
  return {
    via: 'microdata',
    title: prop('name'),
    price: toNumber(prop('price')),
    currency: prop('priceCurrency'),
    inStock: avail ? IN_STOCK.test(avail) : null,
    image: prop('image'),
  };
}

export function ogProduct(m) {
  const type = (m['og:type'] || '').toLowerCase();
  const price = m['product:price:amount'] || m['og:price:amount'];
  if (!/product|music\.album|music\.song/.test(type) && !price) return null;
  const avail = m['product:availability'] || m['og:availability'];
  return {
    via: 'og',
    ogType: type,
    title: m['og:title'] || null,
    price: toNumber(price),
    currency: m['product:price:currency'] || m['og:price:currency'] || null,
    inStock: avail ? /in ?stock|instock|available|preorder/i.test(avail) && !/out/i.test(avail) : null,
    image: m['og:image'] || null,
  };
}
