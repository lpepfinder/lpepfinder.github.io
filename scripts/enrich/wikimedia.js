import { json } from './http.js';

/**
 * Wikimedia, no key (https://www.mediawiki.org/wiki/API:Etiquette): one request at a time, the bot named.
 *   Wikidata (CC0): ids and links of an item; Wikipedia (CC BY-SA 4.0): a page's summary;
 *   Commons: an image's thumbnail with its author and licence, which the page must show.
 */
const WIKIDATA = 'https://www.wikidata.org/w/api.php';

const value = (claims, p) => claims?.[p]?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value ?? null;

/** Q-id from a Wikidata URL. */
export const qid = (url) => String(url || '').match(/\/(Q\d+)$/)?.[1] || null;

/** An item's links: Wikipedia titles by language, website, YouTube channel, Bluesky handle, Discogs id, Commons image. */
export async function item(id, languages) {
  const sites = languages.map((l) => `${l}wiki`).join('|');
  const data = await json(`${WIKIDATA}?action=wbgetentities&ids=${id}&props=claims|sitelinks&sitefilter=${sites}&format=json`);
  const e = data?.entities?.[id];
  if (!e || e.missing != null) return null;
  const c = e.claims || {};
  return {
    wikipedia: Object.fromEntries(languages.filter((l) => e.sitelinks?.[`${l}wiki`]).map((l) => [l, e.sitelinks[`${l}wiki`].title])),
    website: value(c, 'P856'), youtube: value(c, 'P2397'), bluesky: value(c, 'P12361'), discogs: value(c, 'P1953'),
    image: value(c, 'P18'),
  };
}

/** A Wikipedia page's lead as plain text, with its address; null when missing or a disambiguation page. */
export async function summary(lang, title) {
  const s = await json(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (!s?.extract || s.type === 'disambiguation') return null;
  return { text: s.extract, title: s.title, url: s.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` };
}

const text = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** A Commons file ("Nirvana around 1992.jpg"): thumbnail, page, author and licence; null without a free licence. */
export async function image(file, width) {
  const data = await json(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${file}`)}&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=${width}&format=json`);
  const info = Object.values(data?.query?.pages || {})[0]?.imageinfo?.[0];
  const m = info?.extmetadata || {};
  const license = text(m.LicenseShortName?.value);
  if (!info?.thumburl || !license) return null;
  return {
    src: info.thumburl.replace(/[?&]utm_[^&]*/g, '').replace(/\?$/, ''), width: info.thumbwidth, height: info.thumbheight,
    page: info.descriptionurl, author: text(m.Artist?.value) || null, license, licenseUrl: m.LicenseUrl?.value || null,
  };
}
