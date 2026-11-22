import { test, expect } from './fixtures.js';
import en from '../data/i18n/en.json' with { type: 'json' };

const MINE = 'aaaaaaaaaaaa';
const SHOP = 'bbbbbbbbbbbb';

test('profiles from before: Me lists the other ones, each downloaded, merged into the list or removed; then the card goes', async ({ page }) => {
  // a browser that had three profiles, the second in use, and was signed in to Bluesky
  await page.addInitScript(([mine, shop]) => {
    if (sessionStorage.getItem('e2e-legacy')) return;
    sessionStorage.setItem('e2e-legacy', '1');
    const list = (key, t) => JSON.stringify({ items: { [key]: { t, a: '2026-11-01' } }, changes: [], past: [] });
    localStorage.setItem('vf.profiles', JSON.stringify({ current: 'p1', list: [{ id: 'default', name: 'Me' }, { id: 'p1', name: 'Shop' }, { id: 'p2', name: 'Gifts' }] }));
    localStorage.setItem('vf.watch.v1', list(mine, 'Mine'));
    localStorage.setItem('vf.watch.v1:p1', list(shop, 'For the shop'));
    localStorage.setItem('vf.watch.v1:p2', list(mine, 'A gift'));
    localStorage.setItem('vf.atproto.accounts', '[]');
  }, [MINE, SHOP]);
  await page.goto('/me/');
  const card = page.locator('vf-legacy-profiles');
  await expect(card).toBeVisible();
  await expect(card.locator('li')).toHaveCount(2);
  await expect(card.locator('li').first()).toContainText(en.legacy.inUse);
  // the Bluesky state is gone
  expect(await page.evaluate(() => localStorage.getItem('vf.atproto.accounts'))).toBeNull();

  const shop = card.locator('li', { hasText: 'Shop' });
  const download = page.waitForEvent('download');
  await shop.getByRole('button', { name: en.legacy.download }).click();
  expect((await download).suggestedFilename()).toMatch(/^lpepfinder-shop-\d{4}-\d{2}-\d{2}\.json$/);

  await shop.getByRole('button', { name: en.legacy.merge }).click();
  await expect(card.locator('output')).toHaveText(en.legacy.merged.one.replace('{name}', 'Shop'));
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vf.watch.v1')).items).sort())).toEqual([MINE, SHOP]);

  await card.locator('li', { hasText: 'Gifts' }).getByRole('button', { name: en.legacy.remove }).click();
  await expect(card.locator('li')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('vf.profiles'), localStorage.getItem('vf.watch.v1:p2')])).toEqual([null, null]);
  await page.reload();
  await expect(card).toBeHidden();
});

test('Settings › Move to another device: Download makes the file, Open a file adds its records', async ({ page }) => {
  await page.goto('/settings/#transfer');
  const sheet = page.locator('vf-sheet[name="transfer"]');
  await expect(sheet).toHaveAttribute('open', '');
  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: en.transfer.download }).click();
  expect((await download).suggestedFilename()).toMatch(/^lpepfinder-\d{4}-\d{2}-\d{2}\.json$/);
  const file = { format: 'lpepfinder-profile', version: 2, name: '', exported: '2026-11-22', data: { 'vf.watch.v1': { items: { [SHOP]: { t: 'Moved', a: '2026-11-22' } } } } };
  await sheet.locator('input[name="import"]').setInputFiles({ name: 'list.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(sheet.locator('output')).toHaveText(en.transfer.imported.one);
});
