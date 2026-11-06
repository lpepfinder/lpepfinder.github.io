/** The health issue's text: what is wrong, then today's numbers next to the previous day's. */
const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString('en'));

export function report({ day, today, previous, result, runUrl }) {
  const rows = [
    ['Records', today.records, previous?.records],
    ['In stock', today.inStock, previous?.inStock],
    ['Searchable shops', today.shops, previous?.shops],
    ['Site size (MB)', today.siteMB, previous?.siteMB],
    ['Crawl errors', today.crawl?.errors, previous?.crawl?.errors],
  ];
  return [
    result.degraded ? `Site health on ${day}: **degraded**.` : `Site health on ${day}: healthy.`,
    '',
    ...result.problems.map((p) => `- ${p.text}`),
    ...(result.problems.length ? [''] : []),
    `| | ${day} | ${previous?.day || 'before'} |`,
    '|---|---:|---:|',
    ...rows.map(([label, now, before]) => `| ${label} | ${fmt(now)} | ${fmt(before)} |`),
    `| End-to-end tests | ${today.e2e || '–'} | ${previous?.e2e || '–'} |`,
    ...(runUrl ? ['', `Run: ${runUrl}`] : []),
    '',
    'Thresholds: `health` in data/config.json. This issue is updated by each deploy and closed when the site is healthy again.',
  ].join('\n');
}
