/** Country name ("Germany", "UK", "USA") -> ISO 3166-1 alpha-2, using the platform's region names. */
const names = new Intl.DisplayNames(['en'], { type: 'region' });
// withdrawn or reserved codes whose names would shadow real countries (FX "France" over FR)
const OUTDATED = new Set(['FX', 'YU', 'CS', 'SU', 'TP', 'ZR', 'BU', 'DD', 'NT', 'QO', 'EU', 'EZ', 'UN', 'ZZ', 'XA', 'XB']);
const byName = { uk: 'GB', usa: 'US', 'united states': 'US', 'united kingdom': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'south korea': 'KR', russia: 'RU' };
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b);
  if (OUTDATED.has(code)) continue;
  try { const n = names.of(code); if (n && n !== code) byName[n.toLowerCase()] ??= code; } catch { /* not a region */ }
}

export const countryCode = (name) => byName[String(name || '').trim().toLowerCase()] || null;

/** "Berlin, Germany" -> "DE" */
export const countryOfLocation = (location) => countryCode(String(location || '').split(',').pop());
