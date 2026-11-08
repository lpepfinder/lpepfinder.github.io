import { Agent, setGlobalDispatcher } from 'undici';

/**
 * The scripts' network connections go through the undici package (package.json pins it) rather than the copy
 * built into Node: Node 22's copy can crash the whole process when a server closes a connection while a response
 * is paused (an assertion in Parser.finish, fixed in undici by nodejs/undici#5389 and #5474), and a check or crawl
 * of thousands of shops always meets such a server. fetch() stays the built-in one (tests can still replace it);
 * only the connections underneath change. Imported for its effect by every module that makes requests.
 */
setGlobalDispatcher(new Agent());
