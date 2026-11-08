/**
 * Bluesky accounts signed in on this browser ("vf.atproto.accounts": [{ did, handle }]), each attached to one
 * local profile (profiles.js: the profile's `did`). Small and synchronous: pages read it without loading the
 * sign-in code; session.js loads that code only when there's an account (or a sign-in coming back).
 */
import { attachAccount, detachAccount, currentProfile } from '../watch/profiles.js';

const KEY = 'vf.atproto.accounts';

export function accounts() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Remember a signed-in account and attach it to a profile; returns whether the current profile changed. */
export function remember({ did, handle }) {
  save([...accounts().filter((a) => a.did !== did), { did, handle }]);
  return attachAccount(did, handle);
}

/** Signed out, or its session gone: forgotten here, its profile stays (local again). */
export function forget(did) {
  save(accounts().filter((a) => a.did !== did));
  detachAccount(did);
}

/** The account of the current profile, or null for a local profile. */
export function currentAccount() {
  const did = currentProfile()?.did;
  return (did && accounts().find((a) => a.did === did)) || null;
}

/** Back from the sign-in page: its answer is in the address. */
export const signInReturning = () => /[?#&]state=/.test(location.href) && /[?#&](code|error)=/.test(location.href);
