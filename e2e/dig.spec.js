import { test, expect, RAW_KEY } from './fixtures.js';

test('Dig: a cover grid or an empty message, for every crate', async ({ page }) => {
  await page.goto('/new/');
  const dig = page.locator('vf-dig');
  // "error" means /dig.json is missing or broken: the build writes it, so that fails here
  await expect(dig).toHaveAttribute('status', 'ready');
  const crates = page.locator('vf-dig > nav a[crate]:visible');
  expect(await crates.count()).toBeGreaterThan(0);
  for (const crate of await crates.evaluateAll((links) => links.map((a) => a.getAttribute('crate')))) {
    await page.locator(`vf-dig > nav a[crate="${crate}"]`).click();
    await expect(dig).toHaveAttribute('crate', crate);
    await expect(page).toHaveURL(new RegExp(`[?&]crate=${crate}`));
    const cards = page.locator('vf-dig > ol > li vf-dig-card');
    // one or the other: covers, or a sentence saying the crate is empty
    await expect(page.locator('vf-dig > ol > li vf-dig-card, vf-dig > vf-dig-status:not(:empty)').first()).toBeVisible();
    if (await cards.count()) await expect(cards.first().locator('a')).toHaveAttribute('href', /^https?:\/\//);
    else await expect(page.locator('vf-dig > vf-dig-status')).not.toHaveText('');
    expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);
  }
});
