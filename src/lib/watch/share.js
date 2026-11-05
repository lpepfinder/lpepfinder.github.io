/**
 * Watchlist share links: release keys (12 hex = 6 bytes each) packed as base64url in the
 * URL fragment, /watch/#w=…, which browsers never send to the server.
 */
const HEX = /^[0-9a-f]{12}$/;

export function encodeKeys(keys) {
  const hex = keys.filter((k) => HEX.test(k)).join('');
  const bytes = hex.match(/../g)?.map((h) => String.fromCharCode(parseInt(h, 16))).join('') || '';
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeKeys(text) {
  try {
    const bytes = atob(String(text).replace(/-/g, '+').replace(/_/g, '/'));
    const hex = [...bytes].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return [...new Set(hex.match(/.{12}/g) || [])];
  } catch {
    return [];
  }
}

/** Keys from a location hash like "#w=…". */
export const keysFromHash = (hash) => decodeKeys(new URLSearchParams(String(hash).replace(/^#/, '')).get('w') || '');

/** Release keys and titles from an exported file: { items: { key: { t } } } or a bare key array. */
export function parseExport(text) {
  const data = JSON.parse(text);
  const items = Array.isArray(data) ? Object.fromEntries(data.map((k) => [k, {}])) : data?.items || {};
  return Object.entries(items).filter(([k]) => HEX.test(k)).map(([key, v]) => ({ key, title: v?.t || '', state: v?.s }));
}
