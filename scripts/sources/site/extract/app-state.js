/**
 * Server-rendered state of JS frameworks: Nuxt 3 (__NUXT_DATA__, devalue format)
 * and Next (__NEXT_DATA__). A generic walk finds every object with a title and a price.
 * Only what the page itself publishes is read: no private APIs.
 */
const WRAP = /^(Shallow)?(Reactive|Ref)$|^EmptyRef$|^Set$|^Map$|^Date$/;

/** Revive Nuxt's devalue array: values reference other entries by index. */
export function reviveDevalue(arr) {
  const memo = new Map();
  const rev = (i) => {
    if (typeof i !== 'number' || i < 0) return undefined;
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && WRAP.test(v[0])) { const r = rev(v[1]); memo.set(i, r); return r; }
      const out = []; memo.set(i, out);
      for (const x of v) out.push(rev(x));
      return out;
    }
    if (v && typeof v === 'object') {
      const out = {}; memo.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = rev(x);
      return out;
    }
    memo.set(i, v);
    return v;
  };
  return rev(0);
}

export function appState(html) {
  const nuxt = html.match(/<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nuxt) try { return { kind: 'nuxt', data: reviveDevalue(JSON.parse(nuxt[1])) }; } catch { /* not devalue */ }
  const next = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) try { return { kind: 'next', data: JSON.parse(next[1]) }; } catch { /* broken json */ }
  return null;
}

const AMOUNT = /^\d+([.,]\d+)?$/;
const num = (v) => Number(String(v).replace(',', '.'));

function priceOf(o) {
  for (const k of ['price', 'priceGross', 'salePrice', 'amount', 'gross']) {
    const p = o[k];
    if (p == null) continue;
    if (typeof p === 'number' || AMOUNT.test(p)) return { price: num(p), currency: o.currency || o.priceCurrency || null };
    if (typeof p === 'object') {
      const v = p.gross ?? p.amount ?? p.value ?? p.price ?? p.raw;
      if (v != null && AMOUNT.test(String(v))) return { price: num(v), currency: p.currency || p.currencyCode || o.currency || null };
    }
  }
  return null;
}

const OUT = /^(out|sold|soldout|sold_out|out_?of_?stock|deleted|unavailable|false|no|0)$/i;
const str = (v) => (typeof v === 'string' && v ? v : null);

function normalize(o, kind, p) {
  const artist = str(o.artist) || o.artist?.name || (o.title && str(o.name) && o.name !== o.title ? o.name : null);
  const avail = o.availability?.status ?? o.availability ?? o.stockStatus ?? o.inStock ?? o.available ?? o.stock;
  return {
    via: kind,
    slug: str(o.slug) || str(o.handle),
    url: str(o.url) || str(o.permalink) || str(o.href) || str(o.absoluteUrl) || null,
    title: artist ? `${artist} - ${o.title}` : o.title || o.name,
    price: p.price,
    currency: p.currency,
    inStock: avail == null || typeof avail === 'object' ? null : typeof avail === 'boolean' ? avail : typeof avail === 'number' ? avail > 0 : !OUT.test(String(avail)),
    image: o.smallImageUrl || o.thumbnailUrl || o.image?.url || str(o.image),
    format: str(o.format) || str(o.format?.name),
  };
}

/** Every product-like object (title/name + price) in the state, deduplicated by slug/title. */
export function productsFromState(state) {
  if (!state) return [];
  const out = new Map();
  const seen = new Set();
  const stack = [state.data];
  while (stack.length) {
    const o = stack.pop();
    if (!o || typeof o !== 'object' || seen.has(o)) continue;
    seen.add(o);
    if (!Array.isArray(o)) {
      const title = o.title || o.name;
      const p = typeof title === 'string' && priceOf(o);
      if (p && p.price > 0) { const n = normalize(o, state.kind, p); out.set(n.slug || n.url || n.title, n); }
    }
    for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') stack.push(v);
  }
  return [...out.values()];
}

/** The page's own product: the item whose slug is the URL's last path segment. */
export function productFromState(items, url) {
  const slug = decodeURIComponent(new URL(url).pathname.replace(/\/$/, '').split('/').pop() || '');
  return items.find((i) => i.slug && i.slug === slug) || null;
}
