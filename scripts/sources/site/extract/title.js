/** Remove the shop name a page title carries ("Artist - Title | Shop Name"). */
const key = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const TAIL = /^(.*\S)\s+(?:\||–|—|·|•|::|-|:)\s+([^|–—·•]+)$/;
const HEAD = /^([^|–—·•]+?)\s+(?:\||–|—|·|•|::)\s+(.*\S)$/;

const matches = (part, names) => {
  const p = key(part);
  if (p.length < 3) return false;
  return names.some((n) => p === n || (n.length >= 4 && p.includes(n)) || (n.includes(p) && p.length >= 0.8 * n.length));
};

/** `names`: shop name variants (curated name, name read from the site, host without TLD). */
export function stripShopName(title, names = []) {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  const keys = [...new Set(names.map(key).filter((k) => k.length >= 3))];
  if (!t || !keys.length) return t;
  for (let i = 0; i < 2; i++) {
    const m = t.match(TAIL);
    if (!m || !matches(m[2], keys)) break;
    t = m[1];
  }
  const h = t.match(HEAD);
  if (h && matches(h[1], keys)) t = h[2];
  return t;
}

/** Name variants of a shop to strip from titles. */
export function shopNames({ id = '', name, siteName } = {}) {
  const host = id.replace(/^(www|shop|store)\./, '').split('.')[0];
  const names = [name, siteName, host];
  for (const n of [name, siteName]) if (n) names.push(...String(n).split(/\s+[-–—|·•:]\s+/));
  return names.filter(Boolean);
}
