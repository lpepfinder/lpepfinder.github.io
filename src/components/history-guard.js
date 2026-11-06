// Inline and first in <head> (Base.astro), so this popstate listener runs before the router's: a history step
// that stays on the same path (an open sheet, a tab of the watchlist, a search) is the page's own state, given to
// the components as "vf-popstate"; one to another path is a page change, left to the router.
(() => {
  let path = location.pathname;
  addEventListener('popstate', (e) => {
    if (location.pathname === path) {
      e.stopImmediatePropagation();
      dispatchEvent(new Event('vf-popstate'));
    } else path = location.pathname;
  });
  document.addEventListener('astro:after-swap', () => { path = location.pathname; });
})();
