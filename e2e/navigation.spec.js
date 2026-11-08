import { test, expect, mark, marked, RAW_KEY } from './fixtures.js';
import fr from '../data/i18n/fr.json' with { type: 'json' };

/** Tabs of the app, in order: path, and an element only that page has. */
const TABS = [
  ['/new/', 'vf-dig'],
  ['/watch/', 'vf-watch-page'],
  ['/more/', 'vf-more-settings'],
  ['/', 'vf-results'],
];

test('tab bar: client-side navigation without reloads, no raw i18n keys; language switch loads French', async ({ page }) => {
  await page.goto('/');
  await mark(page);
  for (const [path, unique] of TABS) {
    await page.locator(`vf-tabbar a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`^[^?#]*//[^/]+${path.replace(/\//g, '\\/')}(\\?|$)`));
    await expect(page.locator(unique).first()).toBeAttached();
    await expect(page.locator(`vf-tabbar a[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
    // components fill in their texts after the swap: let them settle before reading
    await page.waitForLoadState('networkidle');
    expect(await page.locator('main').innerText(), `raw i18n key on ${path}`).not.toMatch(RAW_KEY);
    expect(await marked(page), `${path} was a full page load`).toBe(true);
  }

  await page.locator('vf-tabbar a[href="/more/"]').click();
  await page.locator('vf-more-settings button[value="language"]').click();
  await expect(page.locator('main a[hreflang="fr"]')).toBeVisible();
  await page.locator('main a[hreflang="fr"]').click();
  await expect(page).toHaveURL(/\/fr\/more\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('main h1')).toHaveText(fr.moreTitle);
  await expect(page.locator('vf-tabbar a[href="/fr/more/"]')).toContainText(fr.tabMore);
  expect(await marked(page), 'another language is a full page load').toBe(false);
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);
});
