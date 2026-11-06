import { catalog } from '../../lib/catalog.js';
import { json, apiShop, apiMeta } from '../../lib/api.js';

/** Every listed shop: name, site, place, records in stock, Bluesky account. */
export const GET = ({ site }) => json({ ...apiMeta(), shops: catalog().visible.map((s) => apiShop(site, s)) });
