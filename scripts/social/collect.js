/**
 * What the feed is made of, from the published lists (pure, tested): the counts per record, the records each
 * collector started wanting since the last run, the most wanted.
 *   collectors: [{ did, handle, wants: Map key -> title, owned: [key], ... }]
 *   before: { did: [key] } (wants at the last run); events: [[date, did, key, title]] kept from the last runs
 */
export function build(collectors, before, events, { today, eventDays, maxEvents, topWanted }) {
  const wanted = {};
  const owned = {};
  const titles = {};
  const fresh = [];
  for (const c of collectors) {
    const had = before[c.did] ? new Set(before[c.did]) : null;
    for (const [key, title] of c.wants) {
      wanted[key] = (wanted[key] || 0) + 1;
      if (title && !titles[key]) titles[key] = title;
      // a collector seen before: what is new in their list since then (a new collector's whole list isn't news)
      if (had && !had.has(key)) fresh.push([today, c.did, key, title]);
    }
    for (const key of c.owned) owned[key] = (owned[key] || 0) + 1;
  }
  const since = new Date(Date.parse(today) - eventDays * 864e5).toISOString().slice(0, 10);
  const dids = new Set(collectors.map((c) => c.did));
  // earlier news, within eventDays, of collectors still publishing; a second run the same day keeps the first's
  const seen = new Set(fresh.map(([, did, key]) => `${did} ${key}`));
  const kept = [...fresh, ...events.filter(([date, did, key]) => date >= since && dids.has(did) && !seen.has(`${did} ${key}`))].slice(0, maxEvents);
  const top = Object.entries(wanted).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, topWanted).map(([k]) => k);
  return {
    wanted, owned, events: kept, top,
    titles: Object.fromEntries([...new Set([...top, ...kept.map((e) => e[2])])].map((k) => [k, titles[k] || ''])),
    state: Object.fromEntries(collectors.map((c) => [c.did, [...c.wants.keys()]])),
  };
}
