# Plan

What's planned, most useful first. Done items leave this file (their commit says what changed).

## Crawl every shop every day, sooner

The catalog crawl stops at its 200-minute cap every day (73 shops left on 2026-11-08, 124 on 11-06), and the index and deploy wait for it: fresh data is live about four hours after the start.

1. Split the catalog crawl into parallel jobs, like the site crawler (`site.shards`): each shard its own runner, each shop still read at the same pace. Expected: every shop daily, in 30 to 50 minutes.
2. WooCommerce: read in-stock products only (`stock_status=instock`): 30 to 57% fewer requests for the big catalogs. First check that the ledger still shows records that sold out.
3. If still slow: Shopify 6 shops at a time per runner instead of 3, watching for 429s.

## Shops that refuse our bot

About 130 shops answer 403 or 429 to the check. Look at who protects them (Cloudflare, AWS WAF…); if many, sign requests with Web Bot Auth so firewalls can verify LPEPFinderBot from any address. Only then consider a crawler box with a fixed address: a small paid server, cost said first (hotpink is the hwww.org infrastructure, not for this).

## Hosting: GitHub builds, Cloudflare serves

Site on Cloudflare Workers static assets, index on R2 (`data.lpepfinder.com`, versioned folders and a `current.json` pointer), uploading only changed files to stay free. Waits on the owner: R2 enabled, an API token as a GitHub secret, DNS approval. Practice: `cloudflare-free-plan`, `zero-running-cost`.

## Income without AdSense

AdSense was removed on 2026-11-08 (savoir `income-without-tracking`: no tracking ad network); nothing replaces it yet. Ideas, in order of effort:

1. Donations: a page and a footer link to Liberapay or Open Collective; free, and tells us whether the daily users care.
2. A sponsor slot, sold directly to a record shop or a label: a static image and a link, kept as CMS content (see the CMS item), no script.
3. Partner links where a shop runs a partner programme: a tagged link to the offer, paid per sale, no tracking on our pages.
4. Paid extras for heavy collectors (alerts by email, exports): needs accounts and payments, last.

Also: remove the site from the AdSense account, so Google stops expecting `ads.txt`.

## One app-shell switch

The CSS switches layout at 40, 48, 64, 75, 90 and 110rem; the rail starts at 48rem. savoir's `app-shell` decides one switch at 64rem, and `intrinsic-layout` wants components laid out by container queries. Converge on 64rem, then move the other breakpoints into container queries, one component at a time.

## A CMS for the data

Shops (`data/shops/`), settings (`data/config.json`), translations (`data/i18n/`) and artist corrections (`data/enrich/artists.json`) are data files without an editor. Add Sveltia CMS at `/admin/` (`sveltia-setup`), shops first, with the config generated from `data/schemas/` so they can't drift (`schema-and-cms-in-sync`).

## Code cleanup

From the 2026-11-10 review, not urgent; each one is a separate commit.

- One safe `localStorage` helper (`src/lib/storage.js`: read a key with a fallback, write it, never throw). About ten modules wrap it in their own try/catch today (`watch/sources.js`, `watch/now-cache.js`, `atproto/sync.js`, `components/viewer.js`, `components/recent.js`…).
- One price and country-name formatter for the build (`src/lib/i18n.js`, takes `lang`) and the browser (`src/components/i18n.js`, page language). Today each has its own copy, and they fall back differently when the currency is missing: one assumes EUR, the other prints a bare number.
- `src/components/` mixes Astro components, `vf-*` custom elements and plain helpers (`dom`, `price`, `viewer`, `router`, `i18n`, `watch-*`). Move the helpers to `src/lib/ui/`, so there's one kind of file per folder.
- Workflows: `setup-node` + `npm ci` is repeated about 10 times and `gh release download data` about 15. Use a local composite action (`.github/actions/setup`) and one script to fetch crawl data.
- After 2027-02-01: remove `legacy()` from `src/lib/watch/sources.js` and the `vf.discogs.user` key it reads (lists saved before sources existed, 2026-11-07).

## Smaller

- The artists page is one 268 KB page of 3,000 links: heavy on a phone, and too slow for the quality gate. One page per letter (`/artists/a/`), with the letters on top; the old URL keeps the letters (ask before changing URLs).
- No page max-width (`radical-mobile-first`): `main` stops at 120rem (`--width-wide`); only running text needs a measure.
- Artist pages exist in English only; their strings and the profile are translated, the routes aren't (`no-half-translation`).
- Shop and record profiles from open data, like artists (OpenStreetMap opening hours and place, Bluesky profile).
- Search Console for lpepfinder.com, then judge artist pages by the traffic they bring.
