---
title: "Offer ledger"
description: "The history behind new, back in stock, sold out and price drops."
order: 12
audience: contributors
---

The offer ledger (`scripts/ledger/`) remembers every offer, one shop's listing of one record, across days: one row per offer (shop + product path) with the day it was first and last seen, last in stock, its price, the lowest price in 90 days and its status (`in`, `out`, `gone`).

Each UTC day (`LEDGER_DATE=YYYY-MM-DD` overrides it) is compared with the day before, which gives the day's events:

| Event | When |
| --- | --- |
| `new` | first seen, in stock (not during a shop's first two crawls) |
| `restock` | in stock again after sold out or gone |
| `soldout` | was in stock, now listed as unavailable |
| `price-down` | in stock both days, cheaper today, same currency |
| `gone` | missing from a shop that was crawled today |

Shops that weren't crawled today (rotation, failure) keep their rows as they are. So do the offers missing from a
short crawl: one that lists less than 80% of the shop's offers (`ledger.shortCrawl`, shops of 100 offers or more),
usually a crawl cut off halfway, which would otherwise make thousands of `gone` events, then as many `restock` the
next day. After three short crawls in a row (`shortCrawlDays`) the shop has really shrunk and its missing offers are gone.

The ledger feeds:

- **The watchlist** (`public/w/`): the current state of each record (`now/`), the day's events (`d/<day>.json`, the last `ledger.watchDays` days: 20 to 40 MB a day; a browser away longer reads `now/`).
- **Dig** (`public/dig.json`, `scripts/ledger/dig.js`): new arrivals (the ledger's `new` events, and the shops' own creation dates), back in stock, price drops.
- **New arrivals pages and feeds** (`generated/new-arrivals.json`, `/new/`, `/feed/*.xml`).
- **The search index**: first seen, the price before a drop, the 90-day low.

The ledger is kept in the `data` release (`ledger.ndjson.gz`, and `ledger-prev.ndjson.gz`, the day before, so a second build on the same day starts again from it).
