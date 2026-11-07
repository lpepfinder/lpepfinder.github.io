import { test } from 'node:test';
import assert from 'node:assert/strict';

// the sources, answered from memory: one artist found through its album
const MBID = '5b11f4ce-a62d-471e-81fc-a69a8278c7da';
const answers = [
  [/musicbrainz\.org\/ws\/2\/release-group/, { 'release-groups': [
    { score: 100, title: 'Bleach', 'artist-credit': [{ name: 'Nirvana', artist: { id: MBID, name: 'Nirvana' } }] },
    { score: 95, title: 'Bleach', 'artist-credit': [{ name: 'Nirvana', artist: { id: 'other', name: 'Nirvana (UK)' } }] },
  ] }],
  [/musicbrainz\.org\/ws\/2\/artist\//, { id: MBID, name: 'Nirvana', type: 'Group', country: 'US', 'life-span': { begin: '1987', end: '1994-04-05', ended: true },
    genres: [{ name: 'rock', count: 3 }, { name: 'grunge', count: 9 }],
    relations: [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q11649' } }, { type: 'discogs', url: { resource: 'https://www.discogs.com/artist/125246' } }] }],
  [/wikidata\.org/, { entities: { Q11649: { sitelinks: { enwiki: { title: 'Nirvana (band)' } }, claims: {
    P2397: [{ mainsnak: { datavalue: { value: 'UCabc' } } }], P18: [{ mainsnak: { datavalue: { value: 'Nirvana around 1992.jpg' } } }] } } } }],
  [/wikipedia\.org\/api/, { type: 'standard', title: 'Nirvana (band)', extract: 'Nirvana was an American rock band.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Nirvana_(band)' } } }],
  [/commons\.wikimedia\.org/, { query: { pages: { 1: { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x.jpg?utm_source=a&utm_campaign=b', thumbwidth: 480, thumbheight: 400, descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
    extmetadata: { Artist: { value: '<a href="x">P.B. Rage</a>' }, LicenseShortName: { value: 'CC BY-SA 2.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/2.0' } } }] } } } }],
];
const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  const hit = answers.find(([re]) => re.test(url));
  return hit ? new Response(JSON.stringify(hit[1]), { status: 200 }) : new Response('{}', { status: 404 });
};
const { profile } = await import('./artist.js');
const opts = { titlesPerArtist: 3, genres: 5, wikipediaLanguages: ['en'], imageWidth: 480, exclude: /\bpatch\b/i };

test('a profile from the album, credited to the artist of that exact name', async () => {
  const p = await profile({ name: 'Nirvana', listings: ['Nirvana - Bleach LP', 'Nirvana - Patch'] }, {}, opts);
  assert.equal(p.status, 'ok');
  assert.equal(p.mbid, MBID);
  assert.deepEqual(p.genres, ['grunge', 'rock']);
  assert.equal(p.summary.en.text, 'Nirvana was an American rock band.');
  assert.equal(p.links.youtube, 'https://www.youtube.com/channel/UCabc');
  assert.equal(p.links.discogs, 'https://www.discogs.com/artist/125246');
  assert.equal(p.image.src, 'https://upload.wikimedia.org/x.jpg');
  assert.equal(p.image.author, 'P.B. Rage');
  assert.deepEqual(p.sources, ['musicbrainz', 'wikidata', 'wikipedia', 'commons']);
  // one album was enough; the merch listing was never asked about
  assert.equal(asked.filter((u) => u.includes('release-group')).length, 1);
  assert.ok(asked.every((u) => !/patch/i.test(decodeURIComponent(u))));
});

test('no album found: no profile; hidden and named artists follow the override', async () => {
  assert.equal((await profile({ name: 'Unknown', listings: ['Unknown - Nothing'] }, {}, opts)).status, 'none');
  assert.equal((await profile({ name: 'Nirvana', listings: [] }, { hide: true }, opts)).status, 'hidden');
  assert.equal((await profile({ name: 'Nirvana', listings: [] }, { mbid: MBID }, opts)).mbid, MBID);
});
