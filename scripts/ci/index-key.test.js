import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indexKey, imports, ENTRY, DATA_FILES, SECTIONS, PICK } from './index-key.js';
import { config } from '../lib/config.js';

test('the index key: stable, from inputs that exist and config sections that exist', () => {
  assert.match(indexKey(), /^[0-9a-f]{16}$/);
  assert.equal(indexKey(), indexKey());
  for (const p of DATA_FILES) assert.ok(fs.existsSync(p), `${p} is gone: update scripts/ci/index-key.js`);
  const deps = imports(ENTRY);
  // the index's own code and the search code it shares with the browser count; the crawler's network code doesn't
  for (const f of ['scripts/index/search-index.js', 'scripts/ledger/update.js', 'scripts/quality/gate.js', 'src/lib/search/codec.js']) assert.ok(deps.has(f), f);
  assert.ok(!deps.has('scripts/lib/http.js'));
  for (const s of SECTIONS) assert.ok(config[s], `config.${s} is gone: update scripts/ci/index-key.js`);
  for (const [s, keys] of Object.entries(PICK)) for (const k of keys) assert.ok(k in config[s], `config.${s}.${k} is gone: update scripts/ci/index-key.js`);
});
