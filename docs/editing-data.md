---
title: "Editing data"
description: "Shops, settings and texts are JSON files, editable by hand or in a CMS."
order: 15
audience: contributors
---

- **Add a shop**: add `data/shops/<host>.json` with at least `{ "url": "https://host" }`, or open an issue
  with the "shop" template. The weekly check fills in name, platform and country.
- **Remove a shop** (owner request): set `"disabled": true`. Shops can also block `LPEPFinderBot` (or the former `VinylFinderBot`) in robots.txt.
- **Texts and translations**: `data/i18n/<lang>.json`. **Settings**: `data/config.json`
  (crawl limits, product filters, SEO thresholds, analytics ID).
