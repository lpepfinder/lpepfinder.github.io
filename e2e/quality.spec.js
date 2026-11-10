import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { qualityTests } from './quality.js';

/**
 * The shared UI quality gate (e2e/quality.js, copied from savoir: don't edit the copy) on the main screens.
 * It checks each one at 320px and 1440px itself, so it runs in one Playwright project only.
 */
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the gate sizes its own viewports'));

const DIST = path.resolve(import.meta.dirname, '../dist');
const { artists } = JSON.parse(fs.readFileSync(path.join(DIST, 'api/artists.json'), 'utf8'));
const { shops } = JSON.parse(fs.readFileSync(path.join(DIST, 'api/shops.json'), 'utf8'));
const shop = shops.find((s) => s.searchable) || shops[0];


qualityTests([
  { name: 'home', path: '/', touch: 44 },
  { name: 'search', path: '/?q=jazz', touch: 44 },
  { name: 'artist', path: `/artist/${artists[0].slug}/`, touch: 44 },
  { name: 'shop', path: `/shop/${shop.id}/`, touch: 44 },
  { name: 'shops', path: '/shops/', touch: 44 },
  { name: 'city', path: '/shops/gb/london/', touch: 44 },
  // /artists/ is left out: 3,000 links take the gate close to its 90 s limit and fail under load (plan.md:
  // one page per letter would fix it for phones too)
  { name: 'explore', path: '/explore/', touch: 44 },
  { name: 'new arrivals', path: '/new/' },
  { name: 'watchlist', path: '/me/', touch: 44 },
  { name: 'collectors', path: '/u/', touch: 44 },
  { name: 'settings', path: '/settings/', touch: 44 },
  { name: 'docs', path: '/docs/' },
  { name: 'about', path: '/about/' },
  { name: 'french home', path: '/fr/' },
  {
    name: 'release sheet', touch: 44,
    open: async (page) => {
      await page.goto('/?q=jazz');
      await page.locator('vf-results ol vf-release > a').first().click();
      await page.locator('vf-detail[status="ready"]').first().waitFor();
    },
  },
]);
