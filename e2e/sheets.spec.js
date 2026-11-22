import { test, expect, search, isPhone } from './fixtures.js';

/** Scrolls every scroll container in the sheet to its end, then returns where the header, footer and sheet are. */
async function scrollToEnd(sheet) {
  return sheet.evaluate((el) => {
    for (const node of [el, ...el.querySelectorAll('*')]) {
      if (node.scrollHeight > node.clientHeight + 1 && getComputedStyle(node).overflowY !== 'visible') node.scrollTop = node.scrollHeight;
    }
    const box = (n) => n && n.checkVisibility() ? n.getBoundingClientRect().toJSON() : null;
    const dialog = el.querySelector(':scope > dialog');
    const scroller = el.hasAttribute('docked') ? el : dialog;
    return { scrolled: [el, ...el.querySelectorAll('*')].some((n) => n.scrollTop > 0), sheet: box(scroller), header: box(dialog.querySelector(':scope > header')), footer: box(dialog.querySelector(':scope > footer')) };
  });
}

test('a sheet keeps its header and footer in view when its content scrolls', async ({ page }, testInfo) => {
  // short screen, so the record detail has to scroll
  await page.setViewportSize({ width: isPhone(testInfo) ? 390 : 1440, height: 480 });
  await page.goto('/');
  await search(page, 'jazz');
  await page.locator('vf-results ol vf-release > a').first().click();
  const release = page.locator('vf-sheet[name="release"]');
  await expect(release.locator('vf-detail')).toHaveAttribute('status', 'ready');
  const r = await scrollToEnd(release);
  expect(r.scrolled).toBe(true);
  expect(r.header).not.toBeNull();
  expect(Math.abs(r.header.top - r.sheet.top)).toBeLessThanOrEqual(2);

  if (!isPhone(testInfo)) return;
  // the filters sheet: its footer (the actions) stays at the bottom
  await page.goBack();
  await page.locator('vf-results-actions button').click();
  const filters = page.locator('vf-sheet[name="filters"]');
  await expect(filters).toHaveAttribute('open');
  const f = await scrollToEnd(filters);
  expect(Math.abs(f.header.top - f.sheet.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(f.footer.bottom - f.sheet.bottom)).toBeLessThanOrEqual(2);
});
