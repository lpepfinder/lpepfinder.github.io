import { accounts, signInReturning } from '../lib/atproto/accounts.js';

/**
 * Loaded on every page, tiny: with a Bluesky account on this browser (or a sign-in coming back), starts the
 * session and the sync (large code, loaded only then). <vf-account> shows their state.
 */
export const SYNC_EVENT = 'vf-sync';
let started = false;

export async function boot() {
  if (started || (!accounts().length && !signInReturning())) return;
  started = true;
  const [{ start }, { keepInSync }] = await Promise.all([import('../lib/atproto/session.js'), import('../lib/atproto/sync.js')]);
  const state = (s) => dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: s }));
  try {
    await start();
    await keepInSync(state);
  } catch (e) {
    console.error(e);
    state('error');
  }
}
boot();
