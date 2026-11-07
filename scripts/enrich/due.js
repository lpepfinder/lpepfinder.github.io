/**
 * Which artists to profile now, in order: never profiled (most popular first, the order given), an override that
 * names another artist, then the oldest profiles past their age (refreshDays; retryNoneDays when none was found).
 */
export function due(artists, cached, overrides, { refreshDays, retryNoneDays }, now = Date.now()) {
  const fresh = [];
  const stale = [];
  for (const a of artists) {
    const c = cached[a.slug];
    const o = overrides[a.slug] || {};
    if (!c || (o.mbid && c.override !== o.mbid) || (!!o.hide !== (c.status === 'hidden'))) { fresh.push(a); continue; }
    const days = c.status === 'none' ? retryNoneDays : refreshDays;
    if (now - Date.parse(c.at) > days * 864e5) stale.push([Date.parse(c.at), a]);
  }
  return [...fresh, ...stale.sort((x, y) => x[0] - y[0]).map(([, a]) => a)];
}
