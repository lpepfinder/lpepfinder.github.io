import { test, expect, RAW_KEY } from './fixtures.js';
import { wantsFromSite } from './wants.js';
import en from '../data/i18n/en.json' with { type: 'json' };

const HANDLE = 'collector.example.com';
const DID = 'did:plc:e2ecollector000000000000';
const PDS = 'https://pds.example.com';
const BLOB = 'bafkreie2ewantsblob';
const wants = wantsFromSite(4);
// a want that no shop has, to show both lists
const gone = { key: 'abcdefabcdef', title: 'Nobody – Has This Record' };

/** A collector's account, as the network would answer: identity, Bluesky profile, published lists, records. */
async function mockAccount(page) {
  await page.route(/resolveHandle/, (r) => r.fulfill({ json: { did: DID } }));
  await page.route(`https://plc.directory/${DID}`, (r) => r.fulfill({ json: { id: DID, alsoKnownAs: [`at://${HANDLE}`], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] } }));
  await page.route(/app\.bsky\.actor\.getProfile/, (r) => r.fulfill({ json: { did: DID, handle: HANDLE, displayName: 'E2E Collector' } }));
  await page.route(`${PDS}/**`, (r) => {
    const url = new URL(r.request().url());
    const p = Object.fromEntries(url.searchParams);
    if (url.pathname.endsWith('getRecord') && p.rkey === 'wants') {
      return r.fulfill({ json: { value: { kind: 'wants', count: wants.length + 1, items: { $type: 'blob', ref: { $link: BLOB }, mimeType: 'application/json', size: 1 }, updatedAt: '2026-11-06T10:00:00Z' } } });
    }
    if (url.pathname.endsWith('getRecord') && p.rkey === 'self') return r.fulfill({ json: { value: { discogs: 'e2e-digger' } } });
    if (url.pathname.endsWith('getBlob')) return r.fulfill({ json: { version: 1, kind: 'wants', items: [...wants.map((w) => [w.key, w.title, w.id, '']), [gone.key, gone.title, 0, '']] } });
    if (url.pathname.endsWith('listRecords')) return r.fulfill({ json: { records: [] } });
    return r.fulfill({ status: 404, json: { error: 'RecordNotFound' } });
  });
}

test('a collector page: their wants in stock first, all their wants, and Watch to add one to your list', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/u/');
  // no handle: the lookup form
  const lookup = page.locator('vf-user-lookup');
  await expect(lookup).toBeVisible();
  await lookup.locator('input[name="h"]').fill(`@${HANDLE}`);
  await lookup.locator('button[type="submit"]').click();

  const user = page.locator('vf-user-page');
  await expect(user).toHaveAttribute('status', 'done');
  await expect(page.locator('vf-user-head h1')).toHaveText('E2E Collector');
  await expect(page.locator('vf-user-head')).toContainText('e2e-digger');
  const stock = page.locator('section[name="stock"] vf-release');
  await expect(stock).toHaveCount(wants.length);
  await expect(stock.first()).toHaveAttribute('stock', 'in');
  await expect(page.locator('section[name="wants"] vf-release')).toHaveCount(wants.length + 1);
  await expect(page.locator(`section[name="wants"] vf-release[release="${gone.key}"]`)).toContainText(en.user.outOfStock);
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);
  expect(await page.locator('main').innerText()).not.toMatch(/\buser\.[a-zA-Z]+/);

  // watch one of theirs: it lands in your own list
  const first = page.locator('section[name="wants"] vf-release').first();
  await first.locator('vf-watch button').evaluate((b) => b.click());
  await expect(first.locator('vf-watch')).toHaveAttribute('watching', 'true');
  const watched = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vf.watch.v1')).items));
  expect(watched).toContain(await first.getAttribute('release'));
});

test('a collector page: a handle that cannot be read says so', async ({ page }) => {
  await page.route(/resolveHandle/, (r) => r.fulfill({ status: 400, json: { error: 'InvalidRequest' } }));
  await page.goto('/u/?h=nobody.example.com');
  await expect(page.locator('vf-user-page')).toHaveAttribute('status', 'error');
  await expect(page.locator('vf-user-page > output')).toContainText('nobody.example.com');
});
