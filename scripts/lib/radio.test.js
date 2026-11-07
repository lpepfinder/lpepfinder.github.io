import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOf, discogsRef, songOf } from '../../src/lib/watch/radio.js';

test('radio: handles, Discogs links and song titles', () => {
  assert.equal(handleOf('@Hwww.org'), 'hwww.org');
  assert.equal(handleOf('https://bsky.app/profile/0sk.ar'), '0sk.ar');
  assert.deepEqual(discogsRef('https://www.discogs.com/release/123-Moodymann-Black-Mahogani'), { kind: 'release', id: 123 });
  assert.deepEqual(discogsRef('https://www.discogs.com/fr/master/456'), { kind: 'master', id: 456 });
  assert.equal(discogsRef('https://youtube.com/watch?v=x'), null);
  assert.deepEqual(songOf('Prince - 17 Days (Piano & A Microphone 1983 Version)'), { artist: 'Prince', song: '17 Days' });
  assert.equal(songOf('Guy plays drums on a keyboard'), null);
});

test('radio matching: a listing counts when it holds the artist and the song', async () => {
  const { holds } = await import('../../src/lib/watch/radio-match.js');
  const song = { artist: 'Prince', song: '17 Days' };
  assert.equal(holds('Prince - When Doves Cry / 17 Days (7")', song), true);
  assert.equal(holds('Prince - Purple Rain (LP)', song), false);
  assert.equal(holds('Princess - 17 Days', song), false);
  assert.equal(holds('The Alan Parsons Project – The Instrumental Works', { artist: 'Q Project', song: 'The Instrumental' }), false);
  assert.equal(holds("Pulp – Spike Island; Single 7″", { artist: 'Pulp', song: 'Spike Island' }), true);
});
