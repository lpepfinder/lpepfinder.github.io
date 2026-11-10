import { test, expect, mark, marked, search, isPhone } from './fixtures.js';

/** A word found in any catalog of records. */
const QUERY = 'jazz';

test('search, open a record, Back closes it and keeps the results', async ({ page }, testInfo) => {
  await page.goto('/');
  await mark(page);
  await search(page, QUERY);
  await expect(page).toHaveURL(/[?&]q=jazz/);
  const rows = page.locator('vf-results ol vf-release');
  const count = await rows.count();

  const first = page.locator('vf-results ol vf-release > a').first();
  await first.click();
  await expect(page).toHaveURL(/[?&]r=[0-9a-f]+/);
  const sheet = page.locator('vf-sheet[name="release"]');
  await expect(sheet).toHaveAttribute('open');
  await expect(sheet.locator('vf-detail')).toHaveAttribute('status', 'ready');
  await expect(sheet.locator('vf-detail h2')).toBeVisible();
  await expect(rows.first()).toHaveAttribute('aria-current', 'true');

  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]r=/);
  await expect(page).toHaveURL(/[?&]q=jazz/);
  await expect(page.locator('vf-results ol vf-release[aria-current]')).toHaveCount(0);
  // a phone closes the sheet; the desktop pane stays docked, back to previewing the first result
  if (isPhone(testInfo)) await expect(sheet).not.toHaveAttribute('open');
  else await expect(sheet).toHaveAttribute('docked');
  await expect(page.locator('vf-results')).toHaveAttribute('status', 'done');
  await expect(rows).toHaveCount(count);
  expect(await marked(page), 'Back reloaded the page').toBe(true);
});

test('a country named in the search links to its page, in the reader language or in English', async ({ page }) => {
  await page.goto('/fr/');
  await search(page, 'germany');
  const link = page.locator('vf-places a[href="/fr/shops/de/"]');
  await expect(link).toBeVisible();
  await expect(link).toContainText('Allemagne');
  await link.click();
  await expect(page).toHaveURL(/\/fr\/shops\/de\/$/);
});

test('an artist named in the search links to the artist page', async ({ page }) => {
  await page.goto('/');
  await search(page, 'pink floyd');
  await expect(page.locator('vf-places a[href="/artist/pink-floyd/"]')).toBeVisible();
});
