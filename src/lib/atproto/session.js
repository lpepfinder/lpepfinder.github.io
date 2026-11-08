/**
 * Bluesky sign-in (atproto OAuth): sessions of the accounts signed in on this browser (accounts.js).
 * The OAuth library is large: it loads only when there's an account, or a sign-in coming back.
 */
import { accounts, remember, forget, signInReturning } from './accounts.js';
import { notReached } from './reach.js';
import config from '../../../data/atproto.json' with { type: 'json' };

const sessions = new Map();
let loading = null;
const client = () => (loading ??= import('./client.js').then((m) => m.loadClient()));

/** "did:plc:…" -> its handle, from the DID document (alsoKnownAs). */
async function handleOf(did) {
  const doc = did.startsWith('did:web:')
    ? await fetch(`https://${did.slice(8)}/.well-known/did.json`).then((r) => r.json())
    : await fetch(`${config.services.plcDirectory}/${did}`).then((r) => r.json());
  return (doc.alsoKnownAs || []).find((a) => a.startsWith('at://'))?.slice(5) || did;
}

/**
 * On each page load: finish a sign-in coming back (then attach the account to a profile, profiles.js; the page
 * reloads when that is another profile), or restore the last session. Nothing loads without an account.
 */
export async function start() {
  if (!accounts().length && !signInReturning()) return null;
  const result = await (await client()).init();
  if (!result?.session) return null;
  const { did } = result.session;
  sessions.set(did, result.session);
  if (result.state !== undefined) {
    const moved = remember({ did, handle: await handleOf(did).catch(() => did) });
    if (result.state) history.replaceState(null, '', result.state);
    if (moved) location.reload();
  }
  return result.session;
}

/** The session of a signed-in account, restored (and refreshed) when needed. */
export async function sessionFor(did) {
  if (!sessions.has(did)) {
    try {
      sessions.set(did, await (await client()).restore(did));
    } catch (e) {
      // revoked or expired on the account's side: signed out here too; offline, it stays and waits
      if (!notReached(e)) forget(did);
      throw e;
    }
  }
  return sessions.get(did);
}

/** Go to the account's sign-in page; it comes back to config.redirectPath, then to the page it left. */
export async function signIn(handle) {
  await (await client()).signInRedirect(handle, { state: location.pathname + location.search });
}

export async function signOut(did) {
  const s = await sessionFor(did).catch(() => null);
  await s?.signOut().catch(() => {});
  sessions.delete(did);
  forget(did);
}
