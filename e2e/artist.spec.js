import fs from 'node:fs';
import path from 'node:path';
import { test, expect, RAW_KEY } from './fixtures.js';

// an artist of the built site, and its JSON (the records the page's detail reads)
const DIST = path.resolve(import.meta.dirname, '../dist');
const { artists } = JSON.parse(fs.readFileSync(path.join(DIST, 'api/artists.json'), 'utf8'));
const artist = artists[0];

test('artist page: a record opens its detail, read from the artist JSON; a ?r= link opens it directly', async ({ page }) => {
  await page.goto(`/artist/${artist.slug}/`);
  const rows = page.locator('vf-release-list vf-release');
  await expect(rows.first()).toBeVisible();
  const key = await rows.first().getAttribute('release');
  await rows.first().locator('> a').click();
  const detail = page.locator(`vf-detail[status="ready"][release="${key}"]`);
  await expect(detail).toBeVisible();
  await expect(detail.locator('vf-offer').first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);
  // the page no longer carries its records twice
  expect(await page.locator('script[data-records]').count()).toBe(0);

  await page.goto(`/artist/${artist.slug}/?r=${key}`);
  await expect(page.locator(`vf-detail[status="ready"][release="${key}"]`)).toBeVisible();
});
