---
title: "Open data sources"
description: "Where artist profiles come from, under which licences, and how politely we ask."
order: 12
audience: contributors
---

Record listings come from the independent shops themselves (see [How it works](/docs/how-it-works/)). Everything **about** the records and artists (who they are, where they come from, links to them elsewhere) comes from open databases that anyone can use without an account or a key. Each profile names its sources and links back to them.

## Sources

| Source | What we take | Licence | How we ask |
|---|---|---|---|
| [MusicBrainz](https://musicbrainz.org/) | which artist it is, type, country, years, genres, links to the others | CC0 (core data) | [API](https://musicbrainz.org/doc/MusicBrainz_API), one request at a time, at least 1.1 s apart |
| [Wikidata](https://www.wikidata.org/) | Wikipedia pages, official website, YouTube channel, Bluesky handle, Discogs id, photo | CC0 | one request per artist |
| [Wikipedia](https://www.wikipedia.org/) | the first paragraph, quoted, with a link to the article | CC BY-SA 4.0 | the [REST summary](https://en.wikipedia.org/api/rest_v1/), one request per artist |
| [Wikimedia Commons](https://commons.wikimedia.org/) | a photo, shown with its author and licence | as each file says (CC BY, CC BY-SA, public domain…) | one request per photo; the page loads the thumbnail from Wikimedia |
| [OpenStreetMap](https://www.openstreetmap.org/) | new shops (record shops with a website, `npm run discover`), and a shop's country and city when its file has none (`npm run locate`) | ODbL, © OpenStreetMap contributors | [Overpass](https://overpass-api.de/), one query a month; [Nominatim](https://nominatim.org/) `lookup`, 50 places per request, one request a second |

Discogs, YouTube and Bluesky are linked, not read: the addresses come from MusicBrainz and Wikidata.

## How politely

- **Rarely**: the Enrich workflow runs once a day and profiles at most 400 artists, new ones first; a profile is refreshed after 30 days (60 when the artist wasn't found). Readers of the site never call these services: profiles are built into the pages.
- **One at a time**: requests to a host never overlap and are spaced (`enrich.paceMs` in `data/config.json`); a "slow down" answer (429, 503) is waited out as asked.
- **Named**: every request says who we are: `LPEPFinderBot/2.0 (+https://lpepfinder.com/about/)`.
- **Measured**: a run logs how many requests each host got.

## Matching the right artist

Names are ambiguous: there are several bands called Nirvana or Queen. So an artist is never matched by name alone: we take album titles from their records in stock (the titles most shops list), look for those albums on MusicBrainz, and keep the artist credited on them. No album found, no profile.

If a profile shows the wrong artist, each profile has a **Wrong artist?** link that opens a GitHub issue. The fix goes in `data/enrich/artists.json`:

```json
{
  "queen": { "mbid": "0383dadf-2a4e-4d10-a46a-e9e041da8eb3" },
  "some-artist": { "hide": true }
}
```

- `mbid`: the MusicBrainz id of the right artist (from its address, `musicbrainz.org/artist/<mbid>`); the next run uses it.
- `hide`: show no profile for this artist.

## Where it lives

- `scripts/enrich/`: the sources (`musicbrainz.js`, `wikimedia.js`), the matching (`titles.js`), one profile (`artist.js`), the run (`index.js`, `npm run enrich`).
- `generated/enrich/artists.json`: the profiles, kept in the "data" release as `enrich.json.gz` by the Enrich workflow and read by Deploy.
- `src/lib/enrich.js` and `src/components/ArtistProfile.astro`: the profile on the artist page; the artist JSON (`/artist/<slug>.json`) gives it as `profile`, with its sources and licences.
