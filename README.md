# LP/EP Finder

Search engine for vinyl records in stock at independent record shops worldwide:
https://lpepfinder.github.io (also known as Vinyl Finder, vinyl-finder.gitlab.io).

Everything runs on free GitHub Actions and GitHub Pages: no server, no database, no paid service.

```
data/shops/*.json ──▶ Refresh (daily)      ──▶ "data" release ──▶ Deploy    ──▶ GitHub Pages
                      discover  OSM shops         shops-state.json   search index  dist/
                      check     every shop        products.ndjson.gz Astro site
                      crawl     Shopify / Woo
```

## How it works

1. **Shops** are curated in `data/shops/<host>.json`, one file per shop ([schema](data/schemas/shop.schema.json)).
2. **Discover** (`npm run discover`, monthly): finds record shops with a website on OpenStreetMap,
   checks them, and keeps those whose catalog we can read.
3. **Check** (`npm run check`): for every shop, is it up, does robots.txt allow us, which platform is it,
   does it still sell records? Dead, moved, duplicated, non-music and blocked shops are excluded automatically.
   Results: `generated/shops-state.json`, shown on `/status/`.
4. **Crawl** (`npm run crawl`): reads public catalogs (Shopify `products.json`, WooCommerce Store API),
   keeps in-stock records, one request at a time per shop. Output: `generated/products.ndjson.gz`.
5. **Offer ledger** (part of `npm run index`, code in `scripts/ledger/`): one row per offer (shop + product path)
   with first/last seen, last in stock, price, lowest price in 90 days and status `in | out | gone`. Each UTC day
   (`LEDGER_DATE=YYYY-MM-DD` overrides it) is diffed against the day before into events: `new`, `restock`,
   `soldout`, `price-down`, `gone`. A shop's first two crawls emit no `new`. Deploy keeps
   `generated/ledger.ndjson.gz` and `ledger-prev.ndjson.gz` (the day before, for a second build on the same day)
   in the `data` release. Outputs: `public/w/` (watchlist data: `now/<abc>.json`, `d/<day>.json` for 14 days,
   `index.json`) and `generated/new-arrivals.json` for `/new/` pages and `/feed/*.xml` Atom feeds.
6. **Build** (`npm run build`): writes a static, sharded search index to `public/search/` and builds the
   Astro site (search, shops by country, shop pages, artist pages, sitemap) into `dist/`.

Search runs in the browser: `<vf-search>` downloads only the index shards for the words you type.

## Data formats

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

## Commands

```sh
npm install
npm run check      # check all shops (or: npm run check -- <host part>)
npm run crawl      # crawl catalogs (CRAWL_LIMIT=20 for a quick local test)
npm run discover   # find new shops on OpenStreetMap (-- --write saves them to data/shops)
npm run build      # validate data, build index and site into dist/
npm run dev        # Astro dev server
npm test
```

## Editing data

- **Add a shop**: add `data/shops/<host>.json` with at least `{ "url": "https://host" }`, or open an issue
  with the "shop" template. The weekly check fills in name, platform and country.
- **Remove a shop** (owner request): set `"disabled": true`. Shops can also block `LPEPFinderBot` (or the former `VinylFinderBot`) in robots.txt.
- **Texts and translations**: `data/i18n/<lang>.json`. **Settings**: `data/config.json`
  (crawl limits, product filters, SEO thresholds, ads and analytics IDs).

## CI (GitHub Actions)

- **Refresh** (`.github/workflows/refresh.yml`) runs daily at 03:00 UTC: check, crawl, and on the 1st of the
  month discover new shops. It starts from the previous crawl data, so a shop that fails keeps its records,
  publishes `generated/` as the `generated.tar.gz` asset of the `data` release, then runs Deploy.
- **Deploy** (`.github/workflows/deploy.yml`) runs on every push to `main`: downloads the latest crawl data,
  builds and publishes to GitHub Pages. Without crawl data it stops, so the live site is never emptied.
- Run either by hand from the Actions tab (Refresh has a "discover" option).

## Layout

```
data/        shops, config, i18n, schemas (CMS-editable JSON)
scripts/     Node pipeline: check, crawl, discover, index, data validation
src/         Astro site: pages, layouts, components (vf-* custom elements), search client
public/      static files (favicon, verification); public/search is generated
```

Web code follows the classless style: semantic HTML and `vf-*` custom elements, state in attributes,
CSS variables, all strings in `data/i18n`.
