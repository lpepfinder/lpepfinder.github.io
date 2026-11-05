import { releaseKey } from '../search/release-key.js';
import config from '../../../data/watch.json' with { type: 'json' };

/**
 * Discogs wants to release keys. A want comes from the API (basic_information) or a
 * CSV export (Artist, Title, Format columns); both become { title, keys, vinyl }.
 */
const rules = config.discogs;
const VINYL = new Set(rules.vinylFormats);
const CSV_VINYL = new RegExp(rules.csvVinyl, 'i');
const CSV_OTHER = new RegExp(rules.csvNotVinyl, 'i');

/** "Prince (2)" → "Prince"; a trailing "*" marks a name variation in exports. */
export const cleanArtist = (name) => String(name || '').replace(/\s+\(\d+\)\s*$/, '').replace(/\*$/, '').trim();

const credit = (artists, field) => artists.map((a, i) => cleanArtist(a[field] || a.name)
  + (i < artists.length - 1 ? ` ${a.join || ','} ` : '')).join('');

/** Keys to try for one want, the most likely first: full credit by name, by ANV, first artist alone. */
export function wantKeys(artists, title) {
  const lines = [credit(artists, 'name'), credit(artists, 'anv'), cleanArtist(artists[0]?.name), cleanArtist(artists[0]?.anv)];
  if (rules.variousArtists.includes(lines[0])) lines.push(...rules.variousArtists);
  const keys = lines.filter(Boolean).map((a) => releaseKey(`${a} - ${title}`));
  return [...new Set(keys.filter(Boolean))];
}

export function fromApi(want) {
  const b = want.basic_information || {};
  const artists = b.artists || [];
  return {
    title: `${credit(artists, 'name')} – ${b.title || ''}`,
    keys: wantKeys(artists, b.title || ''),
    vinyl: (b.formats || []).some((f) => VINYL.has(f.name)),
  };
}

/** Rows of a CSV text (quoted fields, "" escapes, newlines inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (s[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** Wants from a Discogs wantlist CSV export; null when the columns are missing. */
export function fromCsv(text) {
  const [head = [], ...rows] = parseCsv(text);
  const col = (name) => head.findIndex((h) => h.trim().toLowerCase() === name);
  const [a, t, f] = ['artist', 'title', 'format'].map(col);
  if (a < 0 || t < 0) return null;
  return rows.map((r) => {
    const format = f < 0 ? '' : r[f] || '';
    return {
      title: `${cleanArtist(r[a])} – ${r[t]}`,
      keys: wantKeys([{ name: r[a] }], r[t] || ''),
      vinyl: !format || (CSV_VINYL.test(format) && !CSV_OTHER.test(format)),
    };
  });
}
