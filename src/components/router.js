/**
 * Client-side navigation (Astro's ClientRouter) and this app's own history entries.
 *
 * Pages keep some state in the URL (?r= release, ?record=, ?shop=, ?view=) with history entries of their own,
 * so Back closes a sheet. Astro's router would treat such a Back as a page change and load the page again,
 * losing what is shown. history-guard.js (inline, first in <head>) stops those same-path history events
 * before the router sees them and fires "vf-popstate" instead, which the components listen to.
 *
 * A page in another language is loaded in full: dates, prices and plurals are formatted for one language;
 * so is a page from another deploy (<meta name="build">).
 * The URL moves before the swap, so components see the new page's address when they connect.
 */
// the path of the page before this one, for "‹ Back" links (vf-crumbs.js); null after a full load
let previous = null;
export const previousPath = () => previous;

document.addEventListener('astro:before-swap', (e) => {
  previous = location.pathname;
  // another language, or a page from another deploy (its scripts are other files: swapping it in would run
  // them next to this page's and register every component twice): load it in full
  const build = (doc) => doc.querySelector('meta[name="build"]')?.content;
  if (e.newDocument.documentElement.lang !== document.documentElement.lang || build(e.newDocument) !== build(document)) {
    e.swap = () => location.assign(e.to.href);
    return;
  }
  // The router moves the URL after the swap, but the new page's components read it as they connect
  // (?q=, ?view=, ?crate=): move it first, in the router's state format, and the router leaves it as it is.
  if (e.navigationType === 'traverse' || e.to.href === location.href) return;
  const step = e.navigationType === 'push' ? 1 : 0;
  const state = { index: (history.state?.index ?? 0) + step, scrollX: 0, scrollY: 0 };
  if (step) history.pushState(state, '', e.to.href); else history.replaceState(state, '', e.to.href);
});
