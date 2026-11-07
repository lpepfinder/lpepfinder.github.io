/**
 * How to check a shop today (data/config.json `check`), so shops get no requests they don't need:
 *   "full"   the whole check (home page, robots.txt, platform probe, Bluesky): new shops, the weekly one
 *            (fullDays), the day after a failed crawl, a shop whose catalog address changed
 *   "light"  robots.txt only, for shops alive at their last full check: an opt-out still counts the next day
 *   "skip"   nothing today: dead shops wait longer each time (half the days they've been dead, 1 to deadMaxDays);
 *            shops that refuse bots, and other states (blocked, moved, not music), wait for their weekly check
 */
const DAY = 864e5;
const ALIVE = new Set(['ok', 'listed']);

export function checkKind(prev, { source, crawlError = false, now = Date.now(), fullDays, deadMaxDays }) {
  if (!prev?.checkedAt || (prev.source && prev.source !== source)) return 'full';
  const days = (now - Date.parse(prev.checkedAt)) / DAY;
  if (prev.status === 'dead') {
    const dead = prev.deadSince ? (now - Date.parse(prev.deadSince)) / DAY : 0;
    return days >= Math.min(Math.max(1, dead / 2), deadMaxDays) ? 'full' : 'skip';
  }
  if (days >= fullDays || crawlError) return 'full';
  // a site refusing bots refuses its robots.txt too: asking daily would only repeat the refusal
  return ALIVE.has(prev.status) && !String(prev.reason || '').startsWith('bot_protection') ? 'light' : 'skip';
}
