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
  builds and publishes to GitHub Pages. Without crawl data it stops, so the live site is never emptied.
- Run either by hand from the Actions tab (Refresh has a "discover" option).
