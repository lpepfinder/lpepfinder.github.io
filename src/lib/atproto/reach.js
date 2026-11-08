/**
 * Whether an error means the account's server was not reached (offline, a network failure, the server down or
 * busy: the writes wait and are sent later), not that it refused them (said at once). Pure, for sync.js,
 * publish.js and session.js; an error may carry the HTTP `status` it came with.
 */
export function notReached(err, online = globalThis.navigator?.onLine !== false) {
  if (!online) return true;
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth++) {
    if (e instanceof TypeError || e?.name === 'TypeError') return true;
    if (e?.status === 429 || e?.status >= 500) return true;
  }
  return false;
}

/** An error for an HTTP answer, carrying its status. */
export const httpError = (what, status) => Object.assign(new Error(`${what} ${status}`), { status });
