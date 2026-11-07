/**
 * Bluesky accounts signed in on this browser ("vf.atproto.accounts": [{ did, handle }]), each linked to a
 * local profile (profiles.js) whose id is "at:<did>". Small and synchronous: pages read it without loading
 * the sign-in code; session.js loads that code only when there's an account (or a sign-in coming back).
 */
import { profiles, ensure } from '../watch/profiles.js';

const KEY = 'vf.atproto.accounts';
export const profileId = (did) => `at:${did}`;

export function accounts() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Remember a signed-in account and switch to its profile ("@handle"). */
export function remember({ did, handle }) {
  save([...accounts().filter((a) => a.did !== did), { did, handle }]);
  ensure(profileId(did), `@${handle}`);
}

export const forget = (did) => save(accounts().filter((a) => a.did !== did));

/** The account of the current profile, or null for a local profile. */
export function currentAccount() {
  const { current } = profiles();
  return accounts().find((a) => profileId(a.did) === current) || null;
}

/** Back from the sign-in page: its answer is in the address. */
export const signInReturning = () => /[?#&]state=/.test(location.href) && /[?#&](code|error)=/.test(location.href);
