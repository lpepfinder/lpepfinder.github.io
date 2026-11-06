---
title: "CI"
description: "The daily refresh and the deploy, on GitHub Actions."
order: 14
audience: contributors
---

- **Refresh** (`.github/workflows/refresh.yml`) runs daily at 03:00 UTC: check, crawl, and on the 1st of the
  month discover new shops. It starts from the previous crawl data, so a shop that fails keeps its records,
  publishes `generated/` as the `generated.tar.gz` asset of the `data` release, then runs Deploy.
- **Deploy** (`.github/workflows/deploy.yml`) runs on every push to `main`: downloads the latest crawl data,
  builds, runs the end-to-end tests and publishes to GitHub Pages. Without crawl data, or when a test fails, it
  stops, so the live site keeps the previous build (the Playwright report is attached to the failed run).
- **Health report** (`npm run health`, `scripts/health/`, a step of Deploy): compares the build with the last one of
  an earlier day (records, searchable shops, site size, crawl failures and age, end-to-end tests), thresholds in
  `data/config.json` `health`. Past numbers are kept as `health.json` in the `data` release. When degraded it opens
  or updates one issue labelled `health`; once healthy again it comments and closes it.
- Run either by hand from the Actions tab (Refresh has a "discover" option).
