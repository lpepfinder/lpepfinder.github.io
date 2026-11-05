import { decode } from './structured.js';

/** Weak HTML signals for pages without structured data. */
const CUR = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '円': 'JPY', 'kr': 'SEK', 'zł': 'PLN', 'R$': 'BRL', 'A$': 'AUD', 'C$': 'CAD', 'CA$': 'CAD', 'AU$': 'AUD', 'NZ$': 'NZD', 'Fr.': 'CHF' };
const CODES = 'EUR|USD|GBP|JPY|CHF|SEK|DKK|NOK|PLN|CZK|AUD|CAD|NZD|BRL|MXN|HUF';
const SYM = 'R\\$|A\\$|C\\$|CA\\$|AU\\$|NZ\\$|€|\\$|£|¥|円|kr|zł|Fr\\.';
const AMT = '\\d{1,4}(?:[.,\\s]\\d{3})*(?:[.,]\\d{2})?';
const PRICE_RE = new RegExp(`(?:(${CODES}|${SYM})\\s?(${AMT})(?![\\d%])|(${AMT})\\s?(${CODES}|${SYM})(?![a-z]))`, 'gi');

export const text = (html) =>
  decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

const amount = (s) => {
  s = s.replace(/\s/g, '');
  s = /[.,]\d{2}$/.test(s) ? s.slice(0, -3).replace(/[.,]/g, '') + '.' + s.slice(-2) : s.replace(/[.,]/g, '');
  return Number(s);
};

export function prices(t) {
  const out = [];
  for (const m of t.matchAll(PRICE_RE)) {
    const sym = m[1] || m[4];
    const price = amount(m[2] || m[3]);
    if (price > 0 && price < 10000) out.push({ price, currency: CUR[sym] || sym.toUpperCase() });
  }
  return out;
}

export const addToCart = (html) =>
  /<form[^>]*action\s*=\s*["'][^"']*(cart\/add|add-to-cart|addtocart|warenkorb|panier|basket|carrito|carrello)[^"']*["']/i.test(html) ||
  /<(button|input)[^>]*(name|value|id|data-[a-z-]+)\s*=\s*["'][^"']*(add[-_ ]?to[-_ ]?cart|add_to_cart|addtocart)[^"']*["']/i.test(html) ||
  /\?add-to-cart=\d+/.test(html) ||
  /<button[^>]*>\s*(add to (cart|basket|bag)|in den warenkorb|ajouter au panier|añadir al carrito|aggiungi al carrello|カートに入れる)\s*</i.test(html);

export const soldOut = (t) => /\b(sold out|out of stock|ausverkauft|nicht (mehr )?verfügbar|nicht auf lager|épuisé|rupture de stock|agotado|esaurito|在庫切れ|品切れ)\b/i.test(t);

export function h1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : null;
}

export const pageTitle = (html) => {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return t ? decode(t).replace(/\s+/g, ' ').trim() || null : null;
};

export const artistTitle = (s) => !!s && /\S\s+[-–—]\s+\S/.test(s) && s.length < 200;
