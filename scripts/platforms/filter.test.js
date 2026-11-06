import test from 'node:test';
import assert from 'node:assert/strict';

test('merch and supplies are not records; records that mention them are', async () => {
  const { isMusicProduct } = await import('./filter.js');
  for (const t of ['Queen – Crew Socks Apparel', 'Extra postage cost (custom)', '10" CARD SLEEVE WITH CENTRE HOLE', '7" PVC SLEEVE, Pack of 10']) assert.equal(isMusicProduct(t), false, t);
  for (const t of ['JD McPherson - Socks Cassette', 'Mitch Ryder - Sock It To Me! Vinyl', 'Elton John - Captain Fantastic (Card Sleeve) LP', 'Grand Funk Railroad - Collected [2LP/ PVC Sleeve]']) assert.equal(isMusicProduct(t), true, t);
});
