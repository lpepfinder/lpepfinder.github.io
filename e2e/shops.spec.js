import { test, expect } from './fixtures.js';
import fr from '../data/i18n/fr.json' with { type: 'json' };

test('a country page links its cities with a page; a city page lists its shops and the other cities', async ({ page }) => {
  await page.goto('/fr/shops/gb/');
  await page.locator('vf-grid section h2 a[href="/fr/shops/gb/london/"]').click();
  await expect(page).toHaveURL(/\/fr\/shops\/gb\/london\/$/);
  await expect(page.locator('main h1')).toHaveText(fr.cityTitle.replace('{city}', 'Londres'));
  expect(await page.locator('vf-shop-card').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('vf-chips a[href^="/fr/shops/gb/"]').first()).toBeVisible();
});
