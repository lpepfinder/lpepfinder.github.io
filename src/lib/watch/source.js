/**
 * Where a watched record comes from, from its item (store.js): the Discogs wantlist (a Discogs release id, or
 * `d`, kept by Discogs), a Radio4000 radio (the tracks it was found for, `p`), or added by hand from the
 * search ("search"). A Discogs want also found for a radio track is both.
 */
export const SOURCES = ['discogs', 'radio', 'search'];

export function sourcesOf(it) {
  const out = [];
  if (it?.w || it?.d) out.push('discogs');
  if (it?.p?.length) out.push('radio');
  return out.length ? out : ['search'];
}

/** Does the item come from this source ("all", or none given, takes every item)? */
export const fromSource = (it, source) => !source || source === 'all' || sourcesOf(it).includes(source);

/** How many items come from each source: { discogs, radio, search }. */
export function countSources(items) {
  const counts = Object.fromEntries(SOURCES.map((s) => [s, 0]));
  for (const it of Object.values(items)) for (const s of sourcesOf(it)) counts[s]++;
  return counts;
}

/** The items of one source, as an object like `items`. */
export const itemsFrom = (items, source) => (!source || source === 'all' ? items
  : Object.fromEntries(Object.entries(items).filter(([, it]) => fromSource(it, source))));

/**
 * The items without one list's records (`source` "discogs" or "radio"): a record that came only from that list
 * goes; one that came from both keeps the other's fields; records added from the search stay. Returns
 * { items, removed }, without changing `items`.
 */
export function forget(items, source) {
  const out = {};
  let removed = 0;
  for (const [key, it] of Object.entries(items)) {
    const from = sourcesOf(it);
    if (!from.includes(source)) { out[key] = it; continue; }
    if (from.length === 1) { removed++; continue; }
    const kept = { ...it };
    // from both: a radio's exact match carries a Discogs id (w) as well, so only Discogs' own mark (d) goes
    if (source === 'discogs') delete kept.d; else delete kept.p;
    // nothing else ties it to Discogs: then it only stays for the radio
    if (source === 'discogs' && !kept.p?.length) { removed++; continue; }
    out[key] = kept;
  }
  return { items: out, removed };
}
