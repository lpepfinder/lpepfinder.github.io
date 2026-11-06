import test from 'node:test';
import assert from 'node:assert/strict';
import { docsHref } from '../../src/lib/docs-links.js';

test('docs links: page.md becomes /docs/page/, external and other links stay', () => {
  assert.equal(docsHref('watchlist.md'), '/docs/watchlist/');
  assert.equal(docsHref('./dig.md#the-crates'), '/docs/dig/#the-crates');
  assert.equal(docsHref('index.md'), '/docs/');
  assert.equal(docsHref('https://github.com/x/README.md'), null);
  assert.equal(docsHref('/shops/'), null);
});
