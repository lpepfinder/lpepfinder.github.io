import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, shardKey, shardFile, artistOf, cleanShopName, displayTitle, decodeEntities, cleanTitle } from './text.js';

test('tokenize folds accents, case and stopwords', () => {
  assert.deepEqual(tokenize('Björk – Homogenic (LP, Vinyl)'), ['bjork', 'homogenic']);
  assert.deepEqual(tokenize("Guns N' Roses"), ['guns', 'roses']);
});

test('shard files are url safe', () => {
  assert.equal(shardKey('aphex'), 'aph');
  assert.equal(shardFile('aph'), 'aph');
  assert.match(shardFile('ジョイ'), /^[a-z0-9_]+$/);
});

test('artistOf reads "Artist - Title" and vendor fields', () => {
  assert.equal(artistOf('Aphex Twin - Drukqs'), 'Aphex Twin');
  assert.equal(artistOf('Drukqs', 'Warp'), null);
  assert.equal(artistOf('Various - Compilation'), null);
});

test('shop names and titles are cleaned for display', () => {
  assert.equal(cleanShopName('Amadeus Dischi &#8211; Musica dal 1986'), 'Amadeus Dischi');
  assert.equal(decodeEntities('Argy&#039;s'), "Argy's");
  assert.equal(cleanTitle('Aphex Twin: <br>Cheetah EP [12&Prime;]'), 'Aphex Twin: Cheetah EP [12″]');
  assert.equal(displayTitle('Syro (New 3LP)', 'Aphex Twin'), 'Aphex Twin – Syro (New 3LP)');
  assert.equal(displayTitle('Drukqs', 'Warp Records'), 'Drukqs');
});
