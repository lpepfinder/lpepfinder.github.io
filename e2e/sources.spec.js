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
  await page.goto('/me/');
  await page.locator('vf-source[kind="wants"] button[name="connect"]').click();
  const start = page.locator('vf-sheet[name="discogs"] vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');
  await page.keyboard.press('Escape');

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

test('sources: a radio read once shows its tracks, and offers Resync when tracks were added', async ({ page }) => {
  const HANDLE = 'e2e-radio.test';
  const DID = 'did:plc:e2eradio';
  const PDS = 'https://pds.e2e.test';
  let newest = `at://${DID}/radio.4000.track/2`;
  await page.route(/resolveHandle/, (r) => r.fulfill({ json: { did: DID } }));
  await page.route(`https://plc.directory/${DID}`, (r) => r.fulfill({ json: { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] } }));
  await page.route(`${PDS}/**`, (r) => {
    const one = new URL(r.request().url()).searchParams.get('limit') === '1';
    const records = [{ uri: newest, value: { title: 'Nobody Known - No Such Song', url: '' } }, { uri: `at://${DID}/radio.4000.track/1`, value: { title: 'Nobody Else - Nothing', url: '' } }];
    return r.fulfill({ json: { records: one ? records.slice(0, 1) : records } });
  });

  // a watchlist to start from
  await page.route('https://api.discogs.com/**', (route) => route.fulfill({ json: discogsPage(wants) }));
  await page.goto('/me/');
  await page.locator('vf-source[kind="wants"] button[name="connect"]').click();
  const start = page.locator('vf-sheet[name="discogs"] vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');
  await page.keyboard.press('Escape');

  // the radio never read, but known to have tracks (as for a signed-in DJ): offered
  await page.evaluate(([handle, uri]) => {
    const s = JSON.parse(localStorage.getItem('vf.sources'));
    s.radio = { handle, remote: uri, checkedAt: new Date().toISOString() };
    localStorage.setItem('vf.sources', JSON.stringify(s));
  }, [HANDLE, newest]);
  await page.reload();
  const row = page.locator('vf-watch-sources vf-source[kind="radio"]');
  await expect(row).toHaveAttribute('state', 'new');
  await expect(row).toContainText(en.sources.radioNew);

  await row.locator('button[name="resync"]').click();
  await expect(page.locator('vf-sheet[name="radio"]')).toHaveAttribute('open', '');
  await expect(page.locator('vf-sheet[name="radio"] vf-radio-import')).toHaveAttribute('status', /done|review/, { timeout: 30_000 });
  await expect(row).toHaveAttribute('state', 'current');
  await expect(row).toContainText(en.sources.tracks.other.replace('{count}', '2'));

  // a day later the radio has a new track
  newest = `at://${DID}/radio.4000.track/3`;
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('vf.sources'));
    s.radio.checkedAt = new Date(Date.now() - 2 * 864e5).toISOString();
    localStorage.setItem('vf.sources', JSON.stringify(s));
  });
  await page.reload();
  await expect(row).toHaveAttribute('state', 'changed');
  await expect(row).toContainText(en.sources.radioAdded);
});

test('radio review: exact matches and guesses in two groups, each ticked or cleared at once', async ({ page }) => {
  const DID = 'did:plc:e2egroups';
  const PDS = 'https://pds.groups.test';
  // "Artist - Title" with words on both sides: "0 - 01" can't be searched as a song
  const songs = wantsFromSite(80).filter((w) => /^\p{L}{3,}.* - \p{L}{3,}/u.test(w.title)).slice(0, 2);
  const records = [
    { uri: `at://${DID}/radio.4000.track/1`, value: { title: 'Linked Artist - Linked Song', url: '', discogsUrl: 'https://www.discogs.com/release/123-x' } },
    ...songs.map((w, i) => ({ uri: `at://${DID}/radio.4000.track/${i + 2}`, value: { title: w.title, url: '' } })),
  ];
  await page.route(/resolveHandle/, (r) => r.fulfill({ json: { did: DID } }));
  await page.route(`https://plc.directory/${DID}`, (r) => r.fulfill({ json: { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] } }));
  await page.route(`${PDS}/**`, (r) => r.fulfill({ json: { records: new URL(r.request().url()).searchParams.get('limit') === '1' ? records.slice(0, 1) : records } }));
  await page.route('https://api.discogs.com/**', (r) => r.fulfill({ json: { id: 123, title: 'Linked Song', artists: [{ name: 'Linked Artist' }], labels: [] } }));

  await page.goto('/me/');
  await page.locator('vf-source[kind="radio"] button[name="connect"]').click();
  const sheet = page.locator('vf-sheet[name="radio"] vf-radio-import');
  await sheet.locator('input[name="handle"]').fill('groups.test');
  await sheet.locator('button[type="submit"]').click();
  await expect(sheet).toHaveAttribute('status', 'review', { timeout: 30_000 });

  const [exact, guesses] = [sheet.locator(':scope > ol > li').nth(0), sheet.locator(':scope > ol > li').nth(1)];
  await expect(exact.locator(':scope > label input')).toBeChecked();
  await expect(guesses.locator(':scope > label input')).not.toBeChecked();
  const add = sheet.locator('button[name="add"]');
  await expect(add).toHaveText(en.radio.add.one);

  await guesses.locator(':scope > label').click();
  for (const box of await guesses.locator('input[name="record"]').all()) await expect(box).toBeChecked();
  const n = 1 + await guesses.locator('input[name="record"]').count();
  await expect(add).toHaveText(en.radio.add.other.replace('{count}', n));

  // one guess cleared: its group is mixed
  await guesses.locator('vf-radio-match label').first().click();
  expect(await guesses.locator(':scope > label input').evaluate((b) => b.indeterminate)).toBe(true);
  await exact.locator(':scope > label').click();
  await expect(add).toHaveText(en.radio.add.other.replace('{count}', n - 2));

  // on a short screen the review scrolls with the sheet (one scroll bar), Add stays at its bottom
  await page.setViewportSize({ width: page.viewportSize().width, height: 420 });
  const scrolling = await page.locator('vf-sheet[name="radio"] dialog').evaluate((d) => {
    const all = [d, ...d.querySelectorAll('*')].filter((n) => n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY));
    all[0].scrollTop = all[0].scrollHeight / 2;
    return all.length;
  });
  expect(scrolling).toBe(1);
  const [box, dialog] = [await add.boundingBox(), await page.locator('vf-sheet[name="radio"] dialog').boundingBox()];
  expect(box.y + box.height).toBeLessThanOrEqual(dialog.y + dialog.height + 1);
  expect(box.y).toBeGreaterThan(dialog.y);
});

test('sources: an import shows its progress on the card with the sheet closed; the ⋯ menu disconnects or removes a list, undone from the toast', async ({ page }) => {
  // Discogs answers once the test lets it, so the import is still running when the sheet closes
  let answer;
  const held = new Promise((resolve) => { answer = resolve; });
  await page.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== `/users/${USER}/wants`) return route.fulfill({ status: 404, json: {} });
    if (url.searchParams.get('per_page') !== '1') await held;
    return route.fulfill({ json: discogsPage(wants) });
  });
  await page.goto('/me/');
  await page.locator('vf-source[kind="wants"] button[name="connect"]').click();
  const sheet = page.locator('vf-sheet[name="discogs"]');
  await sheet.locator('input[name="user"]').fill(USER);
  await sheet.locator('button[type="submit"]').click();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toHaveAttribute('open');

  // the import goes on: the card says so, and Show opens the sheet on it
  const card = page.locator('vf-watch-sources vf-source[kind="wants"]');
  await expect(card).toHaveAttribute('busy', 'loading');
  await expect(card.locator('vf-progress')).toContainText(en.sources.syncing);
  answer();
  await expect(card).not.toHaveAttribute('busy');
  await expect(card).toHaveAttribute('state', 'current');

  const all = page.locator('vf-watch-sources vf-source[kind="all"]');
  const watched = en.watchPage.summaryWatched.other.replace('{count}', String(wants.length));
  await expect(all).toContainText(watched);
  const toast = page.locator('vf-toast');

  // Disconnect: the list goes to "Add a list", its records stay; Undo brings it back
  await card.locator('vf-menu > button').click();
  await card.getByRole('button', { name: en.sources.disconnect }).click();
  await expect(toast).toContainText(en.sources.disconnected.replace('{name}', `Discogs wantlist · ${USER}`));
  // its records still have their card, without the list's menu; the wantlist can be added again
  await expect(card.locator('vf-menu')).toHaveCount(0);
  await expect(page.locator('vf-source[kind="add"] button[name="connect"][value="wants"]')).toHaveCount(1);
  await expect(all).toContainText(watched);
  await toast.getByRole('button', { name: en.watchPage.undo }).click();
  await expect(card).toHaveAttribute('state', 'current');

  // Remove its records: they leave the list; Undo puts them back
  await card.locator('vf-menu > button').click();
  await card.getByRole('button', { name: en.sources.forget }).click();
  await expect(toast).toContainText(en.sources.forgotten.other.replace('{count}', String(wants.length)).replace('{name}', `Discogs wantlist · ${USER}`));
  // nothing left: the start screen, where the wantlist offers Connect again
  await expect(card.locator('button[name="connect"]')).toBeVisible();
  await toast.getByRole('button', { name: en.watchPage.undo }).click();
  await expect(card).toHaveAttribute('state', 'current');
  await expect(all).toContainText(watched);
});
