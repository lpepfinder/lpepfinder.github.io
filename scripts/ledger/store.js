import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { ndjsonReader } from '../lib/json.js';
import { emptyLedger } from './diff.js';

/**
 * Ledger file (gzipped ndjson):
 *   line 1      { "meta": { day, shops } }
 *   then        { "events": { day, list } } per day
 *   then        one row per offer
 */
export async function readLedger(file) {
  if (!fs.existsSync(file)) return null;
  const ledger = emptyLedger();
  for await (const line of ndjsonReader(file)) {
    if (line.offerKey) ledger.rows.set(line.offerKey, line);
    else if (line.events) ledger.events.push(line.events);
    else if (line.meta) ledger.meta = line.meta;
  }
  return ledger;
}

/** Just the meta line, without reading the rows. */
export async function readMeta(file) {
  if (!fs.existsSync(file)) return null;
  const input = fs.createReadStream(file).pipe(zlib.createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    lines.close();
    input.destroy();
    return JSON.parse(line).meta || null;
  }
  return null;
}

/** Written to a temporary file first, waiting for gzip to keep up (millions of rows). */
export async function writeLedger(file, ledger) {
  const tmp = `${file}.tmp`;
  const gz = zlib.createGzip({ level: 6 });
  const done = pipeline(gz, fs.createWriteStream(tmp));
  const write = async (obj) => { if (!gz.write(JSON.stringify(obj) + '\n')) await once(gz, 'drain'); };
  await write({ meta: ledger.meta });
  for (const e of ledger.events) await write({ events: e });
  for (const row of ledger.rows.values()) await write(row);
  gz.end();
  await done;
  fs.renameSync(tmp, file);
}
