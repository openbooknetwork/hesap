// Checks the facts of a family on counters/add, the egg box and the domino with its cover: what the Node half
// accepts, what each link shows as a page opens, and at every step of each control and every cover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts, LINES, measuresOf, labelKeys } from '../src/families/counters/add-model.js';
import { words, reading, DASH, FACT_IDS } from '../src/kit/written.js';
import { numbers } from '../src/kit/format.js';
import { string } from '../src/node.mjs';

function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null;
  try { data = counters.read({ scene: 'add', ...fields }, { at: 'page.yaml' }, ctx).data; } catch (err) { problems.push(err.message); }
  return { data, problems };
}
const spec = fields => { const r = read(fields); assert.deepEqual(r.problems, []); return r.data; };
const start = (fields, id, lang = 'en') => counters.start(spec(fields), lang, id);
const stepper = (lo, hi, start) => ({ stepper: [lo, hi], start });
// value gives what a link reads for the counts s, as the browser writes it.
const value = (page, s, id, lang = 'en') => {
  const int = numbers(lang).int, line = LINES[id]?.(page, s), n = counts(page, s)[id];
  if (id in LINES) return !line ? DASH : id.startsWith('written') ? words(line, int) : reading(line, int, (k, v) => string(lang, `hesap_${k}`, v));
  return n == null ? DASH : int(n);
};
// family gives what the eight facts and the three numbers read for a first and a second part.
const family = (a, b) => {
  const c = a + b;
  return [String(a), String(b), String(c), `${a} + ${b} = ${c}`, `${b} + ${a} = ${c}`, `${c} − ${b} = ${a}`, `${c} − ${a} = ${b}`,
    `${a} plus ${b} is equal to ${c}`, `${b} plus ${a} is equal to ${c}`, `${c} minus ${b} is equal to ${a}`, `${c} minus ${a} is equal to ${b}`];
};
const IDS = ['first', 'second', 'whole', ...FACT_IDS];

const PAGES = {
  110: { look: 'eggs', first: 6, second: 4, written: 'family', facts: ['written', 'written-minus-second', 'written-minus-first'] },
  120: { look: 'domino', first: 4, second: 3, cover: true, written: true },
  130: { first: stepper(1, 10, 9), second: stepper(1, 10, 4), written: 'family', readout: ['whole'] },
  140: { first: 6, second: stepper(1, 10, 5), written: 'family', readout: ['whole'] },
};

test('facts: the pages of the section read without a problem', () => {
  for (const fields of Object.values(PAGES)) spec(fields);
});

test('facts: the links of each page as it opens', () => {
  assert.deepEqual(IDS.map(id => start(PAGES[110], id)), family(6, 4));
  assert.deepEqual(IDS.map(id => start(PAGES[130], id)), family(9, 4));
  assert.deepEqual(IDS.map(id => start(PAGES[140], id)), family(6, 5));
  assert.deepEqual(['first', 'second', 'whole', 'written', 'reading', 'sum', 'written-swap'].map(id => start(PAGES[120], id)), ['4', '3', '7', '4 + 3 = 7', '4 plus 3 is equal to 7', null, null]);
  assert.equal(start(PAGES[110], 'sum'), null, 'whole takes the place of sum');
  assert.equal(start(PAGES[130], 'reading-minus-first', 'tr'), '13 eksi 9 eşittir 4');
});

test('facts: each stepper at its lowest and highest value, and every link at every step of both', () => {
  for (const [a, b] of [[1, 1], [10, 10], [1, 10], [10, 1]]) assert.deepEqual(IDS.map(id => start({ ...PAGES[130], first: stepper(1, 10, a), second: stepper(1, 10, b) }, id)), family(a, b));
  for (const b of [1, 10]) assert.deepEqual(IDS.map(id => start({ ...PAGES[140], second: stepper(1, 10, b) }, id)), family(6, b));
  const p130 = spec(PAGES[130]), p140 = spec(PAGES[140]);
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) assert.deepEqual(IDS.map(id => value(p130, { first: a, second: b, waiting: 0 }, id)), family(a, b));
  for (let b = 1; b <= 10; b++) assert.deepEqual(IDS.map(id => value(p140, { first: 6, second: b, waiting: 0 }, id)), family(6, b));
  // Two equal parts: the swap reads the first addition, and the whole minus the first part the whole minus the second.
  const equal = IDS.map(id => value(p140, { first: 6, second: 6, waiting: 0 }, id));
  assert.deepEqual([equal[2], equal[3], equal[4], equal[5], equal[6]], ['12', '6 + 6 = 12', '6 + 6 = 12', '12 − 6 = 6', '12 − 6 = 6']);
});

test('facts: the readouts and steppers name the parts and the whole, and the domino its halves', () => {
  const T = k => string('en', `counters_${k}`), name = (page, id) => labelKeys(page, id).map(T).find(Boolean);
  assert.deepEqual(['first', 'second', 'whole'].map(id => name(spec(PAGES[130]), id)), ['First part', 'Second part', 'Whole']);
  assert.deepEqual(['first', 'second'].map(id => name(spec({ look: 'eggs', first: 6, second: 4 }), id)), ['First part', 'Second part']);
  assert.deepEqual(['first', 'second', 'whole'].map(id => name(spec(PAGES[120]), id)), ['First half', 'Second half', 'Whole']);
  assert.deepEqual(['1', '3'].map(x => string('en', 'counters_add-domino-cover', x)), ['Cover the half that shows 1', 'Cover the half that shows 3']);
  assert.equal(string('en', 'hesap_facts'), 'Facts of the family');
});

test('domino: the line turns into the calculation that finds the covered half, and takes its answer once the card lifts', () => {
  const page = spec(PAGES[120]), at = (cover, found, p = page) => ({ ...opening(p), cover, found });
  const read = s => ['written', 'reading', 'first', 'second', 'whole'].map(id => value(page, s, id));
  assert.deepEqual(read(at(null, null)), ['4 + 3 = 7', '4 plus 3 is equal to 7', '4', '3', '7']);
  assert.deepEqual(read(at('second', 'second')), ['7 − 4', '7 minus 4', '4', '3', '7']);
  assert.deepEqual(read(at(null, 'second')), ['7 − 4 = 3', '7 minus 4 is equal to 3', '4', '3', '7']);
  assert.deepEqual(read(at('first', 'first')), ['7 − 3', '7 minus 3', '4', '3', '7']);
  assert.deepEqual(read(at(null, 'first')), ['7 − 3 = 4', '7 minus 3 is equal to 4', '4', '3', '7']);
  assert.equal(value(page, at('second', 'second'), 'reading', 'tr'), '7 eksi 4');
  // Every domino of 1 to 6 pips on each half, each half covered and lifted.
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    const p = spec({ ...PAGES[120], first: a, second: b }), w = a + b;
    assert.deepEqual([at(null, null, p), at('second', 'second', p), at(null, 'second', p), at('first', 'first', p), at(null, 'first', p)].map(s => value(p, s, 'written')),
      [`${a} + ${b} = ${w}`, `${w} − ${a}`, `${w} − ${a} = ${b}`, `${w} − ${b}`, `${w} − ${b} = ${a}`]);
  }
});

test('facts: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ first: 6, second: 4, facts: ['written'] }, /facts goes with written: family/);
  fails({ first: 6, second: 4, written: 'family', facts: ['written', 'written'] }, /write each fact once/);
  fails({ first: 6, second: 4, written: 'family', facts: [] }, /write each fact once/);
  fails({ first: 6, second: 4, written: 'family', facts: ['written-plus'] }, /Invalid|written-plus/);
  fails({ first: 9, second: 4, take: true, written: 'family' }, /take belongs to other pages/);
  fails({ first: 9, waiting: 4, written: 'family' }, /waiting belongs to other pages/);
  fails({ look: 'tray', first: 9, second: 4, written: 'family' }, /written: family belongs to the frames and the eggs/);
  fails({ look: 'shelf', first: 3, second: 4, written: 'family' }, /write written: true on the shelf/);
  fails({ first: 9, second: 4, written: 'family', readout: ['written-swap'] }, /reads out first, second, whole$/m);
  fails({ first: 9, second: 4, written: 'family', readout: ['sum'] }, /reads out first, second, whole$/m);
  fails({ look: 'eggs', first: 6, second: 5 }, /the eggs reach 11, and the box holds 10/);
  fails({ look: 'eggs', first: stepper(1, 8, 6), second: 4 }, /the eggs reach 12/);
  fails({ look: 'eggs', first: 6, second: 4, take: true }, /take belongs to other pages/);
  fails({ look: 'eggs', first: 6, second: 4, written: 'ten' }, /written: ten belongs to the frames/);
  fails({ look: 'domino', first: 7, second: 3 }, /first is the pips of a half, write it as a number from 1 to 6/);
  fails({ look: 'domino', first: 4, second: 0 }, /second is the pips of a half/);
  fails({ look: 'domino', first: stepper(1, 6, 4), second: 3 }, /first is the pips of a half/);
  fails({ look: 'domino', first: 4, second: 3, written: 'family' }, /write written: true on the domino/);
  fails({ look: 'domino', first: 4, second: 3, waiting: 2 }, /waiting belongs to other pages, the domino takes/);
  fails({ look: 'domino', first: 4, second: 3, readout: ['sum'] }, /reads out first, second, whole$/m);
  fails({ first: 4, second: 3, cover: true }, /cover belongs to the domino/);
  assert.deepEqual(measuresOf(spec({ look: 'domino', first: 4, second: 3 })), ['first', 'second', 'whole']);
});
