/**
 * The release the detail shows, in the URL as ?r=<key>, so a link opens it and Back closes it.
 * The first selection pushes a history entry; switching between releases replaces it, so Back
 * leaves the detail in one step. Closing goes back when we pushed, else drops r from the URL.
 */
const PARAM = 'r';

const urlWith = (key) => {
  const url = new URL(location.href);
  if (key) url.searchParams.set(PARAM, key);
  else url.searchParams.delete(PARAM);
  return url;
};

/** The selected key, or null. */
export const selected = () => new URLSearchParams(location.search).get(PARAM);

/** Link of a row: this page and its filters, with r. */
export const hrefFor = (key) => {
  const url = urlWith(key);
  return url.pathname + url.search;
};

/** Select a release (the reader picked it). */
export function select(key) {
  if (selected() === key) return;
  if (history.state?.[PARAM]) history.replaceState({ [PARAM]: key }, '', urlWith(key));
  else history.pushState({ [PARAM]: key }, '', urlWith(key));
}

/** Leave the selection (close button, Escape). */
export function unselect() {
  if (!selected()) return;
  if (history.state?.[PARAM]) history.back();
  else history.replaceState(null, '', urlWith(null));
}

/** Drop r without a history step (a deep link to a record that is no longer found). */
export const forget = () => history.replaceState(null, '', urlWith(null));
