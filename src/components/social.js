import config from '../../data/config.json' with { type: 'json' };

/**
 * The collectors feed (/social.json, scripts/social, docs/feed.md), fetched once per page:
 * who publishes lists, how many want and have each record, the records wanted lately, the most wanted.
 */
let data = null;
let loading = null;

/** The feed, loaded (null when there is none). */
export const loadSocial = () => (loading ??= fetch('/social.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => (data = d)));

/** { wanted, owned } collectors for a release key, if the feed is loaded and has any; else null. */
export function countsFor(key) {
  const wanted = data?.wanted?.[key] || 0;
  const owned = data?.owned?.[key] || 0;
  return wanted || owned ? { wanted, owned } : null;
}


/** A page of this language ("/u/" in English, "/fr/u/" in French). */
export const localPath = (path) => {
  const lang = document.documentElement.lang;
  return !lang || lang === config.defaultLanguage ? path : `/${lang}${path}`;
};
