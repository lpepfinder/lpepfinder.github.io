/** Sort and filters of the watch page, kept in this browser ("vf.watch.filters"); every access guarded. */
import { scoped } from '../lib/watch/profiles.js';

const KEY = () => scoped('vf.watch.filters');
const DEFAULTS = { sort: 'new', ships: true, customs: false, max: '' };

export function readFilters() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY())) }; } catch { return { ...DEFAULTS }; }
}

export function saveFilters(values) {
  try { localStorage.setItem(KEY(), JSON.stringify(values)); } catch {}
}
