/** "Artist – Title" product titles: split on the first spaced dash or colon. */
const SEPARATOR = /\s+[-–—:]\s+/;

export function splitTitle(text) {
  const s = String(text || '').trim();
  const m = SEPARATOR.exec(s);
  if (!m || m.index < 2 || m.index > 60) return { artist: '', title: s };
  const title = s.slice(m.index + m[0].length).trim();
  return title ? { artist: s.slice(0, m.index).trim(), title } : { artist: '', title: s };
}
