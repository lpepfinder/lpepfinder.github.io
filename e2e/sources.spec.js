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
  const songs = wantsFromSite(40).filter((w) => / - /.test(w.title)).slice(0, 2);
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
});
