/**
 * The atproto OAuth client (large: loaded only when someone signs in or has signed in, session.js).
 * Production uses the published client metadata (public/client-metadata.json); plain-http development
 * (127.0.0.1) uses an atproto loopback client id with the same scope.
 */
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import config from '../../../data/atproto.json' with { type: 'json' };

export const SCOPE = ['atproto', ...Object.values(config.collections).map((nsid) => `repo:${nsid}`)].join(' ');

export function loadClient() {
  const { protocol, hostname, port, origin } = location;
  const clientId = protocol === 'http:'
    ? `http://localhost?${new URLSearchParams({ redirect_uri: `http://${hostname === 'localhost' ? '127.0.0.1' : hostname}:${port}${config.redirectPath}`, scope: SCOPE })}`
    : `${origin}/client-metadata.json`;
  return BrowserOAuthClient.load({ clientId, handleResolver: config.services.handleResolver });
}
