// Checks the kit's written line: its words, its reading aloud in both languages and the pieces a figure draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUS, MINUS, answerOf, parts, words, reading, readingKey, FACTS, FACT_IDS, readingOf, factsOf, factLine, sameFact, shownFacts, takenBy, finding } from '../src/kit/written.js';
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

test('facts: a family writes its four facts in order, each number carrying the link id of what it counts', () => {
  const int = numbers('en').int, f = factsOf(9, 4);
  assert.deepEqual(FACTS.map(id => words(f[id], int)), ['9 + 4 = 13', '4 + 9 = 13', '13 − 4 = 9', '13 − 9 = 4']);
  assert.deepEqual(FACTS.map(id => parts(f[id]).filter(p => p.role).map(p => f[id].refs[p.role])),
    [['first', 'second', 'whole'], ['second', 'first', 'whole'], ['whole', 'second', 'first'], ['whole', 'first', 'second']]);
  assert.deepEqual(FACT_IDS.map(readingOf).slice(4), ['reading', 'reading-swap', 'reading-minus-second', 'reading-minus-first']);
  assert.deepEqual(FACT_IDS.map(id => say(factLine(id, 9, 4), 'en')).slice(4), ['9 plus 4 is equal to 13', '4 plus 9 is equal to 13', '13 minus 4 is equal to 9', '13 minus 9 is equal to 4']);
  assert.deepEqual([takenBy('written'), takenBy('reading-minus-second'), takenBy('written-minus-first')], [null, 'second', 'first']);
});

test('facts: two equal parts give two facts in the first column, and the links of the other two read and light them', () => {
  const int = numbers('en').int;
  assert.deepEqual(shownFacts(6, 6), ['written', 'written-minus-second']);
  assert.deepEqual(shownFacts(6, 5), FACTS);
  assert.deepEqual(shownFacts(6, 4, ['written', 'written-minus-second', 'written-minus-first']), ['written', 'written-minus-second', 'written-minus-first']);
  assert.deepEqual(FACTS.map(id => sameFact(id, 6, 6)), ['written', 'written', 'written-minus-second', 'written-minus-second']);
  assert.deepEqual(FACTS.map(id => words(factLine(id, 6, 6), int)), ['6 + 6 = 12', '6 + 6 = 12', '12 − 6 = 6', '12 − 6 = 6']);
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) assert.equal(shownFacts(a, b).length, a === b ? 2 : 4);
});

test('facts: the calculation that finds a covered number, open while it is covered', () => {
  const int = numbers('en').int;
  assert.deepEqual([words(finding(4, 3, 'second', true), int), words(finding(4, 3, 'second', false), int)], ['7 − 4', '7 − 4 = 3']);
  assert.deepEqual([words(finding(4, 3, 'first', true), int), words(finding(4, 3, 'first', false), int)], ['7 − 3', '7 − 3 = 4']);
  assert.equal(words(finding(4, 3, 'whole', false), int), '4 + 3 = 7');
  assert.equal(say(finding(4, 3, 'second', true), 'tr'), '7 eksi 4');
});
