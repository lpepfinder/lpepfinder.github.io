import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEcb } from './parse.js';

test('ECB daily XML becomes a date and rates per euro', () => {
  const xml = `<gesmes:Envelope><Cube><Cube time='2026-11-05'>
    <Cube currency='USD' rate='1.1224'/><Cube currency="JPY" rate="177.85"/><Cube currency='GBP' rate='0.83393'/>
  </Cube></Cube></gesmes:Envelope>`;
  assert.deepEqual(parseEcb(xml), { date: '2026-11-05', rates: { USD: 1.1224, JPY: 177.85, GBP: 0.83393 } });
});

test('anything else gives null, so the previous file is kept', () => {
  assert.equal(parseEcb('<html>maintenance</html>'), null);
  assert.equal(parseEcb(''), null);
});
