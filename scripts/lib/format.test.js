import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat } from '../../src/lib/search/format.js';

const grade = (title) => detectFormat(title).grade?.code || null;

test('used-condition grades from titles: codes anywhere, words only on used records', () => {
  assert.equal(grade('Can - Tago Mago LP (VG+/NM)'), 'VG+');
  assert.equal(grade('Wire - Pink Flag LP [NM]'), 'NM');
  assert.equal(grade('Used: Miles Davis - Kind of Blue LP near mint'), 'NM');
  assert.equal(grade('Sun Ra - Lanquidity (G+)'), 'G+');
  assert.equal(grade('Mint Royale - On the Ropes LP'), null);
  assert.equal(grade('NMB48 - Single'), null);
  assert.equal(detectFormat('Joy Division - Closer LP VG').used, true);
});
