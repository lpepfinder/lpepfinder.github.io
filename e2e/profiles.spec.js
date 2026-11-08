import { test, expect } from './fixtures.js';
import en from '../data/i18n/en.json' with { type: 'json' };

test('profiles: rename and remove ask in a native dialog that keeps the profile unless confirmed', async ({ page }) => {
  await page.goto('/more/');
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
