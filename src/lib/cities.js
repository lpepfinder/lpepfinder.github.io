import data from '../../data/cities.json' with { type: 'json' };

/**
 * A shop's city as one name per city (data/cities.json): "Greater London" and "London" are London, 渋谷区 is
 * Tokyo, Wien is Vienna. The name is English (a city not listed keeps the shop's spelling); `cityName` gives
 * it in a page's language, and `citySlug` its URL segment (/shops/<country>/<slug>/), empty for a name with no
 * Latin letters, which then gets no page.
 */
const key = (cc, name) => `${cc}|${String(name).trim().toLocaleLowerCase()}`;
const canonical = new Map();
const names = new Map();
for (const [cc, cities] of Object.entries(data.cities)) {
  for (const [name, city] of Object.entries(cities)) {
    for (const alias of [name, ...(city.aliases || [])]) canonical.set(key(cc, alias), name);
    names.set(`${cc}|${name}`, city.names || {});
  }
}

/** The city's one name: "GB", "Greater London" -> "London"; null without a city. */
export const cityOf = (cc, city) => (city?.trim() ? canonical.get(key(cc, city)) || city.trim() : null);

/** The city's name in `lang`: "AT", "Vienna", "de" -> "Wien". */
export const cityName = (lang, cc, name) => names.get(`${cc}|${name}`)?.[lang] || name;

/** For the search (places.json): [{ en, fr…: name }, [local spellings]] of a city. */
export const cityNames = (cc, name) => {
  const city = data.cities[cc]?.[name] || {};
  return [{ en: name, ...city.names }, city.aliases || []];
};

/** "Saint Petersburg" -> "saint-petersburg", "Montréal" -> "montreal"; "" for a name with no Latin letters. */
export const citySlug = (name) => String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
