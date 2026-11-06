import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSitemap } from './sitemap.js';
import { canonical, isProductUrl, links } from './links.js';
import { surtPrefix, parseClusterIndex, blocksFor, productUrls } from './commoncrawl.js';
import { shardOf } from './targets.js';
import { outputRecord } from './record.js';
import { isBotWall } from './fetcher.js';

test('sitemaps: url entries with lastmod, and indexes', () => {
  const s = parseSitemap('<urlset><url><loc>https://x.com/product-page/a?x=1&amp;y=2</loc><lastmod>2026-10-01</lastmod></url><url><loc><![CDATA[https://x.com/b]]></loc></url></urlset>');
  assert.equal(s.index, false);
  assert.deepEqual(s.entries, [{ loc: 'https://x.com/product-page/a?x=1&y=2', lastmod: '2026-10-01' }, { loc: 'https://x.com/b', lastmod: null }]);
  assert.equal(parseSitemap('<sitemapindex><sitemap><loc>https://x.com/store-products-sitemap.xml</loc></sitemap></sitemapindex>').index, true);
});

test('links: same site only, no carts or tracking, product URLs recognised', () => {
  const html = '<a href="/releases/cfe-x?utm_source=a">a</a><a href="https://other.com/p/x">b</a><a href="/cart">c</a><a href="/genres/techno?page=2">d</a><a rel="nofollow" href="/x">e</a>';
  assert.deepEqual(links(html, 'https://oye-records.com/'), ['https://oye-records.com/releases/cfe-x', 'https://oye-records.com/genres/techno?page=2']);
  assert.equal(canonical('https://www.oye-records.com/a#b', 'https://oye-records.com'), 'https://oye-records.com/a');
  assert.equal(isProductUrl('https://oye-records.com/releases/cfe-x'), true);
  assert.equal(isProductUrl('https://oye-records.com/releases/new'), false);
});

test('Common Crawl: SURT prefix, block lookup, CDX lines', () => {
  assert.equal(surtPrefix('www.oye-records.com'), 'com,oye-records)/');
  const blocks = parseClusterIndex([
    'com,oxford)/ 2026\tcdx-00001.gz\t0\t100\t1',
    'com,oye-records)/genres 2026\tcdx-00001.gz\t100\t100\t2',
    'com,oye-records)/releases/z 2026\tcdx-00001.gz\t200\t100\t3',
    'com,oyster)/ 2026\tcdx-00001.gz\t300\t100\t4',
  ].join('\n'));
  assert.deepEqual(blocksFor(blocks, 'com,oye-records)/').map((b) => b.offset), [0, 100, 200]);
  const cdx = [
    'com,oye-records)/releases/cfe-approaching-the-gaz-giant 20260101 {"url": "https://oye-records.com/releases/cfe-approaching-the-gaz-giant", "mime": "text/html", "status": "200"}',
    'com,oye-records)/releases/gone 20260101 {"url": "https://oye-records.com/releases/gone", "mime": "text/html", "status": "404"}',
    'com,oye-records)/about 20260101 {"url": "https://oye-records.com/about", "mime": "text/html", "status": "200"}',
    'com,oyster)/releases/x 20260101 {"url": "https://oyster.com/releases/x", "mime": "text/html", "status": "200"}',
  ].join('\n');
  assert.deepEqual([...productUrls(cdx, 'com,oye-records)/', 'https://oye-records.com')], ['https://oye-records.com/releases/cfe-approaching-the-gaz-giant']);
});

test('shards are stable and spread shops', () => {
  assert.equal(shardOf('oye-records.com', 8), shardOf('oye-records.com', 8));
  const counts = new Array(8).fill(0);
  for (let i = 0; i < 800; i++) counts[shardOf(`shop${i}.com`, 8)]++;
  assert.ok(Math.min(...counts) > 60);
});

test('output records: same-host paths, other hosts as full URLs, availability kept', () => {
  const entry = { r: { title: 'A - B', type: 'LP', price: 1999, currency: 'EUR', image: null, available: false }, t: '2026-11-05T00:00:00.000Z', f: '2026-11-01T00:00:00.000Z' };
  const line = outputRecord('oye-records.com', 'https://oye-records.com', 'https://www.oye-records.com/releases/a-b?x=1', entry);
  assert.deepEqual(line, { shop: 'oye-records.com', title: 'A - B', vendor: null, type: 'LP', price: 1999, currency: 'EUR', path: '/releases/a-b?x=1', image: null, available: false, updated: '2026-11-01T00:00:00.000Z' });
  assert.equal(outputRecord('x.com', 'https://x.com', 'https://shop.y.com/p/1', entry).path, 'https://shop.y.com/p/1');
});

test('bot walls: AWS WAF 202 challenge page, but not an ordinary 202', () => {
  const page = '<html><head><script>window.awsWafCookieDomainList = [];\nwindow.gokuProps = {"key":"AQID"};</script></head></html>';
  assert.equal(isBotWall({ status: 202, text: page }), true);
  assert.equal(isBotWall({ status: 202, text: '<html><body>Accepted</body></html>' }), false);
  assert.equal(isBotWall({ status: 200, text: '<p>products</p>' }), false);
});
