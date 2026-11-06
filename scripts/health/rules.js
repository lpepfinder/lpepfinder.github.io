/**
 * Is the site healthy? Today's numbers against those of the last build of an earlier day.
 * numbers: { records, inStock, shops, siteMB, crawl: { shops, errors, finishedAt }, e2e: "success|failure|skipped|cancelled" }
 * (any of them null or missing when unknown: a number we don't have is not a problem by itself).
 * settings: data/config.json "health". Returns { degraded, problems: [{ id, text }] }.
 */
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const fmt = (n) => Number(n).toLocaleString('en');
const drop = (now, before) => (before > 0 && now != null ? (before - now) / before : 0);

export function assess(today, previous, settings, at = new Date()) {
  const problems = [];
  const add = (id, text) => problems.push({ id, text });

  if (!(today.records > 0)) add('index', 'No search index: the build wrote no records.');
  const records = drop(today.records, previous?.records);
  if (today.records > 0 && records > settings.recordsDropMax) {
    add('records', `Records down ${pct(records)} since ${previous.day}: ${fmt(previous.records)} → ${fmt(today.records)} (limit ${pct(settings.recordsDropMax)}).`);
  }
  const shops = drop(today.shops, previous?.shops);
  if (today.records > 0 && shops > settings.shopsDropMax) {
    add('shops', `Searchable shops down ${pct(shops)} since ${previous.day}: ${fmt(previous.shops)} → ${fmt(today.shops)} (limit ${pct(settings.shopsDropMax)}).`);
  }
  if (today.siteMB > settings.siteMaxMB) add('size', `Site is ${fmt(today.siteMB)} MB (limit ${fmt(settings.siteMaxMB)} MB; GitHub Pages stops at 1 GB).`);

  const crawl = today.crawl;
  if (crawl?.shops > 0 && crawl.errors / crawl.shops > settings.crawlErrorMax) {
    add('crawl', `Crawl failed for ${fmt(crawl.errors)} of ${fmt(crawl.shops)} shops (${pct(crawl.errors / crawl.shops)}, limit ${pct(settings.crawlErrorMax)}).`);
  }
  if (crawl?.finishedAt) {
    const hours = (at - new Date(crawl.finishedAt)) / 36e5;
    if (hours > settings.crawlMaxAgeHours) add('crawl-age', `Last crawl finished ${Math.round(hours)} hours ago (${crawl.finishedAt}); limit ${settings.crawlMaxAgeHours} hours.`);
  }

  if (today.e2e === 'failure') add('e2e', 'End-to-end tests failed: the site was not deployed (the Playwright report is attached to the run).');
  else if (today.e2e && today.e2e !== 'success') add('e2e', `End-to-end tests did not run (${today.e2e}): the site was not deployed.`);

  return { degraded: problems.length > 0, problems };
}

/**
 * What to do with the health issue: open one when degraded and none is open, else update the open one;
 * when healthy, close the open one. open: numbers of the open issues with the label (oldest first),
 * so a duplicate made by hand is never multiplied: only the first one is used.
 */
export function issueAction(degraded, open) {
  const number = open[0] ?? null;
  if (degraded) return number ? { action: 'update', number } : { action: 'create', number: null };
  return number ? { action: 'close', number } : { action: 'none', number: null };
}
