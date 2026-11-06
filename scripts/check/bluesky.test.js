import test from 'node:test';
import assert from 'node:assert/strict';
import { blueskyOf } from './bluesky.js';

const noTxt = async () => { throw new Error('ENODATA'); };

test('bluesky: the domain as handle (DNS or well-known) is verified', async () => {
  const resolveTxt = async (name) => (name === '_atproto.hardwax.com' ? [['did=did:plc:abc123']] : noTxt());
  assert.deepEqual(await blueskyOf('www.hardwax.com', '', { resolveTxt }), { handle: 'hardwax.com', did: 'did:plc:abc123', verified: true });
  const fetchText = async (url) => (url === 'https://shop.de/.well-known/atproto-did' ? 'did:plc:xyz\n' : null);
  assert.deepEqual(await blueskyOf('shop.de', '', { resolveTxt: noTxt, fetchText }), { handle: 'shop.de', did: 'did:plc:xyz', verified: true });
});

test('bluesky: a profile linked from the homepage is a claim, not verified; Bluesky itself is not a shop', async () => {
  const html = '<a href="https://bsky.app/profile/bsky.app">Bluesky</a> <a href="https://bsky.app/profile/Flight13.bsky.social">follow</a>';
  assert.deepEqual(await blueskyOf('flight13.com', html, { resolveTxt: noTxt, fetchText: async () => null }), { handle: 'flight13.bsky.social', did: null, verified: false });
  assert.equal(await blueskyOf('none.com', '<p>no links</p>', { resolveTxt: noTxt, fetchText: async () => '<html>' }), null);
});
