---
title: "Profiles and Bluesky accounts"
description: "Several watchlists in one browser, and the same watchlist on all your devices with a Bluesky account."
order: 4
audience: users
---

## Profiles

A profile is a watchlist with its own Discogs account, collection and filters: "Me", "Shop", "Gifts"… Add, rename, switch and remove profiles in **More → Profiles**. They live in this browser only: anyone using it can open them.

## Sign in with Bluesky

**More → Bluesky account → Sign in with Bluesky** takes you to your account's own sign-in page (your password never reaches LP/EP Finder), then back. Signing in makes a profile named after your handle, and keeps its watchlist the same on every device you sign in on.

What's saved in your Bluesky account, where it is **public** like everything in an atproto account:

| Record | What |
| --- | --- |
| `com.lpepfinder.want` | each record you watch from this site (search, Dig, a radio), with its max price; its key is the record's release key |
| `com.lpepfinder.profile` | your Discogs username, so any device can read your Discogs wantlist and collection again |

Your Discogs wantlist itself isn't copied record by record: Discogs keeps it, and the username brings it back. Bought and removed records are deleted from the account too. Signing out keeps the profile in this browser; the records stay in your account until you delete them.

The record types are described in [`lexicons/com/lpepfinder/`](https://github.com/lpepfinder/lpepfinder.github.io/tree/main/lexicons/com/lpepfinder); other apps can read them.
