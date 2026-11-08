import { test, expect, RAW_KEY } from './fixtures.js';
import { wantsFromSite, discogsPage } from './wants.js';
import en from '../data/i18n/en.json' with { type: 'json' };

const USER = 'e2e-collector';
const wants = wantsFromSite();

test('watchlist: Discogs import, copies of a record, max price, Bought and Undo', async ({ page }) => {
  await page.route('https://api.discogs.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== `/users/${USER}/wants`) return route.fulfill({ status: 404, json: { message: 'User does not exist.' } });
    return route.fulfill({ json: discogsPage(wants) });
  });
  await page.goto('/me/');
  const watch = page.locator('vf-watch-page');
  await expect(watch).toHaveAttribute('empty');

  const start = page.locator('vf-watch-start vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');
  await expect(watch).not.toHaveAttribute('empty');
  await expect(watch).toHaveAttribute('status', 'done');

  // show every record in stock, wherever the shop ships
  const ships = page.locator('vf-watch-filters input[name="ships"]');
  // the box is drawn as a chip: click its label, as a reader does
  if (await ships.isChecked()) await page.locator('vf-watch-filters label', { has: page.locator('input[name="ships"]') }).click();
  await expect(ships).not.toBeChecked();
  const rows = page.locator('vf-watch-available vf-watch-hits vf-release');
  await expect(rows.first()).toBeVisible();
  const inStock = await rows.count();
  expect(inStock).toBeGreaterThan(0);
  // "6 watched, 6 in stock at 4 shops"-like summary
  const summary = page.locator('vf-watch-summary');
  await expect(summary).toContainText(String(inStock));
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);

  // a record's copies, in the sheet (phone) or the pane (desktop)
  const row = rows.first();
  const key = await row.getAttribute('release');
  await row.locator(':scope > a').click();
  await expect(page).toHaveURL(new RegExp(`[?&]record=${key}`));
  const sheet = page.locator('vf-sheet[name="watch-record"]');
  await expect(sheet).toHaveAttribute('open');
  const detail = sheet.locator('vf-detail');
  await expect(detail).toHaveAttribute('status', 'ready', { timeout: 30_000 });
  expect(await detail.locator('vf-offer').count()).toBeGreaterThan(0);

  // a max price for this record
  const controls = sheet.locator('vf-watch-controls');
  await controls.locator('input[name="max"]').fill('9999');
  await controls.locator('button[type="submit"]').click();
  const toast = page.locator('vf-toast');
  await expect(toast.locator('p[role="status"]')).not.toBeEmpty();
  const stored = () => page.evaluate((k) => {
    const list = JSON.parse(localStorage.getItem('vf.watch.v1') || '{}');
    return list.items?.[k] || null;
  }, key);
  await expect.poll(async () => (await stored())?.m).toBeGreaterThan(0);

  // Bought: off the list, with Undo in the toast
  await controls.locator('button[name="bought"]').click();
  await expect(page.locator(`vf-watch-available vf-release[release="${key}"]`)).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]record=/);
  await expect.poll(stored).toBeNull();
  const undo = toast.getByRole('button', { name: en.watchPage.undo });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.locator(`vf-watch-available vf-release[release="${key}"]`)).toHaveCount(1);
  await expect.poll(async () => (await stored())?.m).toBeGreaterThan(0);
  await expect(rows).toHaveCount(inStock);
});
