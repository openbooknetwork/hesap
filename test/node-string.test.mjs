// Checks string of src/node.mjs, which reads one of hesap's strings at build time for a link that shows a word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { string } from '../src/node.mjs';

test('string: a key reads in English and in Turkish, and a language without a file reads English', () => {
  assert.equal(string('en', 'counters_tag-more'), 'more');
  assert.equal(string('tr', 'counters_tag-more'), 'daha çok');
  assert.equal(string('fi', 'counters_tag-more'), 'more');
});

test('string: the values fill the places of a string, and a string of the word true stays a word', () => {
  assert.equal(string('en', 'counters_reading-less', { a: '5', b: '8' }), '5 is less than 8');
  assert.equal(string('en', 'counters_tag-fewer-n', { n: '10' }), '10 fewer');
  assert.equal(string('en', 'counters_verdict-true'), 'true');
  assert.equal(string('en', 'counters_no-such-key'), undefined);
});
