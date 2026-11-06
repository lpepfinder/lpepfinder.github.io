/** Tiny DOM helpers for the browser components. */
export const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

/** Set attributes (null/undefined removes); returns the node. */
export const attrs = (node, values) => {
  for (const [k, v] of Object.entries(values)) v == null ? node.removeAttribute(k) : node.setAttribute(k, v);
  return node;
};

/**
 * A listener on window or document that ends when `host` (a custom element) leaves the page: with client-side
 * navigation the page's elements go but the window stays, so listeners must not outlive their component.
 * The host's disconnectedCallback calls unlisten(this).
 */
export function listen(host, target, type, fn, opts = {}) {
  host.listening ??= new AbortController();
  target.addEventListener(type, fn, { ...opts, signal: host.listening.signal });
}

export function unlisten(host) {
  host.listening?.abort();
  host.listening = null;
}
