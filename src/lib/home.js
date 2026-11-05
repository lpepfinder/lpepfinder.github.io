import { defaultLanguage } from './i18n.js';

/** Home page content per language, CMS-editable in data/home/<lang>.json. */
const files = import.meta.glob('../../data/home/*.json', { eager: true, import: 'default' });
const byLang = Object.fromEntries(Object.entries(files).map(([p, data]) => [p.match(/(\w+)\.json$/)[1], data]));

export const homeContent = (lang) => byLang[lang] || byLang[defaultLanguage] || { try: [] };
