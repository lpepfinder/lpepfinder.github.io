import { findArtist, artist } from './musicbrainz.js';
import { item, qid, summary, image } from './wikimedia.js';
import { albumTitles } from './titles.js';

/**
 * One artist's profile from the open sources (docs/sources.md), shaped for the artist page and its JSON:
 *   { status: "ok", at, mbid, name, type, country, begin, end, disambiguation, genres,
 *     summary: { <lang>: { text, title, url } }, image: { src, width, height, page, author, license, licenseUrl },
 *     links: { musicbrainz, wikidata, wikipedia: { <lang>: url }, website, discogs, youtube, bluesky }, sources: [...] }
 * or { status: "none", at } when no album of theirs was found on MusicBrainz.
 * `override` (data/enrich/artists.json): { mbid } to name the artist, { hide: true } to show no profile.
 */
export async function profile({ name, listings }, override = {}, opts) {
  const at = new Date().toISOString();
  if (override.hide) return { status: 'hidden', at };
  const mbid = override.mbid || await findArtist(name, albumTitles(listings, name, opts.titlesPerArtist, opts.exclude));
  const mb = mbid && await artist(mbid, { genres: opts.genres });
  if (!mb) return { status: 'none', at };
  const sources = ['musicbrainz'];
  const id = qid(mb.links.wikidata);
  const wd = id ? await item(id, opts.wikipediaLanguages) : null;
  if (wd) sources.push('wikidata');
  const summaries = {};
  for (const [lang, title] of Object.entries(wd?.wikipedia || {})) {
    const s = await summary(lang, title);
    if (s) summaries[lang] = s;
  }
  if (Object.keys(summaries).length) sources.push('wikipedia');
  const file = wd?.image || decodeURIComponent(mb.links.image?.match(/\/File:(.+)$/)?.[1] || '') || null;
  const img = file ? await image(file.replace(/_/g, ' '), opts.imageWidth) : null;
  if (img) sources.push('commons');
  return {
    status: 'ok', at, mbid: mb.mbid, name: mb.name, type: mb.type, country: mb.country, begin: mb.begin, end: mb.end,
    disambiguation: mb.disambiguation, genres: mb.genres, summary: summaries, image: img,
    links: {
      musicbrainz: `https://musicbrainz.org/artist/${mb.mbid}`,
      wikidata: id ? `https://www.wikidata.org/wiki/${id}` : null,
      wikipedia: Object.fromEntries(Object.entries(summaries).map(([l, s]) => [l, s.url])),
      website: mb.links.website || wd?.website || null,
      discogs: mb.links.discogs || (wd?.discogs ? `https://www.discogs.com/artist/${wd.discogs}` : null),
      youtube: wd?.youtube ? `https://www.youtube.com/channel/${wd.youtube}` : mb.links.youtube || null,
      bluesky: wd?.bluesky ? `https://bsky.app/profile/${wd.bluesky}` : mb.links.bluesky || null,
    },
    sources,
  };
}
