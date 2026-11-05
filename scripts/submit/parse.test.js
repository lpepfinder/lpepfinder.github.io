import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueForm, countryFrom } from './parse.js';
import { countryCode } from '../lib/country.js';

test('issue form body is read into fields', () => {
  const body = '### Website\n\nhttps://oye-records.com\n\n### Shop name\n\nOye\n\n### City\n\n_No response_\n\n### Country\n\nGermany (DE)';
  assert.deepEqual(parseIssueForm(body), { Website: 'https://oye-records.com', 'Shop name': 'Oye', City: '', Country: 'Germany (DE)' });
});

test('country from a name or a code', () => {
  const codeOf = (v) => (v.length === 2 ? (countryCode(v) ? v : null) : countryCode(v));
  assert.equal(countryFrom('Germany (DE)', codeOf), 'DE');
  assert.equal(countryFrom('France', codeOf), 'FR');
  assert.equal(countryFrom('', codeOf), null);
});
