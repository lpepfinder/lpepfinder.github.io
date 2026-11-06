# LP/EP Finder

Search engine for vinyl records in stock at independent record shops worldwide:
https://lpepfinder.com (also lpepfinder.github.io; formerly Vinyl Finder, vinyl-finder.gitlab.io).

Everything runs on free GitHub Actions and GitHub Pages: no server, no database, no paid service.

```
data/shops/*.json ──▶ Refresh (daily)      ──▶ "data" release ──▶ Deploy    ──▶ GitHub Pages
                      discover  OSM shops         shops-state.json   search index  dist/
                      check     every shop        products.ndjson.gz Astro site
                      crawl     Shopify / Woo
```

## Docs

The docs are in [`docs/`](docs/index.md), and on the site at https://lpepfinder.com/docs/:

- For people using the site: [searching](docs/searching.md), [Dig](docs/dig.md), [your watchlist](docs/watchlist.md), [for record shops](docs/for-shops.md).
- For contributors: [how it works](docs/how-it-works.md), [data formats](docs/data-formats.md), [offer ledger](docs/ledger.md), [development](docs/development.md), [CI](docs/ci.md), [editing data](docs/editing-data.md).

```sh
npm install
npm run build      # validate data, build index and site into dist/
npm run dev        # Astro dev server
npm test
```
