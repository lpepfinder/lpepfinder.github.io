---
title: "For record shops"
description: "How shops get listed, what is read from their site, and how to update or opt out."
order: 4
audience: users
---

LP/EP Finder sends buyers to independent record shops: every record links to the shop's own page, and the sale happens there. It's free, for shops and buyers.

## Get listed

[Suggest your shop](https://github.com/lpepfinder/lpepfinder.github.io/issues/new?template=shop.yml) (a short form on GitHub), or ask a regular to do it. New shops are also found on OpenStreetMap and Record Store Day lists every month.

- **Shopify and WooCommerce shops** get their whole catalog searchable: we read the public catalog these platforms publish for every shop.
- **Other shops** are listed with a link, and become searchable as more platforms are supported.

## What we read

Once a day, slowly (one request at a time, pauses between pages), our crawler `LPEPFinderBot` reads the public catalog: title, price, currency, stock, image and product link. Nothing else: no customer data, no orders, no checkout. It respects `robots.txt`.

## Update or opt out

- **Wrong name, country or city?** Open an [issue](https://github.com/lpepfinder/lpepfinder.github.io/issues), or edit `data/shops/<your-domain>.json` in a pull request.
- **Opt out**: block `LPEPFinderBot` in your `robots.txt`, or ask in an issue: the shop is removed at the next daily update.

## Bluesky

Shop pages link the shop's [Bluesky](https://bsky.app) account, found in the daily check:

- **Verified ✓** when the shop's own domain is its handle (`@hardwax.com`): only the domain's owner can set that up, so the account is provably the shop's. To get it, set your website's domain as your handle in Bluesky's settings (Account → Handle → "I have my own domain").
- **Linked** when the shop's homepage links a profile (`bsky.app/profile/…`): shown as the shop's claim.

A domain handle is also how a shop could one day edit its own listing here, without an account on our side.
