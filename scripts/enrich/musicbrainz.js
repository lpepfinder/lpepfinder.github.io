import { json } from './http.js';
import { norm } from './titles.js';

/**
 * MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API): no key, one request a second, CC0 core data.
 * An artist is found through one of its albums: a release group titled like one of its records in stock,
 * credited to an artist of that exact name. Names alone are never trusted (there are five Nirvanas).
 */
const API = 'https://musicbrainz.org/ws/2';
const q = (s) => `"${String(s).replace(/["\\]/g, ' ')}"`;
const MIN_SCORE = 90;

/** The MBID of `name` through these album titles: the one most albums agree on; null when none matched. */
export async function findArtist(name, titles) {
  const votes = new Map();
  for (const title of titles) {
    const data = await json(`${API}/release-group?query=${encodeURIComponent(`releasegroup:${q(title)} AND artist:${q(name)}`)}&fmt=json&limit=5`);
    for (const rg of data?.['release-groups'] || []) {
      if (rg.score < MIN_SCORE || norm(rg.title) !== norm(title)) continue;
      const credit = (rg['artist-credit'] || []).find((c) => norm(c.artist?.name) === norm(name) || norm(c.name) === norm(name));
      if (credit) votes.set(credit.artist.id, (votes.get(credit.artist.id) || 0) + 1);
    }
    // one clear album is enough: spare MusicBrainz the other requests
    if (votes.size === 1) break;
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

const LINKS = { 'official homepage': 'website', discogs: 'discogs', wikidata: 'wikidata', youtube: 'youtube', image: 'image' };

/** The artist: type, country, years, genres (most votes first) and links by kind; null when not found. */
export async function artist(mbid, { genres = 5 } = {}) {
  const a = await json(`${API}/artist/${mbid}?inc=url-rels+genres&fmt=json`);
  if (!a?.id) return null;
  const links = {};
  for (const r of a.relations || []) {
    const url = r.url?.resource;
    if (!url || r.ended) continue;
    const kind = LINKS[r.type] || (r.type === 'social network' && /bsky\.app\/profile\//.test(url) ? 'bluesky' : null);
    if (kind && !links[kind]) links[kind] = url;
  }
  return {
    mbid: a.id, name: a.name, type: a.type || null, country: a.country || null, disambiguation: a.disambiguation || null,
    begin: a['life-span']?.begin || null, end: a['life-span']?.ended ? a['life-span'].end || null : null,
    genres: (a.genres || []).sort((x, y) => y.count - x.count).slice(0, genres).map((g) => g.name),
    links,
  };
}
