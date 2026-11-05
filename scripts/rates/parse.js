/** ECB reference rates XML (eurofxref-daily.xml) -> { date, rates: { USD: 1.12, … } } (1 EUR = rate), or null. */
export function parseEcb(xml) {
  const s = String(xml || '');
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(s)?.[1];
  const rates = {};
  for (const [, code, rate] of s.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const n = Number(rate);
    if (n > 0) rates[code] = n;
  }
  return date && Object.keys(rates).length ? { date, rates } : null;
}
