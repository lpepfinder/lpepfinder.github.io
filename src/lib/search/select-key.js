import { hash48 } from './release-key.js';

/** The ?r= key of a release group: its release key, or "u" + a hash of the URL of a single copy without one. */
export const selectKey = (group) => group.watchKey || `u${hash48(group.offers[0].url)}`;
