import { test } from 'node:test';
import assert from 'node:assert/strict';
import { albumTitle, albumTitles, norm } from './titles.js';
import { due } from './due.js';

test('album titles from shop listings', () => {
  assert.equal(albumTitle('Nirvana – Bleach CD', 'Nirvana'), 'Bleach');
  assert.equal(albumTitle('Nirvana - From The Muddy Banks Of The Wishkah (CD, Album) (Very Good Plus (VG+))', 'Nirvana'), 'From The Muddy Banks Of The Wishkah');
  assert.equal(albumTitle('PINK FLOYD: Animals [2018 Remaster] Vinyl', 'Pink Floyd'), 'Animals');
  assert.equal(albumTitle('The Dark Side of the Moon - Pink Floyd', 'Pink Floyd'), 'The Dark Side of the Moon');
  assert.equal(albumTitle('Miles Davis - Kind Of Blue 12"', 'Miles Davis'), 'Kind Of Blue');
  assert.equal(albumTitle('Bob Dylan / Blonde On Blonde 2LP', 'Bob Dylan'), 'Blonde On Blonde');
  // a self-titled album after "Artist - ", but not the name alone
  assert.equal(albumTitle('Black Sabbath – Black Sabbath', 'Black Sabbath'), 'Black Sabbath');
  assert.equal(albumTitle('Talking Heads', 'Talking Heads'), null);
});

test('the most listed titles first, merch left out', () => {
  const listings = ['X - Patch', 'X - B Side LP', 'X - A Side', 'X - A Side (CD)', 'X - A Side 2LP', 'X - B Side'];
  assert.deepEqual(albumTitles(listings, 'X', 2, /\bpatch\b/i), ['A Side', 'B Side']);
  assert.equal(norm('The Beatles & Co.'), 'beatles and co');
});

test('due: new artists first, then the oldest past their age; overrides count as new', () => {
  const now = Date.parse('2026-11-07T00:00:00Z');
  const ago = (d) => new Date(now - d * 864e5).toISOString();
  const artists = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => ({ slug }));
  const cached = {
    b: { status: 'ok', at: ago(40) }, c: { status: 'ok', at: ago(5) }, d: { status: 'none', at: ago(40) },
    e: { status: 'ok', at: ago(50) }, f: { status: 'ok', at: ago(1) },
  };
  const order = due(artists, cached, { f: { mbid: 'x' } }, { refreshDays: 30, retryNoneDays: 60 }, now).map((a) => a.slug);
  assert.deepEqual(order, ['a', 'f', 'e', 'b']);
});
