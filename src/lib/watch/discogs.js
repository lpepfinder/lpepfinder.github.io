/**
 * A collector's Discogs wantlist, read in the browser: from the public API by username
 * (the wantlist must be public), or from the CSV file Discogs exports. Only the wantlist is read;
 * nothing is sent anywhere else. A want: { id, artist, title, catno, rating, thumb } (thumb: cover image, API only).
 */
import config from '../../../data/watch.json' with { type: 'json' };

const API = 'https://api.discogs.com';
const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

/** "Moodymann (2)" -> "Moodymann": Discogs numbers artists who share a name. */
export const artistName = (name) => String(name || '').replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim();

/** Artists of a release joined the way Discogs shows them ("A & B", "A Feat. B"). */
export function artistsOf(artists = []) {
  return artists.map((a, i) => artistName(a.anv || a.name) + (i < artists.length - 1 ? (a.join && a.join !== ',' ? ` ${a.join} ` : ', ') : '')).join('');
}

export function fromApi(w) {
  const b = w.basic_information || {};
  return {
    id: b.id || w.id, artist: artistsOf(b.artists), title: b.title || '',
    catno: b.labels?.[0]?.catno || '', rating: w.rating || 0, thumb: b.thumb || '',
  };
}

export class DiscogsError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Every want of a public wantlist, page by page (config.discogsPerPage). onPage(wants, { page, pages })
 * gets each page as it arrives, so a long list can be used before it is complete. Requests are paced
 * under the API's limit for anonymous use (config.discogsPaceMs); a 429 waits and retries.
 * Throws DiscogsError: "not-found" (no such user), "private" (wantlist not public), "network".
 */
export async function fetchWantlist(username, { onPage, signal } = {}) {
  const user = encodeURIComponent(username.trim().replace(/^.*discogs\.com\/(?:user\/)?/i, '').replace(/\/.*$/, ''));
  let page = 1;
  let pages = 1;
  let total = 0;
  while (page <= pages) {
    let res;
    try {
      res = await fetch(`${API}/users/${user}/wants?per_page=${config.discogsPerPage}&page=${page}`, { signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new DiscogsError('network');
    }
    if (res.status === 429) { await wait(config.discogsRetryMs, signal); continue; }
    if (res.status === 404) throw new DiscogsError('not-found');
    if (res.status === 401 || res.status === 403) throw new DiscogsError('private');
    if (!res.ok) throw new DiscogsError('network');
    const body = await res.json();
    pages = body.pagination?.pages || 1;
    const wants = (body.wants || []).map(fromApi);
    total += wants.length;
    onPage?.(wants, { page, pages });
    page++;
    if (page <= pages) await wait(config.discogsPaceMs, signal);
  }
  return total;
}

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks. */
export function csvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some(Boolean));
}

/**
 * Wants from a Discogs CSV export (Wantlist → Export): columns found by name
 * ("Catalog#", "Artist", "Title", "release_id", "Rating"). Null when the file isn't one.
 */
export function fromCsv(text) {
  const [head, ...rows] = csvRows(text.replace(/^﻿/, ''));
  const col = (name) => head?.findIndex((h) => h.trim().toLowerCase() === name);
  const at = { catno: col('catalog#'), artist: col('artist'), title: col('title'), id: col('release_id'), rating: col('rating') };
  if (at.artist < 0 || at.title < 0) return null;
  return rows.map((r) => ({
    id: Number(r[at.id]) || null, artist: artistName(r[at.artist]), title: r[at.title] || '',
    catno: at.catno >= 0 ? r[at.catno] : '', rating: Number(r[at.rating]) || 0,
  })).filter((w) => w.title);
}
