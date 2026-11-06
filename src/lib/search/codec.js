/**
 * Binary format of the search index files, shared by the builder (Node) and the browser.
 *
 * Index files (i/<shard>.bin, d/<chunk>.bin) are gzip-compressed and served as plain bytes:
 * the browser decompresses them with DecompressionStream, so their compressed size is what
 * counts against the host's size limit.
 *
 * Shard (i/) layout, before gzip, all numbers unsigned LEB128 varints:
 *   tokenCount
 *   tokenCount × (tokenByteLength, token UTF-8 bytes, idCount, postingsByteLength)
 *   postings of each token in header order: ascending doc ids as deltas from the previous one
 * Chunk (d/) content is the JSON array of rows, UTF-8.
 */

const utf8 = new TextEncoder();
const text = new TextDecoder();

function writeVarint(out, n) {
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
  out.push(n);
}

function readVarint(bytes, pos) {
  let n = 0;
  let scale = 1;
  for (;;) {
    const b = bytes[pos.i++];
    n += (b & 0x7f) * scale;
    if (b < 0x80) return n;
    scale *= 128;
  }
}

/** [[token, ascending ids], ...] -> shard bytes (uncompressed). */
export function encodeShard(entries) {
  const header = [];
  const body = [];
  writeVarint(header, entries.length);
  for (const [token, ids] of entries) {
    const start = body.length;
    let prev = 0;
    for (const id of ids) { writeVarint(body, id - prev); prev = id; }
    const name = utf8.encode(token);
    writeVarint(header, name.length);
    for (const b of name) header.push(b);
    writeVarint(header, ids.length);
    writeVarint(header, body.length - start);
  }
  const out = new Uint8Array(header.length + body.length);
  out.set(header);
  out.set(body, header.length);
  return out;
}

/**
 * Shard bytes -> Map token -> { count, start, end }; ids(entry) decodes one token's postings.
 * Decoding is lazy: only the tokens a query uses are expanded.
 */
export function decodeShard(bytes) {
  const pos = { i: 0 };
  const n = readVarint(bytes, pos);
  const heads = [];
  for (let k = 0; k < n; k++) {
    const len = readVarint(bytes, pos);
    const token = text.decode(bytes.subarray(pos.i, pos.i + len));
    pos.i += len;
    heads.push([token, readVarint(bytes, pos), readVarint(bytes, pos)]);
  }
  const tokens = new Map();
  let at = pos.i;
  for (const [token, count, size] of heads) {
    tokens.set(token, { count, start: at, end: at + size, bytes });
    at += size;
  }
  return tokens;
}

/** Doc ids of one decoded shard entry. */
export function postingIds(entry) {
  const ids = new Array(entry.count);
  const pos = { i: entry.start };
  let prev = 0;
  for (let k = 0; k < entry.count; k++) ids[k] = prev += readVarint(entry.bytes, pos);
  return ids;
}

export const encodeChunk = (rows) => utf8.encode(JSON.stringify(rows));
export const decodeChunk = (bytes) => JSON.parse(text.decode(bytes));

/** True when bytes start with the gzip magic number (the host may have decompressed them already). */
export const isGzip = (bytes) => bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
