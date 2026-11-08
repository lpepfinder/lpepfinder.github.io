# LP/EP Finder

A free search engine for vinyl records in stock at independent record shops worldwide, rebuilt every day from the shops' public catalogs:
https://lpepfinder.com (formerly Vinyl Finder, vinyl-finder.gitlab.io).

- Search any record, dig what's new and cheap, browse shops by country.
- Watch a Discogs wantlist or collection, or the tracks of a Radio4000 radio, against every shop every day. Your lists stay in your browser, or in your own Bluesky account if you sign in.
- Publish your lists on Bluesky if you want: collectors' pages and a feed of what people want and have.
- Artist profiles from open data (MusicBrainz, Wikidata, Wikipedia, Wikimedia Commons), with every source credited.

No server, no database, no tracker: GitHub Actions builds everything and GitHub Pages serves it.

```
data/shops/*.json ─▶ Refresh (daily) ──────────────────────────────▶ "data" release ─▶ Deploy (each push) ─▶ lpepfinder.com
                     check   every shop (robots.txt most days)         products, state     the site, reusing
                     crawl   Shopify / WooCommerce, 4 runners          search index        the day's index
                     site    other shops, in shards
                     enrich  artist profiles (open data)
                     social  the collectors feed (Bluesky)
                     index   search index, built once a day
```

The bot, LPEPFinderBot, names itself, obeys robots.txt and Crawl-delay, and reads each shop once a day, one request at a time ([for shops](docs/for-shops.md)).

## Docs

In [`docs/`](docs/index.md), and on the site at https://lpepfinder.com/docs/:

- Using the site: [searching](docs/searching.md), [Dig](docs/dig.md), [your watchlist](docs/watchlist.md), [accounts](docs/accounts.md), [the feed](docs/feed.md), [for record shops](docs/for-shops.md).
- Contributing: [how it works](docs/how-it-works.md), [CI](docs/ci.md), [data formats](docs/data-formats.md), [sources](docs/sources.md), [offer ledger](docs/ledger.md), [development](docs/development.md), [editing data](docs/editing-data.md).

`AGENTS.md` is the project brief and the rules; `plan.md` lists what's planned.

```sh
npm ci
npm run dev        # Astro dev server
npm run verify     # data, unit tests, build, browser tests and quality gate
```

Contact: [GitHub issues](https://github.com/lpepfinder/lpepfinder.github.io/issues).
