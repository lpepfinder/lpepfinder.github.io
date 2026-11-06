---
title: "Development"
description: "Commands, project layout, code style, navigation and translations."
order: 13
audience: contributors
---

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

## Layout

```
data/        shops, config, i18n, schemas (CMS-editable JSON)
scripts/     Node pipeline: check, crawl, discover, index, data validation
src/         Astro site: pages, layouts, components (vf-* custom elements), search client
public/      static files (favicon, verification); public/search is generated
```

Web code follows the classless style: semantic HTML and `vf-*` custom elements, state in attributes,
CSS variables, all strings in `data/i18n`.

## Navigation

Pages switch without a reload (Astro's ClientRouter, with prefetch on hover). Two details matter when writing components:

- **History within a page** (an open record `?r=`, a watchlist tab `?view=`, a search `?q=`) belongs to the page: `src/components/history-guard.js` turns a Back that stays on the same path into a `vf-popstate` event, so the router doesn't load the page again. Components listen to `vf-popstate`, not `popstate`.
- **Listeners on window or document** use `listen(host, target, type, fn)` from `src/components/dom.js` and end in `disconnectedCallback` with `unlisten(this)`: the window outlives the page's elements.
- **Strings** are read per page from the page's `<script data-i18n>`; each page lists the groups its components need (`strings` prop of `Base.astro`). A page in another language loads in full.
- **Components ready the elements they use** with `customElements.upgrade(this)`: after a swap, a new page's elements upgrade parent first.

## Docs

These pages are the Markdown files in `docs/`, shown on the site at `/docs/`. Links between them are written as `other-page.md`, so they work on GitHub too.
