import { test, expect, RAW_KEY } from './fixtures.js';
import { wantsFromSite, discogsPage } from './wants.js';
import en from '../data/i18n/en.json' with { type: 'json' };

const USER = 'e2e-collector';
const wants = wantsFromSite();

test('watchlist: Discogs import, copies of a record, max price, Bought and Undo', async ({ page }) => {
  await page.route('https://api.discogs.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== `/users/${USER}/wants`) return route.fulfill({ status: 404, json: { message: 'User does not exist.' } });
    return route.fulfill({ json: discogsPage(wants) });
  });
  await page.goto('/me/');
  const watch = page.locator('vf-watch-page');
  await expect(watch).toHaveAttribute('empty');

  // one sheet for both Discogs lists: its title says which one the username is for
  const title = page.locator('vf-sheet[name="discogs"] header h2');
  await page.locator('vf-source[kind="collection"] button[name="connect"]').click();
  await expect(title).toHaveText(en.watchPage.collectionTitle);
  await page.keyboard.press('Escape');
  await page.locator('vf-source[kind="wants"] button[name="connect"]').click();
  await expect(title).toHaveText(en.watchPage.discogsTitle);
  const start = page.locator('vf-sheet[name="discogs"] vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');
  await page.keyboard.press('Escape');
  await expect(watch).not.toHaveAttribute('empty');
  await expect(watch).toHaveAttribute('status', 'done');

  // show every record in stock, wherever the shop ships
  const ships = page.locator('vf-watch-filters input[name="ships"]');
  // the box is drawn as a chip: click its label, as a reader does
  if (await ships.isChecked()) await page.locator('vf-watch-filters label', { has: page.locator('input[name="ships"]') }).click();
  await expect(ships).not.toBeChecked();
  const rows = page.locator('vf-watch-available vf-watch-hits vf-release');
  await expect(rows.first()).toBeVisible();
  const inStock = await rows.count();
  expect(inStock).toBeGreaterThan(0);
  // the overview: "6 in stock · 6 watched · 4 shops" on the card of all records
  const summary = page.locator('vf-watch-sources vf-source[kind="all"]');
  await expect(summary).toContainText(en.sources.inStock.replace('{count}', String(inStock)));
  expect(await page.locator('main').innerText()).not.toMatch(RAW_KEY);

  // a record's copies, in the sheet (phone) or the pane (desktop)
  const row = rows.first();
  const key = await row.getAttribute('release');
  await row.locator(':scope > a').click();
  await expect(page).toHaveURL(new RegExp(`[?&]record=${key}`));
  const sheet = page.locator('vf-sheet[name="watch-record"]');
  await expect(sheet).toHaveAttribute('open');
  const detail = sheet.locator('vf-detail');
  await expect(detail).toHaveAttribute('status', 'ready', { timeout: 30_000 });
  expect(await detail.locator('vf-offer').count()).toBeGreaterThan(0);

  // a max price for this record
  const controls = sheet.locator('vf-watch-controls');
  await controls.locator('input[name="max"]').fill('9999');
  await controls.locator('button[type="submit"]').click();
  const toast = page.locator('vf-toast');
  await expect(toast.locator('p[role="status"]')).not.toBeEmpty();
  const stored = () => page.evaluate((k) => {
    const list = JSON.parse(localStorage.getItem('vf.watch.v1') || '{}');
    return list.items?.[k] || null;
  }, key);
  await expect.poll(async () => (await stored())?.m).toBeGreaterThan(0);

  // Bought: off the list, with Undo in the toast
  await controls.locator('button[name="bought"]').click();
  await expect(page.locator(`vf-watch-available vf-release[release="${key}"]`)).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]record=/);
  await expect.poll(stored).toBeNull();
  const undo = toast.getByRole('button', { name: en.watchPage.undo });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.locator(`vf-watch-available vf-release[release="${key}"]`)).toHaveCount(1);
  await expect.poll(async () => (await stored())?.m).toBeGreaterThan(0);
  await expect(rows).toHaveCount(inStock);
});

test('watchlist: a record found for a radio track shows the track, with Listen', async ({ page }) => {
  const DID = 'did:plc:e2eradio';
  await page.route('https://api.discogs.com/**', (route) => route.fulfill({ json: discogsPage(wants) }));
  await page.goto('/me/');
  await page.locator('vf-source[kind="wants"] button[name="connect"]').click();
  const start = page.locator('vf-sheet[name="discogs"] vf-watch-import');
  await start.locator('input[name="user"]').fill(USER);
  await start.locator('button[type="submit"]').click();
  await expect(start).toHaveAttribute('status', 'done');

  // every record linked to a track of a radio kept in this browser (radio-tracks.js); written before the
  // page's scripts run, since the open page keeps its own copy of the list and saves it
  await page.addInitScript((did) => {
    if (sessionStorage.getItem('e2e-linked')) return;
    sessionStorage.setItem('e2e-linked', '1');
    const list = JSON.parse(localStorage.getItem('vf.watch.v1'));
    for (const it of Object.values(list.items)) it.p = [`at://${did}/radio.4000.track/1`];
    localStorage.setItem('vf.watch.v1', JSON.stringify(list));
    localStorage.setItem('vf.radio.tracks', JSON.stringify({ handle: 'dj.test', did, at: new Date().toISOString(), tracks: [['1', 'Some Artist - Some Song', 'https://media.example/1']] }));
  }, DID);
  await page.reload();
  const ships = page.locator('vf-watch-filters input[name="ships"]');
  if (await ships.isChecked()) await page.locator('vf-watch-filters label', { has: page.locator('input[name="ships"]') }).click();
  const row = page.locator('vf-watch-available vf-watch-hits vf-release').first();
  await row.locator(':scope > a').click();
  const tracks = page.locator('vf-sheet[name="watch-record"] vf-watch-tracks');
  await expect(tracks).toBeVisible();
  await expect(tracks).toContainText('Some Artist - Some Song');
  await expect(tracks.getByRole('link', { name: en.watchPage.listen })).toHaveAttribute('href', 'https://media.example/1');
});

test('watchlist: where records come from, Discogs or a radio: labels on the rows, the overview cards show one source', async ({ page }) => {
  // half the records from a Discogs wantlist, half found for a radio's tracks; both lists connected
  const items = {};
  wants.forEach((w, i) => { items[w.key] = { t: w.title, a: '2026-01-01', ...(i % 2 ? { p: [`at://did:plc:e2e/radio.4000.track/${i}`] } : { d: 1, w: w.id }) }; });
  const radio = Object.keys(items).filter((k) => items[k].p).length;
  await page.addInitScript(([items, now]) => {
    if (sessionStorage.getItem('e2e-sources')) return;
    sessionStorage.setItem('e2e-sources', '1');
    localStorage.setItem('vf.watch.v1', JSON.stringify({ items, changes: [], past: [] }));
    localStorage.setItem('vf.discogs.user', 'e2e-collector');
    localStorage.setItem('vf.sources', JSON.stringify({ discogs: { user: 'e2e-collector', wants: { n: 3, at: now, remote: 3, checkedAt: now } }, radio: { handle: 'dj.test', n: 3, at: now, newest: 'x', remote: 'x', checkedAt: now } }));
  }, [items, new Date().toISOString()]);
  await page.route('https://api.discogs.com/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/me/');
  const watch = page.locator('vf-watch-page');
  await expect(watch).toHaveAttribute('status', 'done');
  const ships = page.locator('vf-watch-filters input[name="ships"]');
  if (await ships.isChecked()) await page.locator('vf-watch-filters label', { has: page.locator('input[name="ships"]') }).click();

  const rows = page.locator('vf-watch-available vf-watch-hits vf-release');
  await expect(rows.locator('vf-badge[kind="discogs"]').first()).toHaveText(en.watchPage.badgeDiscogs);
  await expect(rows.locator('vf-badge[kind="radio"]').first()).toHaveText(en.watchPage.badgeRadio);

  // the radio's card: only the radio's records, in every tab
  const cards = page.locator('vf-watch-sources');
  await expect(cards.locator('vf-source[kind="radio"]')).toContainText(en.sources.inStock.replace('{count}', ''));
  await cards.locator('vf-source[source="radio"] > label').click();
  await expect(page).toHaveURL(/source=radio/);
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) await expect(row.locator('vf-badge[kind="radio"]')).toBeVisible();
  await page.locator('vf-watch-page > nav a[view="all"]').click();
  await expect(page).toHaveURL(/view=all&source=radio|source=radio&view=all/);
  await expect(page.locator('vf-watch-all ol > li')).toHaveCount(radio);

  // the wantlist's card shows the Discogs wants; the card of all records shows everything again
  await cards.locator('vf-source[source="discogs"] > label').click();
  await expect(page).toHaveURL(/source=discogs/);
  await expect(page.locator('vf-watch-all ol > li')).toHaveCount(Object.keys(items).length - radio);
  await cards.locator('vf-source[source="all"] > label').click();
  await expect(page).not.toHaveURL(/source=/);
  await expect(page.locator('vf-watch-all ol > li')).toHaveCount(Object.keys(items).length);

  // a record's detail says why it's on the list first: a Discogs want links to its release on Discogs
  await page.locator('vf-watch-page > nav a[view="available"]').click();
  const why = page.locator('vf-sheet[name="watch-record"] vf-watch-why');
  await rows.filter({ has: page.locator('vf-badge[kind="discogs"]') }).first().locator(':scope > a').click();
  await expect(why).toBeVisible();
  await expect(why.getByRole('link', { name: en.watchPage.seeDiscogs })).toHaveAttribute('href', /^https:\/\/www\.discogs\.com\/release\/\d+$/);
  await expect(why.locator('vf-watch-tracks')).toBeHidden();
  await page.keyboard.press('Escape');
  await rows.filter({ has: page.locator('vf-badge[kind="radio"]') }).first().locator(':scope > a').click();
  await expect(why.locator('vf-watch-tracks')).toContainText(en.watchPage.radioTracks);
  await expect(why.locator('p[source="discogs"]')).toBeHidden();
  await page.keyboard.press('Escape');

  // the ⋯ menu: Share opens its sheet
  await page.locator('vf-me-head vf-menu > button').click();
  await page.locator('#me-menu button[name="share"]').click();
  await expect(page.locator('vf-sheet[name="share"]')).toHaveAttribute('open', '');
});
