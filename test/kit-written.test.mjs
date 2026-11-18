// Checks the kit's written line: its words, its reading aloud in both languages and the pieces a figure draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUS, MINUS, answerOf, parts, words, reading, readingKey } from '../src/kit/written.js';
import { numbers } from '../src/kit/format.js';
import { string } from '../src/node.mjs';

const say = (line, lang) => reading(line, numbers(lang).int, (key, vars) => string(lang, `hesap_${key}`, vars));

test('written: a line writes its numbers and signs with a space either side of each sign', () => {
  const int = numbers('en').int;
  assert.equal(words({ a: 5, sign: PLUS, b: 3 }, int), '5 + 3 = 8');
  assert.equal(words({ a: 9, sign: MINUS, b: 4 }, int), '9 − 4 = 5');
  assert.equal(words({ a: 13, sign: MINUS, b: 8, open: true }, int), '13 − 8');
  assert.equal(words({ a: 5, sign: PLUS, b: 0 }, int), '5 + 0 = 5');
  assert.equal(MINUS, '−');
  assert.equal(answerOf({ a: 12, sign: MINUS, b: 12 }), 0);
});

test('written: the pieces carry the role of each number, and a line without its answer ends at the second number', () => {
  assert.deepEqual(parts({ a: 5, sign: PLUS, b: 3 }), [{ role: 'a', n: 5 }, { sign: '+' }, { role: 'b', n: 3 }, { sign: '=' }, { role: 'c', n: 8 }]);
  assert.deepEqual(parts({ a: 13, sign: MINUS, b: 8, open: true }), [{ role: 'a', n: 13 }, { sign: '−' }, { role: 'b', n: 8 }]);
});

test('written: each line reads aloud in English and Turkish', () => {
  assert.equal(readingKey({ a: 1, sign: PLUS, b: 1, open: true }), 'written-plus-open');
  assert.equal(say({ a: 5, sign: PLUS, b: 3 }, 'en'), '5 plus 3 is equal to 8');
  assert.equal(say({ a: 9, sign: MINUS, b: 4 }, 'en'), '9 minus 4 is equal to 5');
  assert.equal(say({ a: 13, sign: MINUS, b: 8, open: true }, 'en'), '13 minus 8');
  assert.equal(say({ a: 7, sign: PLUS, b: 4, open: true }, 'en'), '7 plus 4');
  assert.equal(say({ a: 5, sign: PLUS, b: 3 }, 'tr'), '5 artı 3 eşittir 8');
  assert.equal(say({ a: 9, sign: MINUS, b: 4 }, 'tr'), '9 eksi 4 eşittir 5');
  assert.equal(say({ a: 13, sign: MINUS, b: 8, open: true }, 'tr'), '13 eksi 8');
});
