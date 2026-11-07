import path from 'node:path';
import { readJson } from '../../scripts/lib/json.js';
import { DATA, GENERATED } from '../../scripts/lib/paths.js';

/**
 * Artist profiles from open sources (scripts/enrich, docs/sources.md), read once per build:
 * generated/enrich/artists.json (from the Enrich workflow), less those hidden in data/enrich/artists.json.
 */
let cached;
const load = () => {
  if (cached) return cached;
  const all = readJson(path.join(GENERATED, 'enrich', 'artists.json'), { artists: {} }).artists;
  const overrides = readJson(path.join(DATA, 'enrich', 'artists.json'), {});
  cached = new Map(Object.entries(all).filter(([slug, p]) => p.status === 'ok' && !overrides[slug]?.hide));
  return cached;
};

/** The profile of an artist page, or null. */
export const artistProfile = (slug) => load().get(slug) || null;

/** Licences of the sources, as the page and the JSON credit them. */
export const SOURCES = {
  musicbrainz: { name: 'MusicBrainz', url: 'https://musicbrainz.org/', license: 'CC0' },
  wikidata: { name: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0' },
  wikipedia: { name: 'Wikipedia', url: 'https://www.wikipedia.org/', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  commons: { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/' },
};

/** Every address of the artist elsewhere, for schema.org sameAs. */
export const sameAs = (p) => [p.links.musicbrainz, p.links.wikidata, ...Object.values(p.links.wikipedia || {}), p.links.website, p.links.discogs, p.links.youtube, p.links.bluesky].filter(Boolean);

/**
 * The years of a profile (begin and end are dates of any precision): "1965–", "1947–2016", or { born: "1941" }
 * for a living person (the page says "born 1941"); null without a beginning.
 */
export function years(p) {
  const [begin, end] = [p.begin, p.end].map((d) => d?.slice(0, 4) || null);
  if (!begin) return null;
  if (p.type === 'Person' && !end) return { born: begin };
  return `${begin}–${end || ''}`;
}

/** The profile as the artist JSON gives it: facts, links, summary and image with their credits, sources. */
export const apiProfile = (p, lang) => p && ({
  name: p.name, type: p.type, country: p.country, begin: p.begin, end: p.end, genres: p.genres, links: p.links,
  summary: p.summary?.[lang] ? { ...p.summary[lang], license: SOURCES.wikipedia.license } : null,
  image: p.image, sources: p.sources.map((s) => ({ id: s, ...SOURCES[s] })), updatedAt: p.at,
});
