---
title: "Collectors and the feed"
description: "Collector pages, the feed of records people want, and how many collectors want each record."
order: 6
audience: users
---

Collectors who publish their lists (see [Accounts](/docs/accounts/)) make LP/EP Finder a little social: you can see what others hunt for, which of their wants are in stock today, and how many people want a record.

## The Collectors page

**More → Collectors** (`/u/`) shows:

- **Wanted lately**: records collectors added to their wantlists in the last two weeks, with today's cheapest copy when a shop has one.
- **Most wanted**: the records on the most wantlists.
- **Collectors**: everyone who publishes a list, newest updates first. Each opens their page.

Look anyone up by their Bluesky handle. A collector's page (`/u/?h=<handle>`) shows their wants in stock now (cheapest first), all their wants, and how big their collection is. **Watch** any of their wants to follow it yourself.

## Wanted by…

A record's detail shows how many collectors want it and how many have it in their collection, when any do.

## Where it comes from

Only lists published on purpose count: the **Public lists** switches, off by default. Records you merely watch while signed in are in your Bluesky account too, but the feed leaves them out.

Once a day, the Refresh workflow's `social` job (`scripts/social/`, `npm run social`):

1. asks the Bluesky relay which accounts have a `com.lpepfinder.list` record (`com.atproto.sync.listReposByCollection`, one request per 500 accounts);
2. reads each account's lists from its own account server, one request at a time (see [Open data sources](/docs/sources/) for the pacing);
3. compares each wantlist with the day before: what's new is the "Wanted lately" news (a collector's first list isn't news);
4. writes `/social.json`: `collectors` (handle, name, avatar, counts), `wanted` and `owned` (release key → number of collectors), `top`, `events` (`[date, did, releaseKey, title]`), `titles`.

A list taken down disappears from the feed with the next run.
