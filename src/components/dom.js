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
