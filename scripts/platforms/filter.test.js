import test from 'node:test';
import assert from 'node:assert/strict';

test('merch and supplies are not records; records that mention them are', async () => {
  const { isMusicProduct } = await import('./filter.js');
  for (const t of ['Queen – Crew Socks Apparel', 'Extra postage cost (custom)', '10" CARD SLEEVE WITH CENTRE HOLE', '7" PVC SLEEVE, Pack of 10']) assert.equal(isMusicProduct(t), false, t);
  for (const t of ['JD McPherson - Socks Cassette', 'Mitch Ryder - Sock It To Me! Vinyl', 'Elton John - Captain Fantastic (Card Sleeve) LP', 'Grand Funk Railroad - Collected [2LP/ PVC Sleeve]']) assert.equal(isMusicProduct(t), true, t);
});

test('a product type that is gear, merch or clothes is not a record; a genre, a format or a soundtrack is', async () => {
  const { isMusicType } = await import('./filter.js');
  for (const type of ['Guitars', 'Drums & Percussion', 'Cables &amp; Adapters', 'Movies & TV', 'Jewelry', 'Hair Sticks Single', 'Toys & Collectibles', 'Merch']) assert.equal(isMusicType(type), false, type);
  for (const type of ['', null, 'Rock', 'Drum &amp; Bass', 'Blues, Soul, Jazz &amp; Related', 'LP / 12"', 'Film Soundtracks', 'Music', 'Instrumental', 'Vinyl Accessories']) assert.equal(isMusicType(type), true, type);
});
