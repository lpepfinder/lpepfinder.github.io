/**
 * This build's id: the commit in CI, else the time the build started. Every page carries it (<meta name="build">),
 * so client-side navigation can tell a page from another deploy (router.js) and load it in full.
 */
export const BUILD = (process.env.GITHUB_SHA || '').slice(0, 12) || new Date().toISOString();
