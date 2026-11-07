import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indexKey, INPUTS, SECTIONS, PICK } from './index-key.js';
import { config } from '../lib/config.js';

test('the index key: stable, from inputs that exist and config sections that exist', () => {
  assert.match(indexKey(), /^[0-9a-f]{16}$/);
  assert.equal(indexKey(), indexKey());
  for (const p of INPUTS) assert.ok(fs.existsSync(p), `${p} is gone: update scripts/ci/index-key.js`);
  for (const s of SECTIONS) assert.ok(config[s], `config.${s} is gone: update scripts/ci/index-key.js`);
  for (const [s, keys] of Object.entries(PICK)) for (const k of keys) assert.ok(k in config[s], `config.${s}.${k} is gone: update scripts/ci/index-key.js`);
});
