/**
 * Records in stock for a radio's tracks (radio.js). A track with a Discogs link is an exact want (looked up
 * on Discogs); otherwise its "Artist – Song" is searched in the index and a record counts when its title
 * holds the artist's and the song's words: the single or the album with that song, a guess to confirm.
 */
import { SearchClient } from '../search/client.js';
import { addToGroups } from '../search/group.js';
import { normalize, tokenize } from '../search/tokenize.js';
import { songOf, discogsRef } from './radio.js';
import { splitTitle } from '../search/title.js';

let client = null;

const words = (s) => tokenize(s).filter((w) => w.length > 1);

/**
 * Is a listing this song's record? The artist's whole name is in the listing's artist part (as a phrase:
 * "Q Project" is not "The Alan Parsons Project"), and every word of the song is in its title.
 */
export function holds(title, { artist, song }) {
  const t = ` ${normalize(title)} `;
  const who = ` ${normalize(splitTitle(title).artist || title)} `;
  return who.includes(` ${normalize(artist)} `) && words(song).every((w) => t.includes(` ${w} `));
}

/**
 * Candidates for each track, in the radio's order: { track, ref } for a Discogs link,
 * { track, song, groups: [{ key, title, offers }] } for a song found on records in stock.
 * onProgress(done, total) after each track.
 */
export async function matchRadio(tracks, { maxCandidates = 3, onProgress } = {}) {
  client ??= new SearchClient();
  const out = [];
  let done = 0;
  for (const track of tracks) {
    const ref = discogsRef(track.discogsUrl);
    const song = !ref && songOf(track.title);
    if (ref) out.push({ track, ref });
    else if (song) {
      const q = `${song.artist} ${song.song}`;
      const ids = await client.match(q).catch(() => []);
      if (ids.length) {
        const order = await client.rank(ids, q);
        const groups = new Map();
        addToGroups(groups, await client.records(order.slice(0, 60)));
        const found = [...groups.values()]
          .filter((g) => g.watchKey && g.offers.some((o) => o.available) && holds(g.offers[0].title, song))
          .slice(0, maxCandidates)
          .map((g) => ({ key: g.watchKey, title: g.offers[0].title, offers: g.offers.filter((o) => o.available) }));
        if (found.length) out.push({ track, song, groups: found });
      }
    }
    onProgress?.(++done, tracks.length);
  }
  return out;
}
