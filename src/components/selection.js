/**
 * What a detail shows, in the URL (?r=<release key> on search and artist pages, ?shop=<id> on the
 * watchlist), so a link opens it and Back closes it. The first selection pushes a history entry;
 * switching replaces it, so Back leaves the detail in one step. Closing goes back when we pushed,
 * else drops the parameter from the URL.
 */
const PARAM = 'r';

const urlWith = (key, param) => {
  const url = new URL(location.href);
  if (key) url.searchParams.set(param, key);
  else url.searchParams.delete(param);
  return url;
};

/** The selected key, or null. */
export const selected = (param = PARAM) => new URLSearchParams(location.search).get(param);

/** Link of a row: this page and its filters, with the parameter. */
export const hrefFor = (key, param = PARAM) => {
  const url = urlWith(key, param);
  return url.pathname + url.search;
};

/** Select (the reader picked it). */
export function select(key, param = PARAM) {
  if (selected(param) === key) return;
  if (history.state?.[param]) history.replaceState({ [param]: key }, '', urlWith(key, param));
  else history.pushState({ [param]: key }, '', urlWith(key, param));
}

/** Leave the selection (close button, Escape). */
export function unselect(param = PARAM) {
  if (!selected(param)) return;
  if (history.state?.[param]) history.back();
  else history.replaceState(null, '', urlWith(null, param));
}

/** Drop the parameter without a history step (a link to something no longer there). */
export const forget = (param = PARAM) => history.replaceState(null, '', urlWith(null, param));
