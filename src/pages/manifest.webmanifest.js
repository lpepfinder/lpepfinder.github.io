import config from '../../data/config.json';
import { t, defaultLanguage } from '../lib/i18n.js';

/** Web app manifest: "Add to home screen" keeps the watchlist from Safari's storage purge. */
const m = config.manifest;
export const GET = () => new Response(JSON.stringify({
  name: config.name,
  short_name: m.shortName,
  description: t(defaultLanguage, 'homeTitle'),
  start_url: '/',
  scope: '/',
  display: m.display,
  theme_color: m.themeColor,
  background_color: m.backgroundColor,
  icons: [{ src: m.icon, sizes: m.iconSize, type: 'image/png', purpose: 'any' }],
}, null, 2), { headers: { 'content-type': 'application/manifest+json' } });
