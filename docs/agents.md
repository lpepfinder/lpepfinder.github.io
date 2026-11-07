---
title: "For robots and agents"
description: "The site's data as JSON, and how to read it politely."
order: 5
audience: users
---

The pages are made for people. Everything they show is also published as plain JSON, so a robot or an AI agent doesn't have to read the pages. Start at [`/llms.txt`](https://lpepfinder.com/llms.txt) or [`/api/index.json`](https://lpepfinder.com/api/index.json).

## Files

| File | What it holds |
| --- | --- |
| `/api/index.json` | the endpoints below, counts (records, shops, countries) and the build time |
| `/api/shops.json` | every listed shop: id, name, site, country, city, records in stock, `searchable`, `bluesky` (`handle`, `verified`), its page |
| `/api/artists.json` | artists with records in stock at several shops: name, number of shops and records, page, and the URL of their JSON |
| `/artist/{slug}.json` | one artist's records in stock, cheapest first: title, `priceCents` and `currency`, shop, the shop's product URL, image; and `profile` (or null): type, country, years, genres, links (MusicBrainz, Wikidata, Wikipedia, website, Discogs, YouTube, Bluesky), the Wikipedia lead and a photo with their licences, and `sources` ([Open data sources](sources.md)) |
| `/dig.json` | this week's crates: new in the shops, back in stock, price drops ([format](data-formats.md)) |
| `/feed/new.xml`, `/feed/shop/{id}.xml` | Atom feeds of new arrivals |
| `/sitemap-index.xml` | every page |

Every page that has data links its JSON in its `<head>` as `<link rel="alternate" type="application/json">`: an artist page links `/artist/{slug}.json`, Dig links `/dig.json`, the shops page links `/api/shops.json`. Artist and shop pages also carry schema.org data (`Product` with `Offer`, `RecordStore`; an artist with a profile is a `MusicGroup` or `Person` with `sameAs` links).

Prices are in cents of the shop's currency (`priceCents: 2499`, `currency: "EUR"` is €24.99). Fields may be added; existing ones keep their name and meaning (`version` says which).

## Searching

Search runs in the browser: `/?q=…` is an empty page without JavaScript. Its static index (`/search/`) is described in [Data formats](data-formats.md), but it's built for the browser and left out of `robots.txt`; for most needs, the artist files and the shops list are the better start.

## Etiquette

- The data is rebuilt once a day (the build time is in `/api/index.json`): fetching more often only gets the same files.
- The data comes from the shops' own public catalogs. Link to the shop's product page (`url`) when you show a record: that's where it can be bought.
- Our own crawler is `LPEPFinderBot`, and shops can opt out (see [For record shops](for-shops.md)).
