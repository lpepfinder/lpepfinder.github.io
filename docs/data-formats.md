---
title: "Data formats"
description: "The files the browser reads, written by the daily build."
order: 11
audience: contributors
---

Files the browser reads, written by `npm run index` (details in `scripts/index/search-index.js`).
Fields added later are appended at the end of a row, so older files still read the same.

- `search/meta.json`: counts and settings (`docs`, `soldOutFrom`, `docsPerChunk`, `common` words, ...).
- `search/shops.json`: `[[id, name, origin, country, currency, lastCrawl, shipsTo], ...]`
  - `lastCrawl`: `"YYYY-MM-DD"` UTC day of the shop's last successful crawl (from the ledger), `null` when unknown.
  - `shipsTo`: ISO 3166-1 codes the shop ships to, `"*"` for Shopify's "rest of world", `[]` when unknown.
    Read from Shopify `/meta.json` (`ships_to_countries`) by the check, or set by hand as `shipsTo` in `data/shops/<host>.json`.
- `search/d/<n>.bin`: gzip-compressed JSON chunks of `docsPerChunk` records,
  `[[shop, title, priceCents, path, image, currency, soldOut, lastInStock, firstSeen, wasPrice, lowPrice90], ...]`.
  `0` means absent, and trailing zeros after `currency` are left out (rows have 6 to 11 fields).
  - `shop`: index in `shops.json`; `currency`: `0` when it is the shop's.
  - `soldOut`: `1` for sold-out records; `lastInStock`: day a sold-out record was last seen in stock.
  - `firstSeen`: `"YYYY-MM-DD"` day the offer ledger first saw the offer.
  - `wasPrice`: cents before a price drop in the last `ledger.priceDropDays` (14) days.
  - `lowPrice90`: lowest price in the last 90 days, only when lower than `priceCents`.
- `search/i/<shard>.bin`: gzip-compressed binary list of the shard's tokens and their doc ids (varint deltas);
  layout in `src/lib/search/codec.js`. The `.bin` files are stored compressed (about 3× smaller than JSON, which keeps
  the site under the GitHub Pages 1 GB limit) and decompressed by the browser with `DecompressionStream`.
- `search/artists.json`: `[[slug, name, recordCount], ...]` of the artist pages, most shops first, at most `search.maxArtists`
  (4,000, under 60 KB gzipped); `recordCount` as shown on `/artist/<slug>/`. For "top hits" in search.
- `regions.json`: copy of `data/regions.json`, customs zones `{ "zones": [{ id, label, countries }] }`.
  `label` is an i18n key; a country is in at most one zone, and countries in none are their own zone.

`client.records()` (`src/lib/search/client.js`) turns rows into records with `shop.lastCrawl`, `shop.shipsTo`,
`firstSeen`, `wasPrice` and `lowPrice90` (`null` when absent; `lowPrice90` is the price itself when the ledger
knows the offer but has no lower price).
