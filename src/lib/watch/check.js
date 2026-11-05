import { load, update, today } from './store.js';
import { plan, fromEvents, fromState, state } from './diff.js';
import * as data from './data.js';

const MAX_CHANGES = 200;

/** At most once a UTC day, and only with a non-empty list. */
export const due = (list = load()) => list.day !== today() && Object.keys(list.items).length > 0;

/**
 * Read the daily event files since the last check (or `now` shards for new items and
 * after a long absence), store the changes, and return the list.
 */
export async function check() {
  const idx = await data.index();
  if (!idx?.dates) return load();
  const dates = [...idx.dates].sort();
  const before = load();
  const p = plan(before.items, before.last, dates);
  const [days, shards] = await Promise.all([
    Promise.all(p.dates.map(async (d) => fromEvents(await data.day(d), d, p.events))),
    p.shards.length ? data.now(p.shards) : {},
  ]);
  const date = dates.at(-1) || today();
  return update((list) => {
    const changes = days.flat();
    for (const key of p.shards) {
      const item = list.items[key];
      if (!item) continue;
      if (!p.events.has(key)) {
        const change = fromState(key, item, shards[key], date);
        if (change) changes.push(change);
      }
      item.s = state(shards[key]);
    }
    // events carry title and url: fill items that came without them (share links)
    for (const c of changes) {
      const item = list.items[c[0]];
      if (item && !item.t) item.t = c[5];
      if (item && !item.u) item.u = c[6];
    }
    list.changes = [...list.changes, ...changes.filter((c) => list.items[c[0]])].slice(-MAX_CHANGES);
    list.last = date;
    list.day = today();
  });
}
