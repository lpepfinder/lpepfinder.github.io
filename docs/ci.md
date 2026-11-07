---
title: "CI"
description: "The daily refresh and the deploy, on GitHub Actions."
order: 14
audience: contributors
---

Two rhythms, kept apart: the **data** changes once a day (crawls, then the index built from them), the **code** changes
with each push (then only the site is built). The index is the costly part (~20 minutes): it's built once a day,
and on a push only when the code that shapes it changed.

- **Refresh** (`.github/workflows/refresh.yml`) runs daily at 03:00 UTC: check, crawl (and on the 1st of the month
  discover new shops), the site crawler shards, artist profiles (`enrich`) and the collectors feed (`social`), each
  kept in the `data` release. Then **Index** builds the index from that day's data, then **Deploy** publishes.
- **Index** (`.github/workflows/index.yml`): downloads the crawl data and the offer ledger, runs `npm run index`, and
  saves the result at once as the **index bundle** in the `data` release: `index.tar.gz` (`public/search`, `public/w`,
  `dig.json`, and the crawl files the pages read: `site-data.json`, `shops-state.json`…) and `index-manifest.json`,
  which records the **index key** it was built with. Saved before anything else runs, so a failing test or deploy
  never costs a rebuild.
- **Index key** (`scripts/ci/index-key.js`): a hash of only what the index depends on: `scripts/index`, `ledger`,
  `quality`, `lib` and the search code (not their tests), the data files it reads, and the config sections
  `products`, `search`, `ledger`, `quality`, `dig`, `newArrivals`, `seo`. Crawl data, shops, rates and other settings
  don't count: a shop change reaches the search with the next daily index.
- **Deploy** (`.github/workflows/deploy.yml`) runs on every push to `main` (and after Refresh): a `check` job compares
  the index key of the code with the bundle's; only when they differ does it run **Index** first. Then it downloads
  the bundle, the profiles and the feed, builds the site, runs the end-to-end tests and publishes to GitHub Pages,
  in a few minutes. Without a bundle, or when a test fails, it stops, so the live site keeps the previous build (the
  Playwright report is attached to the failed run).
- **Health report** (`npm run health`, `scripts/health/`, a step of Deploy): compares the build with the last one of
  an earlier day (records, searchable shops, site size, crawl failures and age, end-to-end tests), thresholds in
  `data/config.json` `health`. Past numbers are kept as `health.json` in the `data` release. When degraded it opens
  or updates one issue labelled `health`; once healthy again it comments and closes it.
- Run either by hand from the Actions tab (Refresh has a "discover" option).
