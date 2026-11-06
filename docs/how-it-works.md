---
title: "How it works"
description: "From a list of shops to a search engine, every day, on free GitHub Actions and GitHub Pages."
order: 10
audience: contributors
---

Everything runs on free GitHub Actions and GitHub Pages: no server, no database, no paid service.

```
data/shops/*.json ──▶ Refresh (daily)      ──▶ "data" release ──▶ Deploy    ──▶ GitHub Pages
                      discover  OSM shops         shops-state.json   search index  dist/
                      check     every shop        products.ndjson.gz Astro site
                      crawl     Shopify / Woo
```

1. **Shops** are curated in `data/shops/<host>.json`, one file per shop ([schema](data/schemas/shop.schema.json)).
2. **Discover** (`npm run discover`, monthly): finds record shops with a website on OpenStreetMap,
   checks them, and keeps those whose catalog we can read.
3. **Check** (`npm run check`): for every shop, is it up, does robots.txt allow us, which platform is it,
   does it still sell records? Dead, moved, duplicated, non-music and blocked shops are excluded automatically.
   Results: `generated/shops-state.json`, shown on `/status/`.
4. **Crawl** (`npm run crawl`): reads public catalogs (Shopify `products.json`, WooCommerce Store API),
   keeps in-stock records, one request at a time per shop. Output: `generated/products.ndjson.gz`.
5. **Quality checks** (start of `npm run index`, code in `scripts/quality/`, settings in `data/config.json` `quality`):
   shop test listings (`(testproduct)`), untitled listings and non-records (the product filter of `products.exclude`)
   are left out of everything below. Wrong prices are removed but the record stays searchable without a price,
   so it can't be the cheapest offer, a price drop or a low price, and the ledger forgets it: a price under €0.50
   or over €3,000 (converted with `data/rates.json`), and every price of a shop whose median is under €2 or over
   €500 (a wrong currency, e.g. dollars labelled yen). Report: `generated/quality-report.json` (counts per reason,
   suspect shops, samples), counts on `/status/`.
6. **Offer ledger** (part of `npm run index`, code in `scripts/ledger/`): one row per offer (shop + product path)
   with first/last seen, last in stock, price, lowest price in 90 days and status `in | out | gone`. Each UTC day
   (`LEDGER_DATE=YYYY-MM-DD` overrides it) is diffed against the day before into events: `new`, `restock`,
   `soldout`, `price-down`, `gone`. A shop's first two crawls emit no `new`. Deploy keeps
   `generated/ledger.ndjson.gz` and `ledger-prev.ndjson.gz` (the day before, for a second build on the same day)
   in the `data` release. Outputs: `public/w/` (watchlist data: `now/<abc>.json`, `d/<day>.json` for 14 days,
   `index.json`) and `generated/new-arrivals.json` for `/new/` pages and `/feed/*.xml` Atom feeds.
7. **Build** (`npm run build`): writes a static, sharded search index to `public/search/` and builds the
   Astro site (search, shops by country, shop pages, artist pages, sitemap) into `dist/`.

Search runs in the browser: `<vf-search>` downloads only the index shards for the words you type.

