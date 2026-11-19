// Checks a whole with its missing part, the squad, the goal missing-part and a join undone on counters/add: what the
// Node half accepts, what each link shows as a page opens, at every step of each control and every tap, and the goal
// over many draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts, LINES, labelKeys, checked } from '../src/families/counters/add-model.js';
import { ADD_GOALS, addStart } from '../src/families/counters/add-goals.js';
import { words, reading, DASH, FACT_IDS } from '../src/kit/written.js';
import { numbers } from '../src/kit/format.js';
import { string } from '../src/node.mjs';
import { dice } from '../src/kit/random.js';

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
// family gives what the eight facts read for a first and a second part.
const family = (a, b) => {
  const c = a + b;
  return [`${a} + ${b} = ${c}`, `${b} + ${a} = ${c}`, `${c} − ${b} = ${a}`, `${c} − ${a} = ${b}`,
    `${a} plus ${b} is equal to ${c}`, `${b} plus ${a} is equal to ${c}`, `${c} minus ${b} is equal to ${a}`, `${c} minus ${a} is equal to ${b}`];
};
// put gives the counts of a page with a whole once n counters are put in.
const put = (page, n, whole = page.whole) => ({ ...opening(page), whole, second: n });

const PAGES = {
  210: { whole: 9, first: 4, written: true, readout: ['second'] },
  220: { whole: stepper(9, 18, 13), first: 8, written: 'family', readout: ['second'] },
  610: { look: 'squad', whole: 16, first: 11, written: true, readout: ['whole', 'first', 'second'] },
  710: { challenge: { goal: 'missing-part', whole: [11, 18], part: [3, 9] }, written: 'family' },
  310: { first: 6, waiting: 3, undo: true, written: true, readout: ['back', 'left'] },
  340: { first: stepper(1, 12, 12), second: stepper(1, 8, 6), written: 'family', readout: ['whole'] },
};

test('whole: the pages of sections missing-part and undoing read without a problem', () => {
  for (const fields of Object.values(PAGES)) spec(fields);
});

test('whole: the links of each page as it opens', () => {
  assert.deepEqual(['whole', 'first', 'missing', 'second', 'written', 'reading'].map(id => start(PAGES[210], id)), ['9', '4', '5', '0', '9 − 4', '9 minus 4']);
  assert.deepEqual(['whole', 'first', 'missing', 'second', ...FACT_IDS].map(id => start(PAGES[220], id)), ['13', '8', '5', '0', ...family(8, 5)]);
  assert.deepEqual(['whole', 'first', 'missing', 'second', 'written', 'reading'].map(id => start(PAGES[610], id)), ['16', '11', '5', '0', '16 − 11', '16 minus 11']);
  assert.deepEqual(['first', 'second', 'waiting', 'sum', 'written', 'reading', 'back', 'left', 'written-back', 'reading-back'].map(id => start(PAGES[310], id)),
    ['6', '0', '3', '6', '6 + 0 = 6', '6 plus 0 is equal to 6', DASH, DASH, DASH, DASH]);
  assert.deepEqual(['first', 'second', 'whole', ...FACT_IDS].map(id => start(PAGES[340], id)), ['12', '6', '18', ...family(12, 6)]);
  assert.equal(start(PAGES[210], 'reading', 'tr'), '9 eksi 4');
  assert.equal(start(PAGES[220], 'sum'), null, 'whole takes the place of sum');
  assert.equal(start(PAGES[220], 'written-left'), null);
  assert.equal(counters.start(spec(PAGES[710]), 'en', 'whole'), null, 'a challenge offers no link');
});

test('whole: the subtraction takes its answer once every place is filled, at every tap', () => {
  const p210 = spec(PAGES[210]), p610 = spec(PAGES[610]);
  for (let n = 0; n <= 5; n++) {
    const done = n === 5;
    assert.deepEqual(['second', 'missing', 'written', 'reading'].map(id => value(p210, put(p210, n), id)),
      [String(n), '5', done ? '9 − 4 = 5' : '9 − 4', done ? '9 minus 4 is equal to 5' : '9 minus 4']);
    assert.deepEqual(['whole', 'first', 'second', 'written'].map(id => value(p610, put(p610, n), id)), ['16', '11', String(n), done ? '16 − 11 = 5' : '16 − 11']);
  }
  assert.equal(value(p210, put(p210, 5), 'reading', 'tr'), '9 eksi 4 eşittir 5');
});

test('whole: the stepper on the whole at its lowest and highest, and every link at every step and every tap', () => {
  for (const [w, line] of [[9, '8 + 1 = 9'], [18, '8 + 10 = 18']]) {
    assert.equal(start({ ...PAGES[220], whole: stepper(9, 18, w) }, 'written'), line);
    assert.equal(start({ ...PAGES[220], whole: stepper(9, 18, w) }, 'missing'), String(w - 8));
  }
  const page = spec(PAGES[220]);
  for (let w = 9; w <= 18; w++) for (let n = 0; n <= w - 8; n++) {
    const s = put(page, n, w);
    assert.deepEqual(['whole', 'first', 'missing', 'second', ...FACT_IDS].map(id => value(page, s, id)), [String(w), '8', String(w - 8), String(n), ...family(8, w - 8)]);
  }
  // A stepper on the known part instead of the whole.
  const known = spec({ whole: 12, first: stepper(1, 11, 5), written: true });
  for (let f = 1; f <= 11; f++) assert.deepEqual(['missing', 'written'].map(id => value(known, { ...put(known, 0), first: f }, id)), [String(12 - f), `12 − ${f}`]);
  for (const f of [1, 11]) assert.equal(start({ whole: 12, first: stepper(1, 11, f), written: true }, 'written'), `12 − ${f}`);
});

test('whole: the readouts and the stepper name the whole and its parts, and the squad its players', () => {
  const T = k => string('en', `counters_${k}`), name = (page, id) => labelKeys(page, id).map(T).find(Boolean);
  assert.deepEqual(['whole', 'first', 'missing', 'second'].map(id => name(spec(PAGES[220]), id)), ['Whole', 'Known part', 'Missing part', 'Counters put in']);
  assert.deepEqual(['whole', 'first', 'missing', 'second'].map(id => name(spec(PAGES[610]), id)), ['Squad', 'On the pitch', 'Bench seats', 'On the bench']);
  assert.deepEqual(['back', 'left', 'first', 'waiting'].map(id => name(spec(PAGES[310]), id)), ['Taken back', 'Left', 'First number', 'Still to join']);
  const tr = k => string('tr', `counters_${k}`);
  assert.deepEqual(['add-whole-first', 'add-whole-missing', 'add-undo-left'].map(tr), ['Bilinen parça', 'Bilinmeyen parça', 'Kalan']);
});

test('undo: the join writes its line, and each counter taken back writes the line that undoes it', () => {
  const page = spec(PAGES[310]), ids = ['second', 'waiting', 'sum', 'written', 'back', 'left', 'written-back', 'reading-back'];
  // Before the join is done the line follows the joins.
  for (let j = 0; j < 3; j++) assert.deepEqual(ids.map(id => value(page, { ...opening(page), second: j, waiting: 3 - j }, id)),
    [String(j), String(3 - j), String(6 + j), `6 + ${j} = ${6 + j}`, DASH, DASH, DASH, DASH]);
  // Once the tray is empty the join is done, and each counter back in the tray takes one more away.
  for (let b = 0; b <= 3; b++) {
    const s = { ...opening(page), second: 3 - b, waiting: b, done: true };
    assert.deepEqual(ids.map(id => value(page, s, id)), [String(3 - b), String(b), String(9 - b), '6 + 3 = 9', String(b), String(9 - b),
      b ? `9 − ${b} = ${9 - b}` : DASH, b ? `9 minus ${b} is equal to ${9 - b}` : DASH]);
  }
  assert.equal(value(page, { ...opening(page), second: 0, waiting: 3, done: true }, 'reading-back', 'tr'), '9 eksi 3 eşittir 6');
});

test('missing-part: it draws every whole and known part of 710 evenly, opens unsolved, and the taps reach each', () => {
  const page = spec(PAGES[710]), c = PAGES[710].challenge, g = ADD_GOALS['missing-part'], seen = new Map();
  for (let seed = 1; seed <= 4000; seed++) {
    const t = g.draw(c, page, dice(seed)), key = `${t.whole}-${t.part}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    assert.ok(t.whole >= 11 && t.whole <= 18 && t.part >= 3 && t.part <= 9 && t.whole - t.part >= 2);
    assert.deepEqual(g.holds(addStart(), page, c, t), { done: false });
    assert.equal(g.reach(page, c, t), null);
    // The taps put in from 0 counters up to the cells left, and only the missing part holds.
    const ways = [];
    for (let n = 0; n <= 20 - t.part; n++) if (g.holds({ ...addStart(), put: n, checked: true }, page, c, t).done) ways.push(n);
    assert.deepEqual(ways, [t.whole - t.part]);
  }
  assert.equal(seen.size, 8 * 7);
  for (const n of seen.values()) assert.ok(n > 4000 / 56 / 2, 'each pair is drawn about as often as the others');
  const t = { whole: 13, part: 8 }, at = n => g.holds({ ...addStart(), put: n, checked: true }, page, c, t);
  assert.deepEqual([at(6), at(4), at(5)], [{ done: false, note: 'more' }, { done: false, note: 'less' }, { done: true }]);
  assert.deepEqual(g.holds({ ...addStart(), put: 5 }, page, c, t), { done: false }, 'the goal waits for Check');
  assert.deepEqual(g.page(t), { first: 8, second: 0, put: true });
});

test('missing-part: the goal line, the notes and the hint read with the numbers of the case', () => {
  const f = { int: String }, t = { whole: 13, part: 8 }, g = ADD_GOALS['missing-part'];
  const v = { ...g.words({}, t, f), calc: words(g.line(t, false), String), line: words(g.line(t, true), String) };
  const T = (k, more = {}, lang = 'en') => string(lang, `counters_${k}`, { ...v, ...more });
  assert.equal(T('goal-missing-part'), 'Put in the part that 13 − 8 asks for, then press Check.');
  assert.equal(T('goal-missing-part-done'), '13 − 8 = 5, since 8 and 5 make 13.');
  assert.equal(T('note-missing-part-more', { put: '6', made: '14' }), '8 and 6 make 14, more than 13.');
  assert.equal(T('note-missing-part-less', { put: '4', made: '12' }), '8 and 4 make 12, less than 13.');
  assert.equal(T('hint-missing-part'), '13 − 8 asks: 8 and what make 13? Count on from 8 to 13 and put in a counter for each number you say.');
  assert.equal(T('goal-missing-part', {}, 'tr'), '13 − 8 işleminin sorduğu parçayı koyun, sonra Kontrol et düğmesine basın.');
});

test('whole, squad, undo and missing-part: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ whole: 9, first: 4, second: 2 }, /second belongs to other pages, a page with a whole takes/);
  fails({ whole: 9, first: 4, waiting: 2 }, /waiting belongs to other pages/);
  fails({ whole: 9, first: 4, undo: true }, /undo belongs to other pages/);
  fails({ whole: 9 }, /first is missing/);
  fails({ whole: 9, first: 9 }, /write a known part from 1 to one less than the whole/);
  fails({ whole: 9, first: 0 }, /write a known part from 1/);
  fails({ whole: 21, first: 4 }, /write a whole from 2 to 20/);
  fails({ whole: stepper(9, 18, 13), first: stepper(1, 8, 4) }, /both have a stepper/);
  fails({ whole: stepper(8, 18, 13), first: 8 }, /first reaches 8 with a whole of \[8, 18\]/);
  fails({ whole: stepper(9, 18, 19), first: 8 }, /starts at 19/);
  fails({ whole: 9, first: 4, written: 'ten' }, /written: ten belongs to pages without a whole/);
  fails({ look: 'eggs', whole: 9, first: 4 }, /whole belongs to the frames and the squad/);
  fails({ whole: 9, first: 4, written: true, readout: ['sum'] }, /reads out first, second, whole, missing, written, reading$/m);
  fails({ whole: 13, first: 8, written: 'family', readout: ['written'] }, /reads out first, second, whole, missing$/m);
  fails({ look: 'squad', first: 11 }, /the squad needs the whole/);
  fails({ look: 'squad', whole: 16, first: 12 }, /11 players are on the pitch at most/);
  fails({ look: 'squad', whole: 21, first: 11 }, /write a whole from 2 to 20/);
  fails({ look: 'squad', whole: 20, first: 10 }, /the bench needs 10 seats, and it has 9/);
  fails({ look: 'squad', whole: stepper(12, 16, 16), first: 11 }, /the squad takes whole and first as numbers/);
  fails({ look: 'squad', whole: 16, first: 11, written: 'family' }, /write written: true on the squad/);
  fails({ first: 6, waiting: 3, undo: true }, /write written: true/);
  fails({ first: 6, second: 1, waiting: 3, undo: true, written: true }, /second belongs to other pages, undo takes/);
  fails({ first: stepper(1, 9, 6), waiting: 3, undo: true, written: true }, /write first and waiting as numbers/);
  fails({ first: 6, undo: true, written: true }, /write first and waiting as numbers/);
  fails({ look: 'tray', first: 6, waiting: 3, undo: true, written: true }, /undo belongs to the frames/);
  const c = PAGES[710].challenge;
  fails({ challenge: { ...c, whole: [11, 21] } }, /whole is \[11,21\].*from 2 to 20/);
  fails({ challenge: { ...c, part: [0, 9] } }, /part is \[0,9\].*from 1 to 19/);
  fails({ challenge: { ...c, part: [12, 15], whole: [5, 10] } }, /leave no subtraction to draw/);
  fails({ challenge: { ...c, first: [1, 2] } }, /first belongs to another goal, this one draws from whole and part/);
  fails({ challenge: c, whole: 13 }, /whole is set by challenge.goal missing-part/);
  assert.deepEqual(read({ challenge: { ...c, part: [3, 12], whole: [11, 13] } }).problems, [], 'a known part may reach past the lowest whole');
});

// A claim page: 12 + 6 with a sum the reader sets, right or wrong, and its check.
const CLAIM = { first: 12, second: 6, claim: stepper(6, 24, 17), written: true, readout: ['claim'] };

test('claim: the links as the page opens, at a wrong sum', () => {
  assert.deepEqual(['first', 'second', 'claim', 'written', 'reading', 'written-back', 'reading-back'].map(id => start(CLAIM, id)),
    ['12', '6', '17', '12 + 6 = 17', '12 plus 6 is equal to 17', '17 − 6 = 11', '17 minus 6 is equal to 11']);
  assert.equal(start(CLAIM, 'sum'), null, 'the true sum would give the check away');
  assert.equal(start(CLAIM, 'reading-back', 'tr'), '17 eksi 6 eşittir 11');
});

test('claim: the stepper Sum at its lowest and highest, and every link and the check at every step', () => {
  for (const c of [6, 24]) assert.equal(start({ ...CLAIM, claim: stepper(6, 24, c) }, 'written-back'), `${c} − 6 = ${c - 6}`);
  const page = spec(CLAIM), T = (k, v) => string('en', `counters_${k}`, v);
  for (let c = 6; c <= 24; c++) {
    const s = { ...opening(page), claim: c };
    assert.deepEqual(['claim', 'written', 'written-back'].map(id => value(page, s, id)), [String(c), `12 + 6 = ${c}`, `${c} − 6 = ${c - 6}`]);
    assert.equal(checked(s), c === 18);
  }
  assert.equal(T('add-claim-wrong', { back: '11', first: '12' }), '11 is not 12, so the sum is wrong.');
  assert.equal(T('add-claim-right', { back: '12', first: '12' }), 'The check gives back 12, so the sum is right.');
  assert.equal(labelKeys(page, 'claim').map(k => T(k)).find(Boolean), 'Sum');
});

test('claim: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...CLAIM, written: 'family' }, /write written: true/);
  fails({ ...CLAIM, first: stepper(1, 12, 12) }, /write first and second as numbers/);
  fails({ ...CLAIM, second: undefined }, /write first and second as numbers/);
  fails({ ...CLAIM, claim: stepper(4, 24, 17) }, /write sums from 6, the second part/);
  fails({ ...CLAIM, claim: stepper(6, 24, 30) }, /starts at 30/);
  fails({ ...CLAIM, waiting: 2 }, /waiting belongs to other pages, a claim page takes/);
  fails({ ...CLAIM, look: 'eggs' }, /claim belongs to the frames/);
  fails({ whole: 9, first: 4, claim: 13 }, /claim belongs to other pages, a page with a whole/);
  fails({ ...CLAIM, readout: ['sum'] }, /reads out first, second, claim, written, reading, written-back, reading-back$/m);
});
