import { test, expect } from './fixtures.js';
import { wantsFromSite, discogsPage } from './wants.js';
import en from '../data/i18n/en.json' with { type: 'json' };

const USER = 'e2e-sources';
const wants = wantsFromSite();

test('sources: a wantlist that changed on Discogs offers Resync, which brings it up to date', async ({ page }) => {
  // Discogs: the full list, but the one-record page that gives the count says 3 more
  let extra = 0;
  await page.route('https://api.discogs.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== `/users/${USER}/wants`) return route.fulfill({ status: 404, json: {} });
    const body = discogsPage(wants);
    if (url.searchParams.get('per_page') === '1') body.pagination.items += extra;
    return route.fulfill({ json: body });
  });
  await page.goto('/watch/');
  const start = page.locator('vf-watch-start vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');

  const row = page.locator('vf-watch-sources vf-source[kind="wants"]');
  await expect(row).toHaveAttribute('state', 'current');
  await expect(row).toContainText(en.sources.current);
  await expect(row.locator('button[name="resync"]')).toHaveCount(0);

  // a day later, Discogs has 3 more wants
  extra = 3;
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('vf.sources'));
    s.discogs.checkedAt = new Date(Date.now() - 2 * 864e5).toISOString();
    localStorage.setItem('vf.sources', JSON.stringify(s));
  });
  await page.reload();
  await expect(row).toHaveAttribute('state', 'changed');
  await expect(row).toContainText(en.sources.more.other.replace('{count}', '3'));

  extra = 0;
  await row.locator('button[name="resync"]').click();
  await expect(page.locator('vf-sheet[name="discogs"]')).toHaveAttribute('open', '');
  await expect(row).toHaveAttribute('state', 'current');
});
