import { accounts, signInReturning } from '../lib/atproto/accounts.js';

/**
 * Loaded on every page, tiny: with a Bluesky account on this browser (or a sign-in coming back), starts the
 * session and the sync (large code, loaded only then). SYNC_EVENT's detail, also kept for components that
 * start later (syncState): { state: "syncing|synced|offline|error", waiting: changes not sent yet }.
 * <vf-account> and the watch page's sources show it.
 */
export const SYNC_EVENT = 'vf-sync';
let started = false;
let last = null;
export const syncState = () => last;

export async function boot() {
  if (started || (!accounts().length && !signInReturning())) return;
  started = true;
  const report = (s) => { last = s; dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: s })); };
  const [{ start }, { keepInSync }, { notReached }] = await Promise.all([
    import('../lib/atproto/session.js'), import('../lib/atproto/sync.js'), import('../lib/atproto/reach.js'),
  ]);
  try {
    await start();
    await keepInSync(report);
  } catch (e) {
    // offline at load: the session can't be restored yet; changes stay here and the sync starts once back online
    if (notReached(e)) {
      report({ state: 'offline', waiting: null });
      addEventListener('online', () => { started = false; boot(); }, { once: true });
    } else { console.error(e); report({ state: 'error', waiting: null }); }
  }
}
boot();
