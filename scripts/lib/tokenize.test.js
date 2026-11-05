import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/lib/search/tokenize.js';

test('catalog numbers match with or without a dash or space', () => {
  for (const q of ['UR-001', 'UR 001', 'ur001']) assert.ok(tokenize(q).includes('ur001'), q);
  assert.ok(tokenize('Axis AX-001').includes('ax001'));
});

test('label names keep "records"', () => {
  assert.deepEqual(tokenize('Axis Records'), ['axis', 'records']);
});
