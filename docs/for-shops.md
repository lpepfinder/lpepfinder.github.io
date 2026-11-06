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
