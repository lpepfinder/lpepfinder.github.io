/** UTC calendar days as "YYYY-MM-DD" strings: they sort and compare as text. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today in UTC, or LEDGER_DATE (for tests and replays). */
export function today(env = process.env) {
  const day = env.LEDGER_DATE || new Date().toISOString().slice(0, 10);
  if (!DAY.test(day)) throw new Error(`LEDGER_DATE must be YYYY-MM-DD, got "${day}"`);
  return day;
}

export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
