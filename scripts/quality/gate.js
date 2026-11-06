import { REASONS, checkDoc, priceEur, suspectShops } from './checks.js';

/**
 * The quality gate of the build: checks docs (checks.js), leaves out the excluded ones, removes wrong prices
 * (price: null, priceFlag: reason, so the ledger forgets the price too) and keeps counts and samples for the report.
 * Suspect shops are found once, from the docs given here (today's catalog); filter() can then run on more
 * docs (the ledger's gone offers) with the same rules.
 * ctx: { rates, settings (config.quality), currencyOf(doc), isMusic(text) }
 */
export function qualityGate(docs, { rates, settings, currencyOf, isMusic }) {
  const suspect = suspectShops(docs, { rates, settings, currencyOf });
  const testTitle = new RegExp(settings.testTitle, 'i');
  const counts = Object.fromEntries(Object.keys(REASONS).map((r) => [r, 0]));
  const samples = {};
  let checked = 0;

  const flag = (d, reason) => {
    counts[reason]++;
    const list = samples[reason] || (samples[reason] = []);
    const currency = currencyOf(d) || null;
    if (list.length < settings.samples) list.push({ shop: d.shop, title: d.title || null, path: d.path || null, price: d.price ?? null, currency, eur: priceEur(d.price, currency, rates) });
  };

  /** Docs that pass, with wrong prices removed in place. */
  const filter = (list) => list.filter((d) => {
    checked++;
    const reason = checkDoc(d, { rates, settings, currency: currencyOf(d), suspect, testTitle, isMusic });
    if (!reason) return true;
    flag(d, reason);
    if (REASONS[reason] === 'exclude') return false;
    d.price = null;
    d.priceFlag = reason;
    return true;
  });

  const total = (action) => Object.entries(counts).reduce((n, [r, c]) => n + (REASONS[r] === action ? c : 0), 0);
  /** generated/quality-report.json */
  const report = () => ({
    checked,
    excluded: total('exclude'),
    pricesRemoved: total('no-price'),
    counts,
    suspectShops: [...suspect.values()],
    samples,
    settings: Object.fromEntries(Object.entries(settings).filter(([k]) => k !== 'description')),
  });
  /** One line for the build log. */
  const summary = () => {
    const r = report();
    const parts = Object.entries(r.counts).filter(([, c]) => c).map(([k, c]) => `${k} ${c}`).join(', ');
    return `quality: ${r.checked} docs, ${r.excluded} left out, ${r.pricesRemoved} prices removed (${parts || 'nothing flagged'}); suspect shops: ${r.suspectShops.map((s) => `${s.shop} (${s.currency}, median €${s.medianEur})`).join(', ') || 'none'}`;
  };
  return { suspect, filter, report, summary };
}
