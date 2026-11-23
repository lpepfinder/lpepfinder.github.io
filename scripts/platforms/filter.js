import { config } from '../lib/config.js';

const include = new RegExp(config.products.include, 'i');
const exclude = new RegExp(config.products.exclude, 'i');
const excludeTypes = new RegExp(config.products.excludeTypes, 'i');
const keepTypes = new RegExp(config.products.keepTypes, 'i');

/** Not merch, accessories or hardware. */
export const isMusicProduct = (text) => !exclude.test(text);

/**
 * A shop's product type (its category) that isn't gear, merch, books, clothes or toys: "Guitars", "Movies & TV" or
 * "Jewelry" are out, "Rock", "LP" or "Film Soundtracks" stay. No type: nothing to say, kept.
 */
export function isMusicType(type) {
  const t = String(type || '').replace(/&amp;/g, '&').trim();
  return !t || !excludeTypes.test(t) || keepTypes.test(t);
}

/** Explicitly mentions a music format, used to score how "record shop" a catalog is. */
export const mentionsFormat = (text) => include.test(text);

/** "Artist - Title", the usual way record shops name products. */
const artistTitle = /\S\s+[-–—]\s+\S/;

/** Share of a sample of product titles (plus type/tags text) that look like records. */
export function musicRatio(samples) {
  if (!samples.length) return 0;
  return samples.filter(([title, text]) => isMusicProduct(text) && (mentionsFormat(text) || artistTitle.test(title))).length / samples.length;
}

/**
 * Keep a product? Always drop merch/hardware; for shops that sell many other
 * things (strict), also require a format word or an "Artist - Title" name.
 */
export const keepProduct = (title, text, strict) =>
  isMusicProduct(text) && (!strict || mentionsFormat(text) || artistTitle.test(title));
