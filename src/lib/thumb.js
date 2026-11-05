/** Product images for 56 px record cards; shared by <vf-result> (browser) and ResultCard.astro (build). */
const WP_SIZE = /-\d{3,4}x\d{3,4}(\.(?:jpe?g|png|webp))(\?|$)/i;

/** Protocol-relative URLs ("//host/x.jpg") made absolute. */
export const absolute = (src) => (src && src.startsWith('//') ? 'https:' + src : src || null);

/**
 * Thumbnail at 2x the box: Shopify resizes on request, WordPress has a 150x150 size by default.
 * The WordPress size can be missing, so pass `safe` when there is no script to fall back to the original.
 */
export function thumb(src, { safe = false } = {}) {
  const url = absolute(src);
  if (!url) return null;
  if (url.includes('cdn.shopify.com')) return url + (url.includes('?') ? '&' : '?') + 'width=112';
  return safe ? url : url.replace(WP_SIZE, '-150x150$1$2');
}
