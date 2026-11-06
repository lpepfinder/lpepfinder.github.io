/**
 * Client-side navigation (Astro's ClientRouter) and this app's own history entries.
 *
 * Pages keep some state in the URL (?r= release, ?record=, ?shop=, ?view=) with history entries of their own,
 * so Back closes a sheet. Astro's router would treat such a Back as a page change and load the page again,
 * losing what is shown. history-guard.js (inline, first in <head>) stops those same-path history events
 * before the router sees them and fires "vf-popstate" instead, which the components listen to.
 *
 * A page in another language is loaded in full: dates, prices and plurals are formatted for one language.
 * The URL moves before the swap, so components see the new page's address when they connect.
 */
document.addEventListener('astro:before-swap', (e) => {
  if (e.newDocument.documentElement.lang !== document.documentElement.lang) {
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
