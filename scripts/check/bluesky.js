import dns from 'node:dns/promises';

/**
 * A shop's Bluesky account (atproto), checked with the shop:
 *   verified  the shop's own domain is its handle (@hardwax.com): a DNS TXT record _atproto.<domain> or
 *             https://<domain>/.well-known/atproto-did gives its DID. Only the domain's owner can set that up,
 *             so it proves the account is the shop's.
 *   linked    the shop's homepage links a profile (bsky.app/profile/<handle>): the shop's claim, not a proof.
 * Returns { handle, did, verified } or null.
 */
const DID = /^did:(plc|web):[\w.:%-]+$/;
const PROFILE = /bsky\.app\/profile\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi;
const NOT_SHOP = new Set(['bsky.app', 'bsky.social', 'atproto.com']);

const txtDid = async (host, resolveTxt) => {
  try {
    const record = (await resolveTxt(`_atproto.${host}`)).flat().join('');
    const did = record.replace(/^did=/, '');
    return record.startsWith('did=') && DID.test(did) ? did : null;
  } catch { return null; }
};

const wellKnownDid = async (host, fetchText) => {
  const text = (await fetchText(`https://${host}/.well-known/atproto-did`))?.trim();
  return text && DID.test(text) ? text : null;
};

export async function blueskyOf(host, html = '', { resolveTxt = dns.resolveTxt, fetchText } = {}) {
  const domain = host.replace(/^www\./, '');
  const did = (await txtDid(domain, resolveTxt)) || (fetchText ? await wellKnownDid(domain, fetchText) : null);
  if (did) return { handle: domain, did, verified: true };
  const linked = [...html.matchAll(PROFILE)].map((m) => m[1].toLowerCase()).find((h) => !NOT_SHOP.has(h));
  return linked ? { handle: linked, did: null, verified: false } : null;
}
