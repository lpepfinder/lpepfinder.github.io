import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSearchIndex } from './search-index.js';
import { encodeShard, decodeShard, postingIds } from '../../src/lib/search/codec.js';
import { SearchClient } from '../../src/lib/search/client.js';

test('shard codec: tokens, counts and ids round-trip', () => {
  const entries = [['approaching', [0, 5, 130, 70000, 4000000]], ['ジョイ', [3]], ['empty', []]];
  const shard = decodeShard(encodeShard(entries));
  assert.deepEqual([...shard.keys()], ['approaching', 'ジョイ', 'empty']);
  for (const [token, ids] of entries) {
    assert.equal(shard.get(token).count, ids.length);
    assert.deepEqual(postingIds(shard.get(token)), ids);
  }
});

test('the browser client searches the gzip index the builder writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-index-'));
  const shops = new Map([['oye', { name: 'Oye', state: { url: 'https://oye-records.com', currency: 'EUR', country: 'DE' } }]]);
  const docs = [
    { shop: 'oye', title: 'C/Fe – Approaching The Gaz Giant', price: 2400, path: '/releases/cfe', image: null, available: true },
    { shop: 'oye', title: 'Other – Record', price: 1500, path: '/products/other', image: null, available: true },
  ];
  buildSearchIndex({ docs, shops, outDir: dir, docsPerChunk: 1, maxDocFrequency: 1 });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const file = path.join(dir, url.slice('/search/'.length));
    return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response(null, { status: 404 });
  };
  try {
    const client = new SearchClient();
    const ids = await client.match('gaz giant');
    assert.deepEqual(ids, [0]);
    assert.deepEqual(await client.match('approa'), [0]);
    const [record] = await client.records(ids);
    assert.equal(record.url, 'https://oye-records.com/releases/cfe');
    assert.equal((await client.suggest('gaz giamt')).spelling, 'gaz giant');
  } finally {
    globalThis.fetch = realFetch;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
