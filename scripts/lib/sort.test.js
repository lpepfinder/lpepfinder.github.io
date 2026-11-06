import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortKey, byName, letterOf, groupBy } from '../../src/lib/sort.js';

test('names sort without leading articles and punctuation', () => {
  assert.equal(sortKey('The Beatles'), 'Beatles');
  assert.equal(sortKey('"Les Rita Mitsouko"'), 'Rita Mitsouko');
  const names = ['The Beatles', 'ABBA', 'Björk', 'a-ha', '!!!'].sort(byName('en'));
  assert.deepEqual(names, ['!!!', 'ABBA', 'a-ha', 'The Beatles', 'Björk']);
});

test('letters for jump bars and grouping', () => {
  assert.equal(letterOf('The Beatles'), 'B');
  assert.equal(letterOf('Émilie Simon'), 'E');
  assert.equal(letterOf('山下達郎'), '#');
  const g = groupBy(['b1', 'a2', 'a1'], (x) => x[0], (a, b) => a.localeCompare(b), (a, b) => a.localeCompare(b));
  assert.deepEqual(g, [['a', ['a1', 'a2']], ['b', ['b1']]]);
});
