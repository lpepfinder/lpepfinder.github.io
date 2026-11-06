/** The last searches that found something, in this browser only (localStorage "vf.recent", newest first). */
const KEY = 'vf.recent';
const MAX = 5;
export const RECENT_EVENT = 'vf-recent-change';

export function recent() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  dispatchEvent(new Event(RECENT_EVENT));
}

export const addRecent = (q) => save([q, ...recent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX));
export const clearRecent = () => save([]);
export const removeRecent = (q) => save(recent().filter((x) => x !== q));
