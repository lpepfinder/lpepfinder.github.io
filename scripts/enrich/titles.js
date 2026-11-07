/**
 * Album titles from shop listings, to find an artist on MusicBrainz through a record it really made:
 * "Nirvana - From The Muddy Banks Of The Wishkah (CD, Album) (Very Good Plus (VG+))" -> "From The Muddy Banks Of The Wishkah".
 */

/** Lower case, accents off, "&" as "and", a leading "the" off, letters and digits only. */
export function norm(s) {
  return String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/^\s*the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const FORMAT = /\b(\d*x?\s?(lp|ep|cd|cds|mc|vinyl|vinyle|vinilo|vinile|cassette|tape|k7|album|single|maxi|box ?set|reissue|remaster(ed)?|repress|limited|edition|deluxe|colou?red|gatefold|180 ?g(ram)?|half ?speed|sealed|new|used|mint|nm|vg\+?|ex|import|promo)|\d{2,3}\s?rpm)\b|\b\d{1,2}\s?("|”|''|inch\b|in\b)/gi;

/**
 * The album part of a listing title by `artist`, or null when nothing album-like is left. A title that is the
 * artist's name is kept only after "Artist - " (a self-titled album), not when the listing is the name alone.
 */
export function albumTitle(listing, artist) {
  let s = String(listing || '');
  // the artist first, then a separator: "Artist - Title", "Artist: Title", "Artist – Title", "Artist Title"
  const a = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = s;
  s = s.replace(new RegExp(`^\\s*${a}(\\s*[-–—:/|]\\s*|\\s+)`, 'i'), '');
  // "Title - Artist" (some shops put the artist last)
  s = s.replace(new RegExp(`\\s*[-–—:/|]\\s*${a}\\s*$`, 'i'), '');
  const split = s !== before;
  // brackets, innermost first: "(Very Good Plus (VG+))"
  for (let before = ''; before !== s;) { before = s; s = s.replace(/\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}/g, ' '); }
  // after a second separator come formats, conditions, merch ("- Patch", "- LP")
  s = s.split(/\s+[-–—|]\s+/)[0];
  s = s.replace(FORMAT, ' ').replace(/[\s,;:/+-]+$/g, '').replace(/^[\s,;:/+-]+/g, '').replace(/\s{2,}/g, ' ').trim();
  return norm(s).length >= 2 && (split || norm(s) !== norm(artist)) ? s : null;
}

/**
 * Up to `n` different album titles from an artist's listings, the most listed first (a title many shops have
 * is surely an album). `exclude`: listings that aren't records (merch: config.products.exclude).
 */
export function albumTitles(listings, artist, n, exclude = null) {
  const counts = new Map();
  for (const l of listings) {
    if (exclude?.test(l)) continue;
    const t = albumTitle(l, artist);
    if (!t) continue;
    const k = norm(t);
    const c = counts.get(k) || { t, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  return [...counts.values()].sort((x, y) => y.n - x.n).slice(0, n).map((c) => c.t);
}
