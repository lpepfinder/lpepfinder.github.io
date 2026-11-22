import { test, expect, mark, marked, RAW_KEY } from './fixtures.js';
import fr from '../data/i18n/fr.json' with { type: 'json' };

/** Tabs of the app, in order: path, and an element only that page has. */
const TABS = [
  ['/shops/', 'vf-near'],
  ['/me/', 'vf-watch-page'],
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

  // Shops leads to a country, and its tab stays lit there
  await page.locator('vf-tabbar a[href="/shops/"]').click();
  await page.locator('section[aria-labelledby="shops-countries"] a').first().click();
  await expect(page).toHaveURL(/\/shops\/[a-z]{2}\/$/);
  await expect(page.locator('vf-tabbar a[href="/shops/"]')).toHaveAttribute('aria-current', 'true');

  // Settings is a button next to Me's title, and Me stays lit there
  await page.locator('vf-tabbar a[href="/me/"]').click();
  await page.locator('vf-me-head a[href="/settings/"]').click();
  await expect(page.locator('vf-tabbar a[href="/me/"]')).toHaveAttribute('aria-current', 'true');
  await page.locator('vf-settings-rows button[value="language"]').click();
  await expect(page.locator('vf-languages a[hreflang="fr"]')).toBeVisible();
  await page.locator('vf-languages a[hreflang="fr"]').click();
  await expect(page).toHaveURL(/\/fr\/settings\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('main h1')).toHaveText(fr.settingsTitle);
  await expect(page.locator('vf-tabbar a[href="/fr/shops/"]')).toContainText(fr.tabShops);
  expect(await marked(page), 'another language is a full page load').toBe(false);
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);
});

test('language: the rail globe opens the languages, centred; a language keeps the page and its query', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/me/?view=all');
  await page.locator('header > button[name="language"]').click();
  const dialog = page.locator('vf-sheet[name="language"] > dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 640), 'centred across').toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 400), 'centred down').toBeLessThan(2);
  await expect(page.locator('vf-languages a[hreflang="de"] small')).toHaveText('German');
  await page.locator('vf-languages a[hreflang="de"]').click();
  await expect(page).toHaveURL(/\/de\/me\/\?view=all$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('moved pages: /more/, /watch/, /explore/ and /u/ (and their translations) send to /settings/, /me/ and Search, keeping the #hash', async ({ page }) => {
  await page.goto('/more/#transfer');
  await expect(page).toHaveURL(/\/settings\/#transfer$/);
  await expect(page.locator('vf-sheet[name="transfer"]')).toHaveAttribute('open', '');
  await page.goto('/fr/watch/');
  await expect(page).toHaveURL(/\/fr\/me\/$/);
  await expect(page.locator('vf-me-head h1')).toBeVisible();
  await page.goto('/de/explore/');
  await expect(page).toHaveURL(/\/de\/$/);
  await expect(page.locator('vf-results')).toBeAttached();
  await page.goto('/u/?h=someone.test');
  await expect(page).toHaveURL(/\/\?h=someone\.test$/);
});
