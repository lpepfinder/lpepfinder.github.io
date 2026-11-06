/** Product images for 56 px record cards; shared by <vf-release> (browser, src/components/cover.js) and ResultCard.astro (build). */
const WP_SIZE = /-\d{3,4}x\d{3,4}(\.(?:jpe?g|png|webp))(\?|$)/i;

/** Protocol-relative URLs ("//host/x.jpg") made absolute. */
export const absolute = (src) => (src && src.startsWith('//') ? 'https:' + src : src || null);

/**
 * Thumbnail at 2x the box (width: pixels, 112 for rows): Shopify resizes on request, WordPress has 150x150 and 300x300 sizes by default.
 * The WordPress size can be missing, so pass `safe` when there is no script to fall back to the original.
 */
export function thumb(src, { safe = false, width = 112 } = {}) {
  const url = absolute(src);
  if (!url) return null;
  if (url.includes('cdn.shopify.com')) return url + (url.includes('?') ? '&' : '?') + `width=${width}`;
  // WordPress makes a 300x300 size by default too: big enough for grid covers
  return safe ? url : url.replace(WP_SIZE, width > 150 ? '-300x300$1$2' : '-150x150$1$2');
}
