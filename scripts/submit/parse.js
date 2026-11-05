/**
 * Read a GitHub issue form body ("### Label\n\nvalue" blocks) into an object
 * keyed by the form field labels of .github/ISSUE_TEMPLATE/shop.yml.
 */
export function parseIssueForm(body = '') {
  const fields = {};
  for (const block of body.split(/^###\s+/m).slice(1)) {
    const [label, ...rest] = block.split('\n');
    const value = rest.join('\n').trim();
    fields[label.trim()] = value === '_No response_' ? '' : value;
  }
  return fields;
}

/** Country name or code ("Germany (DE)", "de", "France") -> ISO code, or null. */
export function countryFrom(text, codeOf) {
  const code = String(text || '').match(/\b([A-Za-z]{2})\b\)?\s*$/)?.[1]?.toUpperCase();
  return (code && codeOf(code) && code) || codeOf(String(text || '').replace(/\(.*\)/, '').trim()) || null;
}
