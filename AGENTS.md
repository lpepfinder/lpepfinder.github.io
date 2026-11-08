# LP/EP Finder

A free search engine for vinyl records in stock at independent record shops, rebuilt every day from the shops' public catalogs (https://lpepfinder.com). For people looking for a record, and for collectors who want to know when a shop has one of their wants.

Objectives: find any record in stock at an independent shop in seconds, on a phone; match a collector's Discogs wantlist (10,000 records) against every shop every day; run with almost no running cost, paid for by discreet ads.
Never: a marketplace or an aggregator of big resellers (no Bandcamp, eBay or Discogs marketplace as sources; importing a Discogs wantlist or collection is wanted); a tracker; a paid service for its users; a burden on small shops' servers.
People: the casual searcher (one record, now), the digger (what's new and cheap, Dig), the collector (a big wantlist, the watchlist, publishing lists), the DJ (a Radio4000 radio's tracks matched to records), the shop owner (their shop page, how the bot reads them), robots and agents (llms.txt, JSON next to each page). Contact goes through GitHub issues only.

Follows https://hwww.gitlab.io/savoir/agents.md (local: ~/src/hwww/savoir). Exceptions, on purpose:
- sveltekit-static, sveltekit-3, paraglide-routing: Astro 7 with custom elements and our own i18n (`data/i18n/`), because it builds ~10,000 static pages from one data file and moving would cost weeks for no visible gain.
- bun-by-default: npm, because CI and the lockfile use it; nothing gained by switching.
- testing-stack: `node:test` for the scripts, Playwright for the site, because the scripts are plain Node modules; Vitest would add a dependency, not coverage.
- progressive-enhancement: search results need JavaScript, because the index is static files read in the browser (no server). Artist, shop and country pages are the paths that work without it.
- zero-running-cost: free today. Moving the index to Cloudflare R2 may cost a few euros a month; the owner accepted that ("I can pay") for a cleaner architecture.

## Commands

```sh
npm ci
npm run verify     # data, unit tests, build, browser tests: must pass before a commit
npm run validate   # data/shops and translations
npm test           # unit tests (scripts/**/*.test.js)
npx astro build    # the site, with the index already in public/ (or npm run build to index first)
npm run test:e2e   # Playwright on the built site, quality gate included
npm run check      # shops: alive, platform, robots.txt (Refresh)
npm run crawl      # Shopify and WooCommerce catalogs (Refresh)
npm run site       # the site crawler, in shards (Refresh)
npm run index      # search index, watch files, Dig (Index workflow)
npm run enrich     # artist profiles from open data (Refresh)
npm run social     # the collectors feed (Refresh)
```

## Rules that are easy to get wrong

- Classless: no `class`; semantic elements and `vf-*` custom elements, state in attributes; every value a token in `src/styles/tokens.css`.
- No hardcoded strings: UI text in `data/i18n/<lang>.json` for all six languages; settings in `data/config.json` (each section has a `description`).
- Other people's servers: the bot names itself, obeys robots.txt and Crawl-delay, spaces its requests (`crawl.delayMs`, `enrich.paceMs`), and fetches open data at build time, never per visitor. Credit every source (`docs/sources.md`).
- Personal data stays in the browser or in the person's own Bluesky account (`docs/accounts.md`); publishing a list is opt-in.
- The index is built once a day; a push rebuilds it only when the code it imports changes (`scripts/ci/index-key.js`, `docs/ci.md`). Keep index code out of modules the crawlers share, so crawler changes don't rebuild it.
- Commit on `main` in atomic commits and push: a push deploys in about three minutes.

## Docs

`docs/` is published at /docs/: how-it-works, ci, data-formats, sources, accounts, feed, agents, for-shops, development. `plan.md` lists what's planned.
