import { test, expect, search, isPhone } from './fixtures.js';

test('desktop: Full screen opens the docked detail as a modal, Escape docks it again', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), 'the detail is docked as a pane on wide screens only');
  await page.goto('/');
  await search(page, 'jazz');
  await page.locator('vf-results ol vf-release > a').first().click();
  const sheet = page.locator('vf-sheet[name="release"]');
  const dialog = sheet.locator(':scope > dialog');
  await expect(sheet).toHaveAttribute('docked');
  await expect(sheet.locator('vf-detail')).toHaveAttribute('status', 'ready');
  const title = await sheet.locator('vf-detail h2').textContent();
  const isModal = () => dialog.evaluate((d) => d.matches(':modal'));
  expect(await isModal()).toBe(false);

  await sheet.locator('button[value="expand"]').click();
  await expect(sheet).toHaveAttribute('expanded');
  await expect.poll(isModal).toBe(true);

  await page.keyboard.press('Escape');
  await expect(sheet).not.toHaveAttribute('expanded');
  await expect(sheet).toHaveAttribute('open');
  await expect(dialog).toBeVisible();
  await expect.poll(isModal).toBe(false);
  // still the same record, still selected
  await expect(sheet.locator('vf-detail h2')).toHaveText(title);
  await expect(page).toHaveURL(/[?&]r=/);
});
