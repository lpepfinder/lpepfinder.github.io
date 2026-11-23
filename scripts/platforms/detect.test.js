import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectTheme } from './detect.js';

test('a Shopify theme by its schema name, whatever the shop named its copy', () => {
  const html = '<script>Shopify.theme = {"name":"Dawn - Black Friday copy","id":1,"schema_name":"Dawn","schema_version":"15.0.0","theme_store_id":887,"role":"main"};</script>';
  assert.deepEqual(detectTheme(html), { name: 'Dawn', store: true });
  // a theme from elsewhere has no Theme Store id
  assert.deepEqual(detectTheme('Shopify.theme = {"name":"Record Loft","schema_name":null,"theme_store_id":null};'), { name: 'Record Loft', store: false });
});

test('a WordPress theme by its parent folder, a child theme by the parent it names', () => {
  assert.deepEqual(detectTheme('<link href="/wp-content/themes/astra-child/style.css"><link href="/wp-content/themes/astra/main.css">'), { name: 'astra' });
  assert.deepEqual(detectTheme('<link href="https://x.com/wp-content/themes/Divi-child/style.css">'), { name: 'divi' });
  assert.equal(detectTheme('<html>no theme here</html>'), null);
});
