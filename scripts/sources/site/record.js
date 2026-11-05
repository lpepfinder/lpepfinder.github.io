import { keepProduct } from '../../platforms/filter.js';

const CURRENCY = /^[A-Z]{3}$/;

/**
 * An extracted product -> stored record (price in cents), or null when it is no record
 * (no title or price, merch). Sold-out records are kept with available: false.
 */
export function toRecord(p) {
  if (!p?.title || !(p.price > 0)) return null;
  const title = String(p.title).replace(/\s+/g, ' ').trim().slice(0, 300);
  const type = p.format || p.type || null;
  if (!keepProduct(title, `${title} ${type || ''}`, false)) return null;
  const currency = String(p.currency || '').toUpperCase();
  return {
    title,
    type,
    price: Math.round(p.price * 100),
    currency: CURRENCY.test(currency) ? currency : null,
    image: p.image || null,
    available: p.inStock !== false,
  };
}

/** Stored entry + its URL -> output line in the shared products format. */
export function outputRecord(shopId, origin, url, entry) {
  const u = new URL(url);
  const sameHost = u.host.replace(/^www\./, '') === new URL(origin).host.replace(/^www\./, '');
  const { title, type, price, currency, image, available } = entry.r;
  return {
    shop: shopId,
    title,
    vendor: null,
    type,
    price,
    currency,
    path: sameHost ? u.pathname + u.search : u.href,
    image,
    available,
    updated: entry.f || entry.t || null,
  };
}
