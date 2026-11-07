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
| `com.lpepfinder.list` | only if you publish them: your whole wantlist (key `wants`) and your collection (key `collection`), each as one JSON file |

Your Discogs wantlist itself isn't copied record by record: Discogs keeps it, and the username brings it back. Bought and removed records are deleted from the account too. Signing out keeps the profile in this browser; the records stay in your account until you delete them.

## Public lists and your public page

Under **More → Bluesky account → Public lists**, you can publish your wantlist, your collection, or both. Off by default. A published list is one record in your Bluesky account with the whole list attached as a JSON file, so a wantlist of 10,000 records is one write, not 10,000. It is rewritten a few seconds after your list changes (only when it really changed), and turning it off deletes it from your account.

- **Wantlist**: every record you watch, with its title, its Discogs release id and its cover, whether it came from Discogs or from this site.
- **Collection**: the release keys of the records you own (from your Discogs collection), and how many.

Your public page is `/u/?h=<your handle>` (**Your public page** under the switches). Anyone can open it, or look someone up from **More → Collectors**. It reads straight from your Bluesky account, in the visitor's browser: your name and avatar, your wants that independent shops have in stock today (cheapest first), all your wants, how many records your collection holds, and links to your Bluesky and Discogs profiles. Visitors can **Watch** any of your wants to add it to their own list.

A sign-in from before publishing existed doesn't allow it yet (publishing needs permission to upload the file): sign out and in again.

The record types are described in [`lexicons/com/lpepfinder/`](https://github.com/lpepfinder/lpepfinder.github.io/tree/main/lexicons/com/lpepfinder); other apps can read them.
