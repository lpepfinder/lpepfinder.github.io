import { test, expect } from './fixtures.js';
import en from '../data/i18n/en.json' with { type: 'json' };

test('profiles: rename and remove ask in a native dialog that keeps the profile unless confirmed', async ({ page }) => {
  await page.goto('/settings/#profiles');
  const profiles = page.locator('vf-profiles');
  await profiles.locator('input[name="name"]').first().fill('Gifts');
  await profiles.locator('form button[type="submit"]').first().click();
  const row = profiles.locator('vf-profile', { hasText: 'Gifts' });
  await expect(row).toHaveCount(1);
  const dialog = profiles.locator('dialog');

  // rename
  await row.locator('button[name="rename"]').click();
  await expect(dialog).toHaveAttribute('open', '');
  await dialog.locator('input[name="name"]').fill('Presents');
  await dialog.locator('button[value="ok"]').click();
  await expect(profiles.locator('vf-profile', { hasText: 'Presents' })).toHaveCount(1);

  // remove: Cancel (focused first) keeps it, confirming removes it
  const presents = profiles.locator('vf-profile', { hasText: 'Presents' });
  await presents.locator('button[name="remove"]').click();
  await expect(dialog.locator('button[value="cancel"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(presents).toHaveCount(1);
  await presents.locator('button[name="remove"]').click();
  await expect(dialog.locator('h2')).toHaveText(en.profiles.removeConfirm.replace('{name}', 'Presents'));
  await dialog.locator('button[value="ok"]').click();
  await expect(presents).toHaveCount(0);
});

test('profiles: local by default; each profile has its own list; a profile moves to another browser as a file', async ({ page, browser }) => {
  await page.goto('/settings/#profiles');
  const profiles = page.locator('vf-profiles');
  await expect(profiles.locator('vf-profile[current="true"]')).toContainText(en.profiles.local);

  // a record in the first profile
  await page.evaluate(() => localStorage.setItem('vf.watch.v1', JSON.stringify({ items: { aaaaaaaaaaaa: { t: 'First – Record', a: '2026-11-08' } }, changes: [], past: [] })));

  // a new profile: the page reloads into it, with an empty list
  await profiles.locator('#profile-name').fill('Gifts');
  await profiles.locator('#profile-name').press('Enter');
  await expect(profiles.locator('vf-profile[current="true"]')).toContainText('Gifts');
  expect(await page.evaluate(() => {
    const { current } = JSON.parse(localStorage.getItem('vf.profiles'));
    return localStorage.getItem(`vf.watch.v1:${current}`);
  })).toBeNull();

  // back to the first one: its record is there
  await profiles.locator('button[name="use"][value="default"]').click();
  await expect(profiles.locator('vf-profile[current="true"]')).toContainText(en.profiles.default);

  // export it, import it in a fresh browser
  const download = page.waitForEvent('download');
  await profiles.locator('button[name="export"]').click();
  const file = await (await download).path();
  const other = await browser.newPage();
  await other.goto('/settings/#profiles');
  await other.locator('vf-profiles input[name="import"]').setInputFiles(file);
  await expect(other.locator('vf-profiles > output')).toHaveText(en.profiles.imported.one);
  expect(await other.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vf.watch.v1')).items))).toEqual(['aaaaaaaaaaaa']);
  await other.close();
});
