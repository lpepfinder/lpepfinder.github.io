# Plan

What's planned, most useful first. Done items leave this file (their commit says what changed).

## Crawl every shop every day, sooner

The catalog crawl stops at its 200-minute cap every day (73 shops left on 2026-11-08, 124 on 11-06), and the index and deploy wait for it: fresh data is live about four hours after the start.

1. Split the catalog crawl into parallel jobs, like the site crawler (`site.shards`): each shard its own runner, each shop still read at the same pace. Expected: every shop daily, in 30 to 50 minutes.
2. WooCommerce: read in-stock products only (`stock_status=instock`): 30 to 57% fewer requests for the big catalogs. First check that the ledger still shows records that sold out.
3. If still slow: Shopify 6 shops at a time per runner instead of 3, watching for 429s.

## Shops that refuse our bot

About 130 shops answer 403 or 429 to the check. Look at who protects them (Cloudflare, AWS WAF…); if many, sign requests with Web Bot Auth so firewalls can verify LPEPFinderBot from any address. Only then consider a crawler box with a fixed address (hotpink if it's a real server, else a small paid server: say the cost first).

## Hosting: GitHub builds, Cloudflare serves

Site on Cloudflare Workers static assets, index on R2 (`data.lpepfinder.com`, versioned folders and a `current.json` pointer), uploading only changed files to stay free. Waits on the owner: R2 enabled, an API token as a GitHub secret, DNS approval. Practice: `cloudflare-free-plan`, `zero-running-cost`.

## One app-shell switch

The CSS switches layout at 40, 48, 64, 75, 90 and 110rem; the rail starts at 48rem. savoir's `app-shell` decides one switch at 64rem, and `intrinsic-layout` wants components laid out by container queries. Converge on 64rem, then move the other breakpoints into container queries, one component at a time.

## A CMS for the data

Shops (`data/shops/`), settings (`data/config.json`), translations (`data/i18n/`) and artist corrections (`data/enrich/artists.json`) are data files without an editor. Add Sveltia CMS at `/admin/` (`sveltia-setup`), shops first, with the config generated from `data/schemas/` so they can't drift (`schema-and-cms-in-sync`).

## Smaller

- The artists page is one 268 KB page of 3,000 links: heavy on a phone, and too slow for the quality gate. One page per letter (`/artists/a/`), with the letters on top; the old URL keeps the letters (ask before changing URLs).
- No page max-width (`radical-mobile-first`): `main` stops at 120rem (`--width-wide`); only running text needs a measure.
- Artist pages exist in English only; their strings and the profile are translated, the routes aren't (`no-half-translation`).
- Shop and record profiles from open data, like artists (OpenStreetMap opening hours and place, Bluesky profile).
- Search Console for lpepfinder.com, then judge artist pages by the traffic they bring.
