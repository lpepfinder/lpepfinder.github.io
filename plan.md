# Plan

What's planned, most useful first. Done items leave this file (their commit says what changed).

## Redesign for diggers (proposal, 2026-11-22, to decide)

The owner finds the site messy and wants it to lean toward diggers: people exploring *where* to find records. What a phone shows today (screenshots of the built site, 2026-11-22):

- Home and Explore repeat each other: shops by country and popular artists are on both.
- Dig, the digger's page, is four buttons halfway down Explore, under a heading.
- Search results say what and how much, but not where. The shop's name is small and grey, and its country is a flag on some rows only. "Ships to me" is a filter in a sheet.
- Explore ends in a pile of links: collectors, data status, JSON, llms.txt, Atom, docs.
- Settings, used once, has one of the four tabs.

The idea: the site answers "where can I find records like this, near me or shipping to me?" The place comes first, then the crate, then the record.

### Three tabs: Search, Shops, Me

Dig as it is (every new record, back in stock or cheaper, in every shop, as a cover grid) is not for people: on a phone it's an endless grid of unknown records with repeats and noisy shop titles. The owner, 2026-11-22: "nobody will use the dig tabs, maybe just crawlers". What a digger wants from "new" is new *for them*: on their list, at the shops they follow, near them. So the new-arrivals data moves to where it means something, and stays whole for robots.

| Tab | What it is | Takes from today |
|---|---|---|
| **Search** (home) | The field on top. Empty, it shows what's new for you (records from your lists in stock, new at the shops you follow, new near you), recent searches and popular artists. Results lead with the place: the nearest shop, or "ships to you", then the price. | Home, popular artists, Dig's "Your records" |
| **Shops** | Where the shops are: near me (a list by distance; a map later, see below), then by city and by country. A shop's page leads with what's new there this week, then everything in stock, with **Follow**. | Shops by country, cities, Dig's new arrivals per shop |
| **Me** | Your lists, as today, plus the shops you follow. Settings go in its ⋯ menu. | Settings tab |

Explore goes away, redirected to Search like `/more/` and `/watch/` before. The Dig crates leave the navigation, but the new arrivals stay whole for robots and agents: `dig.json`, the Atom feeds, and the static `/new/` pages per country and format, which search engines index, linked from the footer instead of a tab. Their data links (status, JSON, llms.txt, Atom, docs) move to one footer line on every page and to About.

### New things a digger needs

1. **One "where I dig" setting**, kept in this browser: near me (the browser's position, asked only when "near me" is tapped; it never leaves the browser), a city, a country, ships to me (from the currency and region already kept), or anywhere. Search, Shops and Me all read it, so it's chosen once, not per page.
2. **Shop places**: latitude and longitude per shop, at build time. They come from OpenStreetMap for the shops found there, and from Nominatim, paced, for the others, the way discovery already does it (`scripts/discover`). Today no shop has coordinates and 863 of 2,401 have a city: this is the first data job, and "near me" waits for it.
3. **Follow a shop**: its new records show in Search's "new for you" and on Me. It's kept like the watchlist, in this browser. The data is already in `dig.json`, per shop.
4. **A map, later**: the shops near you on a map needs map tiles, and tiles fetched per visitor go against "open data at build time, never per visitor". Either draw a simple static map at build time, or show tiles only after a tap, like the YouTube player. Not in the first steps.

### OpenStreetMap as the source of shops

OpenStreetMap already brings 718 of the 2,399 shops (monthly discovery, `scripts/discover/osm.js`). The proposal: OpenStreetMap becomes *the* place where a shop says it exists.

- **For shops**: done 2026-11-22: /submit/ ("Add a shop" on the Shops tab) leads with OpenStreetMap in three steps, the GitHub form second; `docs/for-shops.md` says the same.
- **Read it daily**, not monthly: one Overpass request a day (light, within its usage policy), so a shop added on OpenStreetMap appears the next day.
- **The other ~1,700 shops** stay. Their files gain a `osm` link when someone maps them; a shop that disappears from OpenStreetMap is checked, not removed.
- **Credit**: ODbL, already in `docs/sources.md`; the "for shops" page says it too.

### Order

0. **Before anything: the index to R2.** The site is 853 MB (health issue #9). Deploys stop at 900 MB, and the site grows about 11 MB a day, so that's a few days away. The steps are in "Hosting" below and wait on the owner: R2 enabled, an API token, DNS. A stopgap meanwhile: `ledger.watchDays` 3 → 2 frees 20–40 MB.
1. **New for you, new this week**: Search's empty state shows "new for you" (the watchlist's records in stock and new, then "most wanted"); a shop's page leads with what's new there this week. The tabs are done (2026-11-22: Search, Shops, Me, Settings; Explore redirected to Search; its data links in Settings; no page max-width).
2. **"Where I dig" without the map**: country, region and ships-to-me, which the browser already knows. Search results and "new for you" lead with the place.
3. **Shop coordinates**, then "near me" in Search, Shops and "new for you".
4. **Follow a shop**, its new records in "new for you".
5. **OpenStreetMap daily**: the discovery every day instead of the 1st of the month (the "add your shop" page is done; it says "from the 1st of next month" until then).

Each step is its own set of commits, with the quality gate and browser tests updated, and screenshots at 320px and 1440px before it ships.

### Decided (2026-11-22)

- No Dig tab: Search is home, and "new" is new for you (above). The full new arrivals stay for robots.
- "Near me" asks the browser for a position only when tapped; the position stays in the browser.
- Collectors: publishing lists and the collectors feed were removed with Bluesky accounts and profiles (2026-11-22: nobody had published a list), so there is no "most wanted".

## Crawl every shop every day, sooner

The catalog crawl stops at its 200-minute cap every day (73 shops left on 2026-11-08, 124 on 11-06), and the index and deploy wait for it: fresh data is live about four hours after the start.

1. Split the catalog crawl into parallel jobs, like the site crawler (`site.shards`): each shard its own runner, each shop still read at the same pace. Expected: every shop daily, in 30 to 50 minutes.
2. WooCommerce: read in-stock products only (`stock_status=instock`): 30 to 57% fewer requests for the big catalogs. First check that the ledger still shows records that sold out.
3. If still slow: Shopify 6 shops at a time per runner instead of 3, watching for 429s.

## Shops that refuse our bot

About 130 shops answer 403 or 429 to the check. Look at who protects them (Cloudflare, AWS WAF…); if many, sign requests with Web Bot Auth so firewalls can verify LPEPFinderBot from any address. Only then consider a crawler box with a fixed address: a small paid server, cost said first (hotpink is the hwww.org infrastructure, not for this).

## Hosting: GitHub builds, Cloudflare serves

Site on Cloudflare Workers static assets, index on R2 (`data.lpepfinder.com`, versioned folders and a `current.json` pointer), uploading only changed files to stay free. Waits on the owner: R2 enabled, an API token as a GitHub secret, DNS approval. Practice: `cloudflare-free-plan`, `zero-running-cost`.

Decided 2026-11-13: stay on GitHub Pages until it is exhausted, then move the index (`search/`, `w/`) to R2 and keep the pages on GitHub Pages. The trigger is the `health` issue at 850 MB (`health.siteMaxMB`); the deploy stops at 900. On 2026-11-13 the site was ~850 MB with 3 days of watchlist events, growing ~11 MB a day with the records (~50,000 more a day). Before the move: chunk the search index by a hash of the record key instead of by position. Today one new record shifts every file, so all ~133,000 change daily: ~4M R2 writes a month, ~$13 beyond the free 1M. With stable chunks only the changed files are uploaded. Weighed and set aside: a Hetzner server (a fixed fee, upkeep, no CDN), a second GitHub Pages site (works around GitHub's limit), Cloudflare static assets alone (20,000 files per deployment).

## Income beyond AdSense

AdSense auto ads came back on 2026-11-17 (removed 2026-11-08; the owner wants the site to earn something, see AGENTS.md). Other income, in order of effort:

1. Donations: a page and a footer link to Liberapay or Open Collective; free, and tells us whether the daily users care.
2. A sponsor slot, sold directly to a record shop or a label: a static image and a link, kept as CMS content (see the CMS item), no script.
3. Partner links where a shop runs a partner programme: a tagged link to the offer, paid per sale, no tracking on our pages.
4. Paid extras for heavy collectors (alerts by email, exports): needs accounts and payments, last.

## One app-shell switch

The CSS switches layout at 40, 48, 64, 75, 90 and 110rem; the rail starts at 48rem. savoir's `app-shell` decides one switch at 64rem, and `intrinsic-layout` wants components laid out by container queries. Converge on 64rem, then move the other breakpoints into container queries, one component at a time.

## A CMS for the data

Shops (`data/shops/`), settings (`data/config.json`), translations (`data/i18n/`) and artist corrections (`data/enrich/artists.json`) are data files without an editor. Add Sveltia CMS at `/admin/` (`sveltia-setup`), shops first, with the config generated from `data/schemas/` so they can't drift (`schema-and-cms-in-sync`).

## Code cleanup

From the 2026-11-10 review, not urgent; each one is a separate commit.

- One safe `localStorage` helper (`src/lib/storage.js`: read a key with a fallback, write it, never throw). About ten modules wrap it in their own try/catch today (`watch/sources.js`, `watch/now-cache.js`, `components/viewer.js`, `components/recent.js`…).
- One price and country-name formatter for the build (`src/lib/i18n.js`, takes `lang`) and the browser (`src/components/i18n.js`, page language). Today each has its own copy, and they fall back differently when the currency is missing: one assumes EUR, the other prints a bare number.
- `src/components/` mixes Astro components, `vf-*` custom elements and plain helpers (`dom`, `price`, `viewer`, `router`, `i18n`, `watch-*`). Move the helpers to `src/lib/ui/`, so there's one kind of file per folder.
- Workflows: `setup-node` + `npm ci` is repeated about 10 times and `gh release download data` about 15. Use a local composite action (`.github/actions/setup`) and one script to fetch crawl data.
- After 2027-02-01: remove `legacy()` from `src/lib/watch/sources.js` and the `vf.discogs.user` key it reads (lists saved before sources existed, 2026-11-07).

## Smaller

- The artists page is one 268 KB page of 3,000 links: heavy on a phone, and too slow for the quality gate. One page per letter (`/artists/a/`), with the letters on top; the old URL keeps the letters (ask before changing URLs).
- Artist pages exist in English only; their strings and the profile are translated, the routes aren't (`no-half-translation`).
- Shop and record profiles from open data, like artists (OpenStreetMap opening hours and place, Bluesky profile).
- Search Console for lpepfinder.com, then judge artist pages by the traffic they bring.
