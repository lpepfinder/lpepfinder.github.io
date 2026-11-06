import { test as base, expect } from '@playwright/test';

/**
 * Shared test setup:
 * - requests outside the site are aborted (ads, analytics, shop covers), so a test never depends on the network;
 *   a test mocks the hosts it needs with page.route (registered later, so it wins);
 * - every uncaught page error is collected and fails the test at its end.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const site = new URL(baseURL).host;
    await page.route((url) => url.host !== site && url.protocol.startsWith('http'), (route) => route.abort());
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.stack || String(err)));
    await use(page);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  },
});

export { expect };

/** A marker on window: still there after client-side navigation, gone after a full page load. */
export const mark = (page) => page.evaluate(() => { window.__marker = 'kept'; });
export const marked = (page) => page.evaluate(() => window.__marker === 'kept');

/** "dig.title", "watchPage.discogsUser", …: an i18n key that reached the page untranslated. */
export const RAW_KEY = /\b(dig|watchPage|results|detail)\.[a-zA-Z]+/;
export const isPhone = (testInfo) => testInfo.project.name === 'phone';

/** A search from the header form, as a reader does it: type, Enter, wait for the rows. */
export async function search(page, query) {
  const input = page.locator('vf-search input[name="q"]');
  await input.fill(query);
  await input.press('Enter');
  await expect(page.locator('vf-results')).toHaveAttribute('status', 'done', { timeout: 30_000 });
  await expect(page.locator('vf-results ol vf-release > a').first()).toBeVisible();
}
