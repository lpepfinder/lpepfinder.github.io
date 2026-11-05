import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { GENERATED } from '../../lib/paths.js';
import { sleep } from '../../lib/pool.js';
import { site, userAgent } from './settings.js';
import { canonical, isProductUrl } from './links.js';
import { addUrl } from './store.js';

/**
 * Common Crawl seed: product-looking URLs of our shops from the latest crawls' URL index,
 * added to each shop's URL registry so we fetch them ourselves later, politely, as usual.
 * No index server: binary-search each crawl's cluster.idx (downloaded once), then read
 * only the matching compressed CDX blocks with HTTP range requests on data.commoncrawl.org.
 */
const DATA = 'https://data.commoncrawl.org';
const cc = site.commonCrawl;

/** GET a whole body (Buffer) with retries; connections to S3/CloudFront do drop now and then. */
async function get(url, headers = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': userAgent, ...headers }, signal: AbortSignal.timeout(600_000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      await res.body?.cancel();
      if (res.status < 500 && res.status !== 429) return null;
    } catch { /* network error: retry */ }
    await sleep(5000 * 2 ** attempt);
  }
  return null;
}

/** cluster.idx of a crawl (~100 MB), kept on disk for local re-runs. */
async function clusterIndex(crawl) {
  const file = path.join(GENERATED, 'commoncrawl', `${crawl}-cluster.idx.gz`);
  if (fs.existsSync(file)) return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
  const buf = await get(`${DATA}/cc-index/collections/${crawl}/indexes/cluster.idx`);
  if (!buf) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(buf, { level: 1 }));
  return buf.toString('utf8');
}

/** SURT key prefix of a host, as Common Crawl writes it ("com,oye-records)/"). */
export const surtPrefix = (host) => host.toLowerCase().replace(/^www\./, '').split('.').reverse().join(',') + ')/';

/** Latest crawl ids, from the public crawl list (one small static file). */
export async function latestCrawls(n) {
  if (cc.crawls?.length) return cc.crawls.slice(0, n);
  const buf = await get('https://index.commoncrawl.org/collinfo.json');
  let list = [];
  try { list = JSON.parse(buf); } catch { /* none */ }
  return list.map((c) => c.id).filter((id) => /^CC-MAIN-\d{4}-\d{2}$/.test(id)).slice(0, n);
}

/** cluster.idx lines -> sorted block list: { key, file, offset, length }. */
export function parseClusterIndex(text) {
  const blocks = [];
  for (const line of text.split('\n')) {
    const [key, file, offset, length] = line.split('\t');
    if (length) blocks.push({ key, file, offset: Number(offset), length: Number(length) });
  }
  return blocks;
}

/** Blocks that may hold keys starting with `prefix`: the one before the first match, and all matches. */
export function blocksFor(blocks, prefix) {
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (blocks[mid].key < prefix) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = Math.max(0, lo - 1); i < blocks.length && (i < lo || blocks[i].key.startsWith(prefix)); i++) out.push(blocks[i]);
  return out;
}

/** CDX lines ("<surt> <timestamp> {json}") -> product-looking page URLs on `origin`. */
export function productUrls(cdxText, prefix, origin) {
  const out = new Set();
  for (const line of cdxText.split('\n')) {
    if (!line.startsWith(prefix)) continue;
    const json = line.slice(line.indexOf('{'));
    let row;
    try { row = JSON.parse(json); } catch { continue; }
    if (row.status !== '200' || !/html/.test(row.mime || row['mime-detected'] || '')) continue;
    const u = canonical(row.url, origin);
    if (u && isProductUrl(u)) out.add(u);
  }
  return out;
}

/** Read consecutive blocks of one CDX file with a single range request. */
async function readBlocks(crawl, blocks) {
  const first = blocks[0];
  const last = blocks.at(-1);
  const buf = await get(`${DATA}/cc-index/collections/${crawl}/indexes/${first.file}`, { range: `bytes=${first.offset}-${last.offset + last.length - 1}` });
  if (!buf) return '';
  try { return zlib.gunzipSync(buf).toString('utf8'); } catch { return ''; }
}

const groups = (blocks) => {
  const out = [];
  for (const b of blocks) {
    const g = out.at(-1);
    const prev = g?.at(-1);
    if (prev && prev.file === b.file && prev.offset + prev.length === b.offset) g.push(b);
    else out.push([b]);
  }
  return out;
};

/**
 * Add Common Crawl product URLs to the shops' registries. `shops`: [{ id, origin, st }].
 * Returns { crawls, shops: { id: added }, seconds }.
 */
export async function seedFromCommonCrawl(shops, { deadline, log = console.log } = {}) {
  const t0 = Date.now();
  const crawls = await latestCrawls(cc.crawls?.length || cc.latest);
  const added = {};
  for (const crawl of crawls) {
    if (Date.now() > deadline) break;
    const idx = await clusterIndex(crawl);
    if (!idx) { log(`commoncrawl: no cluster.idx for ${crawl}`); continue; }
    const blocks = parseClusterIndex(idx);
    log(`commoncrawl: ${crawl} ${blocks.length} blocks`);
    for (const shop of shops) {
      if (Date.now() > deadline) break;
      const prefix = surtPrefix(new URL(shop.origin).host);
      const mine = blocksFor(blocks, prefix).slice(0, cc.maxBlocksPerShop);
      const urls = new Set();
      for (const g of groups(mine)) {
        for (const u of productUrls(await readBlocks(crawl, g), prefix, shop.origin)) urls.add(u);
        await sleep(cc.delayMs);
      }
      let n = 0;
      for (const u of urls) if (addUrl(shop.st, u, 1, site.maxUrls, { s: 'cc' })) n++;
      added[shop.id] = (added[shop.id] || 0) + n;
      shop.st.ccAt = new Date().toISOString();
      shop.st.ccSeen = null;
    }
  }
  return { crawls, shops: added, seconds: Math.round((Date.now() - t0) / 1000) };
}
