/**
 * Numbers of past builds, kept as health.json in the "data" release: { days: { "YYYY-MM-DD": numbers } }.
 * A second build on the same day replaces that day's numbers, and is still compared with the day before.
 */

/** The numbers of the latest day before `day`, with their day, or null. */
export function previousDay(history, day) {
  const days = Object.keys(history?.days || {}).filter((d) => d < day).sort();
  const last = days.at(-1);
  return last ? { day: last, ...history.days[last] } : null;
}

/** History with today's numbers, keeping the last `keepDays` days. */
export function record(history, day, numbers, keepDays) {
  const days = { ...(history?.days || {}), [day]: numbers };
  const kept = Object.keys(days).sort().slice(-keepDays);
  return { days: Object.fromEntries(kept.map((d) => [d, days[d]])) };
}
