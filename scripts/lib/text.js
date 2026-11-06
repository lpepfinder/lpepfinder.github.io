/** Text normalisation shared by the index builder and the browser search. */
export { normalize, tokenize, STOPWORDS, shardKey, shardFile } from '../../src/lib/search/tokenize.js';

export const slugify = (s) => String(s || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  .slice(0, 80);

const SEPARATOR = /\s+[-–—:|\/]\s+/;

/** Best-effort artist from "Artist - Title" style product titles. */
export function artistOf(title, vendor) {
  const t = String(title || '').trim();
  const v = String(vendor || '').trim();
  if (v && t.toLowerCase().startsWith(v.toLowerCase()) && v.length > 1) return v;
  const parts = t.split(SEPARATOR);
  if (parts.length > 1) {
    const a = parts[0].replace(/\*$/, '').replace(/\s*\(\d+\)$/, '').trim();
    if (a.length > 1 && a.length < 60 && !/^(various|va|v\/a|v\.a\.)$/i.test(a)) return a;
  }
  return null;
}

const NAMED = { prime: '′', Prime: '″', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×' };

export const decodeEntities = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(prime|Prime|ndash|mdash|hellip|rsquo|lsquo|rdquo|ldquo|times);/g, (_, n) => NAMED[n])
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

/** Product title as shown: no HTML tags (some shops put <br> in names), entities decoded, spaces collapsed. */
export const cleanTitle = (s) => decodeEntities(String(s || '').replace(/<[^>]{1,40}>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Shop name from a page title: decode entities, drop taglines after a separator. */
const GENERIC_NAME = /^(home|homepage|shop|store|online ?shop|welcome|index|startseite|accueil|inicio|boutique|tienda|negozio|record store|records?)$/i;

export function cleanShopName(name) {
  const decoded = decodeEntities(name).replace(/\s+/g, ' ').trim();
  if (GENERIC_NAME.test(decoded)) return '';
  // "Homepage: Record Shack -", "Dig Deep Records |": page-title words and dangling separators go
  const bare = decoded.replace(/^(?:home\s?page|home|welcome|start)\s*[:|–—-]\s*/i, '').replace(/\s*[–—|·•:-]+$/, '').trim();
  const first = bare.split(/\s+[–—|·•:]\s+|\s+-\s+/)[0].trim();
  return first.length >= 3 ? first : bare;
}

const LABELISH = /records|recordings|music|label|distribution|distro|ltd|inc|gmbh|s\.?r\.?l|vinyl|import|various/i;

/** Title as shown: prefix the artist when a shop puts it only in the vendor field. */
export function displayTitle(title, vendor) {
  const v = String(vendor || '').trim();
  // a vendor with its own separator ("Alliance - BT") is a distributor code, not an artist
  if (!v || v.length < 2 || LABELISH.test(v) || /^[A-Z0-9&]{2,4}$/.test(v) || /[-–—:/]/.test(v)) return title;
  // the title already names an artist ("Davis- Kind of Blue" counts too)
  // or quotes the album ('DAVIS, MILES "Kind of Blue"')
  if (/\S\s*[-–—:]\s+\S|\S\s+[-–—:]\s*\S|["“”«]/.test(title) || title.toLowerCase().includes(v.toLowerCase())) return title;
  return `${v} – ${title}`;
}
