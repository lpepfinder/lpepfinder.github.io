---
title: "Your watchlist"
description: "Bring your Discogs wantlist and see which of your records independent shops have now."
order: 3
audience: users
---

The watchlist is part of your profile, on the **Me** tab (`/me/`). It answers one question: which of the records I want can I buy now, and where? It's checked against every shop once a day.

## Bring your Discogs wantlist

- **By username**: type your Discogs username and press Import. Your wantlist must be public on Discogs. It's read page by page (Discogs allows a few requests a minute without an account): 10,000 wants take about 5 minutes, and the first results show in seconds.
- **From a file**: on Discogs, Wantlist → Export gives a CSV file; upload it. This works for private wantlists too.
- **Again later**: importing the same username again syncs: new wants are added, wants you removed on Discogs leave the watchlist (records you added from the search stay).
- **Is it up to date?** At the top of the page, each list has a card: your Discogs wantlist and collection say when they were read. Once a day, the page asks Discogs how many records each list holds now: one light request per list, the first page of one record. When the count differs, the row says how many more or fewer there are on Discogs and offers **Resync**; a list read more than 30 days ago gets Resync too, since a want swapped for another doesn't change the count.

## From a Radio4000 radio

A [Radio4000](https://4000.radio) radio lives on Bluesky (atproto): type its handle under "From a Radio4000 radio" and its tracks are matched to records in stock. The tracks are kept in your browser: the first time the whole radio is read (up to 5,000 tracks), then only the tracks added since, and in full again once a month. A track with a Discogs link is matched exactly and ticked; for the others, records whose title holds the artist and the song are a guess, not ticked. You choose what to add.

A record added from the radio remembers the tracks it was found for (their atproto address, `at://…/radio.4000.track/…`): its detail on the Me page shows them under "On your radio", each with **Listen**, which opens the track where it is hosted (YouTube, SoundCloud…). Signed in, the link is synced with the record.

Signed in with Bluesky, the field already holds your handle, and the radio's card tells you when your radio has tracks you haven't matched yet (**Find records**), or new tracks since the last time (**Resync**): the page asks the radio for its newest track once a day, one light request.

You can also watch any record from the search: the ☆ Watch button in its detail.

## How records are matched

A want matches shop listings two ways:

1. **Artist and title**: "Moodymann – Black Mahogani" matches listings with the same words, whatever else the shop adds (format, "180g", "reissue", condition).
2. **Catalog number**: listings carrying the want's catalog number (in the title or the product code) match too, when the listing starts with a word of the artist or title, so the same number on another label doesn't.

## The overview

The top of the page is one card per place your records come from: all your records, your Discogs wantlist, your radio, and the records you added from the search. Each says how many are in stock now and how many you watch; the card of all records adds how many shops have them and how many were found since your last visit. Tap a card to see only its records, in every view; the source is in the address (`?source=discogs`, `radio` or `search`), so a filtered view can be bookmarked. Lists you haven't connected are under **Add a list**. On a phone the cards are one row you swipe.

The **⋯** button next to your profile holds the rest: Prices in (the currency), Share my watchlist, Profiles, and Sync with Bluesky.

## The views

Each record says where it comes from: **Discogs** for a want, **Radio** for a record found for a radio's tracks (both when it's both); a record added from the search has no label.

Tap a record to see its copies. The detail starts with why it's on your list: your Discogs want (with your rating and **See on Discogs**, the release's page with its tracks and videos), the radio tracks it was found for (with **Listen**), or the day you added it from the search. Then its copies, cheapest first, and at the end your settings for it: a maximum price, **Bought it** and **Remove**.

- **In stock**: your records in stock now, with the cheapest copy and how many shops have one. Records found since your last visit come first. Sort by newest, price, rarity (only copy), your Discogs rating, or A–Z; filter by shipping, customs and a maximum price.
- **Shops**: shops by how many of your records they have, with the total: the best places to order several records at once and pay shipping once.
- **Changes**: what changed day by day: new copies, back in stock, sold out, cheaper.
- **All**: every record you watch, with search, and an A–Z index once the list is longer than a page.

Open a record to see every copy, set a **max price** for it (copies above are hidden), or mark it **Bought** (with Undo).

## Your data stays with you

The watchlist lives in this browser only: no account, nothing stored on our side. Use **Settings → Profiles → Export this profile** to keep a copy or move it to another device ([profiles](accounts.md)), or **⋯ → Share my watchlist** to share it (the list is inside the link, after the #, never sent to the server). On iPhone, adding the site to the home screen keeps the browser from clearing it.
