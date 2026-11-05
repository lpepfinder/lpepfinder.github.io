import { config } from '../lib/config.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Record shops with a website from OpenStreetMap (shop=music, ODbL). */
export async function osmCandidates(retries = 2) {
  try { return await query(); } catch (e) {
    if (!retries) throw e;
    await new Promise((r) => setTimeout(r, 30_000));
    return osmCandidates(retries - 1);
  }
}

async function query() {
  // shops store their site under website, contact:website or url
  const query = '[out:json][timeout:180];(nwr["shop"="music"]["website"];nwr["shop"="music"]["contact:website"];nwr["shop"="music"]["url"];);out tags center;';
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'user-agent': config.crawl.userAgent, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`overpass_${res.status}`);
  const { elements = [] } = await res.json();
  return elements.map((e) => ({
    url: e.tags.website || e.tags['contact:website'] || e.tags.url,
    name: e.tags.name,
    country: e.tags['addr:country'],
    city: e.tags['addr:city'],
    osm: `${e.type}/${e.id}`,
    vinyl: e.tags['shop:music:vinyl'] === 'yes' || /vinyl|record|platten|disque|disco/i.test(e.tags.name || ''),
  }));
}
