import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, closest } from '../../src/lib/search/suggest.js';

test('edit distance, bounded', () => {
  assert.equal(distance('yamashta', 'yamashita'), 1);
  assert.equal(distance('kitten', 'sitting'), 3);
  assert.equal(distance('abc', 'abcdef'), 3);
  assert.equal(distance('davis', 'davis'), 0);
});

test('closest token in the shard, the most frequent on a tie', () => {
  const shard = { yamashita: '1.2.3.4', yamamoto: '5', yamasha: '1', yamashiro: '1.1' };
  assert.equal(closest('yamashta', shard), 'yamashita');
  assert.equal(closest('yamazzzzzz', shard), null);
  assert.equal(closest('yamashit', { yamashita: '1', yamashiti: '1.2' }), 'yamashiti');
});
