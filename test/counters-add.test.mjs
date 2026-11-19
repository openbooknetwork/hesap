// Checks the add scene of the counters family: what its Node half accepts, what each link shows as a page opens and
// at every step of its controls, and its goals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts, lineOf, LINES, measuresOf } from '../src/families/counters/add-model.js';
import { ADD_GOALS, addStart, SUM_STEP, PART_STEP, toTenOf } from '../src/families/counters/add-goals.js';
import { words, reading, DASH } from '../src/kit/written.js';
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
  const int = numbers(lang).int;
  const line = LINES[id]?.(page, s), n = counts(page, s)[id];
  if (id in LINES) return !line ? DASH : id.startsWith('written') ? words(line, int) : reading(line, int, (k, v) => string(lang, `hesap_${k}`, v));
  return n == null ? DASH : int(n);
};

const PAGES = {
  110: { dice: true, first: 5, waiting: 3 },
  120: { first: 5, second: 3, waiting: 2, written: true, readout: ['reading'] },
  130: { first: stepper(0, 10, 4), second: stepper(0, 10, 3), written: true, readout: ['first', 'second', 'sum'] },
  210: { first: 9, second: 0, take: true, readout: ['second', 'left'] },
  220: { first: 9, second: stepper(1, 8, 4), take: true, written: true, readout: ['written', 'reading'] },
  230: { first: stepper(1, 20, 7), second: 0, take: true, written: true, readout: ['written', 'reading'] },
  610: { look: 'shelf', first: 3, second: 0, written: true, readout: ['written', 'written-left'] },
  510: { first: 12, second: stepper(0, 8, 5), written: true, readout: ['second', 'sum'] },
  520: { first: 8, second: 0, waiting: 5, split: true, written: 'ten', readout: ['second', 'to-ten', 'rest'] },
  530: { take: true, first: stepper(11, 19, 13), second: 0, written: 'ten', readout: ['second', 'left', 'to-ten', 'rest'] },
  620: { look: 'tray', first: 7, second: 0, waiting: 5, split: true, written: 'ten', readout: ['to-ten', 'rest'] },
  730: { written: 'ten', challenge: { goal: 'steps-to-ten', second: [3, 9] } },
  810: { first: stepper(0, 10, 8), second: stepper(0, 10, 5), written: 'ten', readout: ['reading'] },
  710: { challenge: { goal: 'find-sum', first: [9, 15], second: [2, 4], sum: [11, 19] }, written: true },
};

test('add: the family lists the scene, and the pages of the section read without a problem', () => {
  assert.ok(counters.scenes.includes('add'));
  for (const fields of Object.values(PAGES)) spec(fields);
});

test('add: the links show the counts, the written line and its words as the page opens', () => {
  assert.deepEqual(['first', 'waiting', 'sum', 'second', 'written'].map(id => start(PAGES[110], id)), ['5', '3', '5', '0', null]);
  assert.deepEqual(['written', 'reading', 'first', 'second', 'waiting', 'sum'].map(id => start(PAGES[120], id)), ['5 + 3 = 8', '5 plus 3 is equal to 8', '5', '3', '2', '8']);
  assert.deepEqual(['first', 'second', 'sum', 'written', 'reading', 'waiting'].map(id => start(PAGES[130], id)), ['4', '3', '7', '4 + 3 = 7', '4 plus 3 is equal to 7', null]);
  assert.equal(start(PAGES[120], 'reading', 'tr'), '5 artı 3 eşittir 8');
  assert.deepEqual(measuresOf(spec(PAGES[710])), []);
});

test('add: each stepper at its lowest and its highest value, and every link at every step of both', () => {
  const page = spec(PAGES[130]);
  for (const [a, b, line, sum] of [[0, 0, '0 + 0 = 0', '0'], [10, 10, '10 + 10 = 20', '20'], [0, 10, '0 + 10 = 10', '10'], [10, 0, '10 + 0 = 10', '10']]) {
    const s = { first: a, second: b, waiting: 0 };
    assert.deepEqual([value(page, s, 'written'), value(page, s, 'sum')], [line, sum]);
  }
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const s = { first: a, second: b, waiting: 0 };
    assert.deepEqual(['first', 'second', 'sum', 'written', 'reading'].map(id => value(page, s, id)), [String(a), String(b), String(a + b), `${a} + ${b} = ${a + b}`, `${a} plus ${b} is equal to ${a + b}`]);
  }
  for (const [first, second] of [[0, 0], [10, 10]]) assert.equal(start({ ...PAGES[130], first: stepper(0, 10, first), second: stepper(0, 10, second) }, 'written'), `${first} + ${second} = ${first + second}`);
});

test('add: the links follow every counter joined and sent back, and every throw of the dice', () => {
  const page = spec(PAGES[120]), pool = page.second + page.waiting;
  for (let joined = 0; joined <= pool; joined++) {
    const s = { first: 5, second: joined, waiting: pool - joined };
    assert.deepEqual(['second', 'waiting', 'sum', 'written'].map(id => value(page, s, id)), [String(joined), String(pool - joined), String(5 + joined), `5 + ${joined} = ${5 + joined}`]);
  }
  const dicePage = spec(PAGES[110]);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let joined = 0; joined <= b; joined++) {
    const s = { first: a, second: joined, waiting: b - joined };
    assert.deepEqual(['first', 'waiting', 'sum'].map(id => value(dicePage, s, id)), [String(a), String(b - joined), String(a + joined)]);
  }
  assert.deepEqual(opening(dicePage), { first: 5, second: 0, waiting: 3, ten: true, cover: null, found: null, whole: null, done: false, claim: null });
});

test('add: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ second: 3 }, /first is missing/);
  fails({ first: 21 }, /a group holds from 0 to 20/);
  fails({ first: stepper(0, 10, 11) }, /starts at 11/);
  fails({ first: 12, second: 6, waiting: 3 }, /the counters reach 21/);
  fails({ first: stepper(0, 10, 4), waiting: 3 }, /write first and second as numbers/);
  fails({ first: 5, dice: true }, /write waiting as well/);
  fails({ first: 5, second: 1, waiting: 3, dice: true }, /leave second out/);
  fails({ first: 7, waiting: 3, dice: true }, /first is 7, a die shows 1 to 6/);
  fails({ first: 5, waiting: 0 }, /waiting is 0/);
  fails({ first: 5, second: 3, readout: ['waiting'] }, /reads out first, second, sum/);
  fails({ first: 5, readout: ['written'] }, /reads out first, second, sum$/m);
  const c710 = PAGES[710].challenge;
  fails({ challenge: c710, first: 3 }, /first is set by challenge.goal find-sum/);
  fails({ challenge: c710, readout: ['sum'] }, /readout is set by challenge.goal/);
  fails({ challenge: { ...c710, sum: [0, 10] } }, /sum is \[0,10\].*from 1 to 20.*opens at 0/);
  fails({ challenge: { ...c710, first: [0, 8] } }, /first is \[0,8\].*from 1 to 19/);
  fails({ challenge: { ...c710, first: [9, 20] } }, /first is \[9,20\].*from 1 to 19/);
  fails({ challenge: { ...c710, second: [2, 11] } }, /second is \[2,11\].*from 1 to 10/);
  fails({ challenge: { ...c710, sum: [11, 21] } }, /sum is \[11,21\].*from 1 to 20/);
  fails({ challenge: { goal: 'find-sum', first: [9, 15], second: [2, 4] } }, /sum is null/);
  fails({ challenge: { ...c710, sum: [1, 10] } }, /leave no addition to draw/);
  fails({ challenge: { ...c710, top: [1, 2] } }, /Unrecognized key|top/);
  fails({ challenge: { goal: 'same-rows', sum: [11, 19] } }, /the goals are find-sum, steps-to-ten/);
});

test('take: the links show the counters, the number taken away and what is left as the page opens', () => {
  assert.deepEqual(['first', 'second', 'left', 'sum', 'written'].map(id => start(PAGES[210], id)), ['9', '0', '9', null, null]);
  assert.deepEqual(['first', 'second', 'left', 'written', 'reading'].map(id => start(PAGES[220], id)), ['9', '4', '5', '9 − 4 = 5', '9 minus 4 is equal to 5']);
  assert.deepEqual(['first', 'second', 'left', 'written', 'reading'].map(id => start(PAGES[230], id)), ['7', '0', '7', '7 − 0 = 7', '7 minus 0 is equal to 7']);
  assert.equal(start(PAGES[220], 'reading', 'tr'), '9 eksi 4 eşittir 5');
});

test('take: each stepper at its lowest and its highest value, and every link at every step and every take away', () => {
  const p220 = spec(PAGES[220]), p230 = spec(PAGES[230]);
  for (const [t, line] of [[1, '9 − 1 = 8'], [8, '9 − 8 = 1']]) {
    assert.equal(value(p220, { first: 9, second: t, waiting: 0 }, 'written'), line);
    assert.equal(start({ ...PAGES[220], second: stepper(1, 8, t) }, 'written'), line);
  }
  for (const [f, line] of [[1, '1 − 0 = 1'], [20, '20 − 0 = 20']]) assert.equal(start({ ...PAGES[230], first: stepper(1, 20, f) }, 'written'), line);
  for (let t = 1; t <= 8; t++) assert.deepEqual(['second', 'left', 'reading'].map(id => value(p220, { first: 9, second: t, waiting: 0 }, id)), [String(t), String(9 - t), `9 minus ${t} is equal to ${9 - t}`]);
  for (let f = 1; f <= 20; f++) for (let t = 0; t <= f; t++) {
    const s = { first: f, second: t, waiting: 0 };
    assert.deepEqual(['first', 'second', 'left', 'written', 'reading'].map(id => value(p230, s, id)), [String(f), String(t), String(f - t), `${f} − ${t} = ${f - t}`, `${f} minus ${t} is equal to ${f - t}`]);
  }
});

test('shelf: the links show the jars sold and left, and both lines, at every sale', () => {
  assert.deepEqual(['first', 'second', 'sum', 'left', 'written', 'reading', 'written-left', 'reading-left'].map(id => start(PAGES[610], id)),
    ['3', '0', '3', '7', '3 + 0 = 3', '3 plus 0 is equal to 3', '10 − 3 = 7', '10 minus 3 is equal to 7']);
  const page = spec(PAGES[610]);
  for (let a = 0; a <= 10; a++) for (let b = 0; a + b <= 10; b++) {
    const s = { first: a, second: b, waiting: 0 };
    assert.deepEqual(['sum', 'left', 'written', 'written-left', 'reading-left'].map(id => value(page, s, id)), [String(a + b), String(10 - a - b), `${a} + ${b} = ${a + b}`, `10 − ${a + b} = ${10 - a - b}`, `10 minus ${a + b} is equal to ${10 - a - b}`]);
  }
});

test('take and shelf: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ first: 5, second: 6, take: true }, /second reaches 6, more than the 5 counters/);
  fails({ first: 9, second: stepper(1, 10, 4), take: true }, /second reaches 10/);
  fails({ first: stepper(1, 20, 7), second: stepper(0, 3, 0), take: true }, /give one of them a number/);
  fails({ first: 5, waiting: 2, take: true }, /leave waiting out/);
  fails({ first: 5, take: true, readout: ['sum'] }, /reads out first, second, left/);
  fails({ first: 21, take: true }, /a group holds from 0 to 20/);
  fails({ look: 'shelf', first: 6, second: 5 }, /come to 10 at most/);
  fails({ look: 'shelf', first: stepper(0, 5, 3), second: 0 }, /as numbers/);
  fails({ look: 'shelf', first: 3, take: true }, /take belongs to the frames/);
  fails({ look: 'shelf', first: 3, readout: ['written-left'] }, /reads out first, second, sum, left$/m);
});

const TEN = ['to-ten', 'rest', 'written-to-ten', 'reading-to-ten', 'written-rest', 'reading-rest'];
test('ten: the links of the steps as each page of making ten opens', () => {
  assert.deepEqual(['first', 'second', 'sum', 'written', 'reading', 'to-ten'].map(id => start(PAGES[510], id)), ['12', '5', '17', '12 + 5 = 17', '12 plus 5 is equal to 17', null]);
  assert.deepEqual(['first', 'second', 'waiting', 'sum', 'written', ...TEN].map(id => start(PAGES[520], id)), ['8', '0', '5', '8', '8 + 0 = 8', DASH, DASH, DASH, DASH, DASH, DASH]);
  assert.deepEqual(['first', 'second', 'left', 'written', 'reading', ...TEN].map(id => start(PAGES[530], id)), ['13', '0', '13', '13 − 0 = 13', '13 minus 0 is equal to 13', DASH, DASH, DASH, DASH, DASH, DASH]);
  assert.deepEqual(['first', 'waiting', 'second', 'written', 'reading', ...TEN].map(id => start(PAGES[620], id)), ['7', '5', '0', '7 + 5', '7 plus 5', DASH, DASH, DASH, DASH, DASH, DASH]);
  assert.deepEqual(['first', 'second', 'sum', 'written', 'reading', ...TEN].map(id => start(PAGES[810], id)), ['8', '5', '13', '8 + 5 = 13', '8 plus 5 is equal to 13', '2', '3', '8 + 2 = 10', '8 plus 2 is equal to 10', '10 + 3 = 13', '10 plus 3 is equal to 13']);
});

test('ten: the steps show while the calculation crosses ten and the figure shows the ten, at every step of every control', () => {
  const add = spec(PAGES[810]);
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const cross = a < 10 && a + b > 10, s = { first: a, second: b, waiting: 0, ten: true };
    assert.deepEqual(TEN.slice(0, 3).map(id => value(add, s, id)), cross ? [String(10 - a), String(a + b - 10), `${a} + ${10 - a} = 10`] : [DASH, DASH, DASH]);
    if (cross) assert.equal(value(add, s, 'written-rest'), `10 + ${a + b - 10} = ${a + b}`);
    assert.deepEqual(TEN.map(id => value(add, { ...s, ten: false }, id)), Array(6).fill(DASH));
  }
  const split = spec(PAGES[520]);
  for (let joined = 0; joined <= 5; joined++) for (const ten of [true, false]) {
    const s = { first: 8, second: joined, waiting: 5 - joined, ten }, shows = ten && joined > 2;
    assert.deepEqual(['second', 'sum', 'to-ten', 'rest'].map(id => value(split, s, id)), [String(joined), String(8 + joined), shows ? '2' : DASH, shows ? String(joined - 2) : DASH]);
  }
  const take = spec(PAGES[530]);
  for (let f = 11; f <= 19; f++) for (let t = 0; t <= f; t++) {
    const s = { first: f, second: t, waiting: 0, ten: t >= f - 10 }, shows = f - t < 10;
    assert.deepEqual(['left', 'to-ten', 'rest', 'written-to-ten', 'written-rest'].map(id => value(take, s, id)),
      [String(f - t), shows ? String(f - 10) : DASH, shows ? String(10 - f + t) : DASH, shows ? `${f} − ${f - 10} = 10` : DASH, shows ? `10 − ${10 - f + t} = ${f - t}` : DASH]);
  }
  // The packet: the line writes the whole packet, open while a seed waits, and takes its answer and steps once it is empty.
  const tray = spec(PAGES[620]);
  for (let sown = 0; sown <= 5; sown++) for (const ten of [true, false]) {
    const st = { first: 7, second: sown, waiting: 5 - sown, ten }, empty = sown === 5, shows = empty && ten;
    assert.deepEqual(['written', 'reading', 'second', 'waiting', 'to-ten', 'rest', 'written-to-ten', 'written-rest'].map(id => value(tray, st, id)),
      [empty ? '7 + 5 = 12' : '7 + 5', empty ? '7 plus 5 is equal to 12' : '7 plus 5', String(sown), String(5 - sown), shows ? '3' : DASH, shows ? '2' : DASH, shows ? '7 + 3 = 10' : DASH, shows ? '10 + 2 = 12' : DASH]);
  }
  const full = spec(PAGES[510]);
  for (let b = 0; b <= 8; b++) assert.deepEqual(['sum', 'written'].map(id => value(full, { first: 12, second: b, waiting: 0, ten: true }, id)), [String(12 + b), `12 + ${b} = ${12 + b}`]);
});

test('ten: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ first: 12, second: 0, waiting: 5, split: true }, /a first group below 10/);
  fails({ first: 8, second: 3, split: true }, /write waiting/);
  fails({ look: 'tray', first: 8, second: 0, waiting: 5, take: true }, /take belongs to the frames/);
  fails({ look: 'tray', first: 12, second: 0, waiting: 5, split: true }, /a first group below 10/);
  fails({ look: 'tray', first: 8, second: 3, waiting: 10 }, /the counters reach 21/);
  fails({ look: 'shelf', first: 3, second: 0, written: 'ten' }, /write written: true on the shelf/);
  fails({ written: 'ten', challenge: { goal: 'steps-to-ten', second: [1, 9] } }, /from 2 to 9/);
  fails({ written: 'ten', challenge: { goal: 'steps-to-ten' } }, /second is null/);
  fails({ written: 'ten', challenge: { goal: 'steps-to-ten', second: [3, 9], sum: [2, 3] } }, /sum belongs to another goal/);
});

test('find-sum: it draws the additions of its ranges, opens unsolved, and the stepper Sum reaches each', () => {
  const g = ADD_GOALS['find-sum'], c = PAGES[710].challenge, page = { ...spec(PAGES[710]), ...g.page() }, seen = new Set();
  assert.deepEqual([page.first, page.second, page.sumCtl], [0, 0, { kind: 'stepper', lo: SUM_STEP[0], hi: SUM_STEP[1] }]);
  for (let seed = 1; seed <= 2000; seed++) {
    const t = g.draw(c, page, dice(seed));
    seen.add(`${t.a}+${t.b}`);
    assert.ok(t.a >= 9 && t.a <= 15 && t.b >= 2 && t.b <= 4 && t.a + t.b >= 11 && t.a + t.b <= 19);
    assert.deepEqual(g.holds(addStart(page, t), page, c, t), { done: false });
    const ways = [];
    for (let n = SUM_STEP[0]; n <= SUM_STEP[1]; n++) if (g.holds({ ...addStart(), sum: n, checked: true }, page, c, t).done) ways.push(n);
    assert.deepEqual(ways, [t.a + t.b]);
  }
  let pairs = 0;
  for (let a = 9; a <= 15; a++) for (let b = 2; b <= 4; b++) if (a + b >= 11 && a + b <= 19) pairs++;
  assert.equal(seen.size, pairs, 'every addition of the ranges is drawn');
  // The widest ranges: a first number past the first ten with a sum of 20 at most.
  const wide = { goal: 'find-sum', first: [1, 19], second: [1, 10], sum: [1, 20] };
  assert.equal(g.problem(wide), null);
  for (let seed = 1; seed <= 500; seed++) { const t = g.draw(wide, page, dice(seed)); assert.ok(t.a >= 1 && t.a <= 19 && t.b >= 1 && t.b <= 10 && t.a + t.b <= 20); }
  const int = String, t = { a: 4, b: 3 };
  assert.equal(words(g.line(t, false), int), '4 + 3');
  assert.equal(words(g.line(t, true), int), '4 + 3 = 7');
  const at = (n, checked = true) => g.holds({ ...addStart(), sum: n, checked }, page, c, t);
  assert.deepEqual([at(7, false), at(7), at(9), at(6)], [{ done: false }, { done: true }, { done: false, note: 'less' }, { done: false, note: 'greater' }]);
  assert.deepEqual(g.words(c, t, { int }), { a: '4', b: '3', sum: '7' });
});

test('steps-to-ten: it draws additions and subtractions across ten, 35 of each, and the steppers reach each split', () => {
  const g = ADD_GOALS['steps-to-ten'], c = PAGES[730].challenge, page = spec(PAGES[730]), seen = { '+': new Set(), '−': new Set() };
  for (let seed = 1; seed <= 4000; seed++) {
    const t = g.draw(c, page, dice(seed)), toTen = toTenOf(t);
    seen[t.sign].add(`${t.a}${t.sign}${t.b}`);
    assert.ok(t.b >= 3 && t.b <= 9);
    if (t.sign === '+') assert.ok(t.a >= 1 && t.a <= 9 && t.a + t.b >= 11 && t.a + t.b <= 18);
    else assert.ok(t.a >= 11 && t.a <= 18 && t.a - t.b >= 1 && t.a - t.b <= 9);
    assert.ok(toTen >= 1, 'the page does not open solved');
    assert.deepEqual(g.holds(addStart(page, t), page, c, t), { done: false });
    const ways = [];
    for (let a = PART_STEP[0]; a <= PART_STEP[1]; a++) for (let b = PART_STEP[0]; b <= PART_STEP[1]; b++) if (g.holds({ ...addStart(), toTen: a, rest: b, checked: true }, page, c, t).done) ways.push([a, b]);
    assert.deepEqual(ways, [[toTen, t.b - toTen]]);
    const p = g.page(t);
    assert.deepEqual([p.first, p.second, p.waiting ?? null, !!p.take], [t.a, 0, t.sign === '+' ? t.b : null, t.sign === '−']);
  }
  assert.deepEqual([seen['+'].size, seen['−'].size], [35, 35]);
  const int = String, add = { a: 8, sign: '+', b: 5 }, sub = { a: 15, sign: '−', b: 8 };
  assert.deepEqual(g.steps(add).map(l => words(l, int)), ['8 + 2 = 10', '10 + 3 = 13']);
  assert.deepEqual(g.steps(sub).map(l => words(l, int)), ['15 − 5 = 10', '10 − 3 = 7']);
  assert.deepEqual([words(g.line(add, false), int), words(g.line(sub, true), int)], ['8 + 5', '15 − 8 = 7']);
  const at = (t, toTen, rest) => g.holds({ ...addStart(), toTen, rest, checked: true }, page, c, t);
  assert.deepEqual([at(add, 2, 3), at(add, 3, 2), at(add, 1, 4), at(add, 2, 4), at(add, 2, 2)], [{ done: true }, { done: false, note: 'past' }, { done: false, note: 'short' }, { done: false, note: 'more' }, { done: false, note: 'less' }]);
  assert.deepEqual([at(sub, 5, 3), at(sub, 6, 2), at(sub, 4, 4), at(sub, 5, 9)], [{ done: true }, { done: false, note: 'past' }, { done: false, note: 'short' }, { done: false, note: 'more' }]);
  assert.equal(string('en', 'counters_note-steps-to-ten-past', { step: words({ a: 15, sign: '−', b: 6, open: true }, int) }), '15 − 6 goes past 10.');
  assert.equal(string('en', 'counters_goal-steps-to-ten-done', { line: '8 + 5 = 13', toTen: '8 + 2 = 10', rest: '10 + 3 = 13' }), '8 + 5 = 13. The two steps are 8 + 2 = 10 and 10 + 3 = 13.');
});

test('steps-to-ten: the name of to-ten and the goal line follow the kind of calculation', async () => {
  const { labelKeys, goalKey } = await import('../src/families/counters/add-model.js');
  const g = ADD_GOALS['steps-to-ten'], T = k => string('en', `counters_${k}`), has = k => T(k) != null;
  const name = page => labelKeys(page, 'to-ten').map(T).find(Boolean);
  const add = { a: 8, sign: '+', b: 5 }, sub = { a: 15, sign: '−', b: 8 };
  assert.equal(name({ ...spec(PAGES[730]), ...g.page(add) }), 'Makes ten');
  assert.equal(name({ ...spec(PAGES[730]), ...g.page(sub) }), 'Down to ten');
  assert.equal(name(spec(PAGES[530])), 'Down to ten');
  assert.equal(name(spec(PAGES[520])), 'Makes ten');
  // The goal line follows the kind with real numbers put in, and the notes and hints speak of the numbers alone.
  const say = (k, t, v) => string('en', `counters_${goalKey(k, t, has)}`, v);
  assert.equal(say('goal-steps-to-ten', add, { second: '5', calc: '8 + 5', first: '8' }), 'Split the 5 in 8 + 5 into the part that makes ten with 8 and the rest, then press Check.');
  assert.equal(say('goal-steps-to-ten', sub, { second: '8', calc: '15 − 8', first: '15' }), 'Split the 8 in 15 − 8 into the part that takes 15 down to ten and the rest, then press Check.');
  assert.equal(say('note-steps-to-ten-more', sub, { x: '5', y: '4', second: '8' }), '5 and 4 make more than 8, so make the rest smaller.');
  assert.equal(say('note-steps-to-ten-less', add, { x: '2', y: '2', second: '5' }), '2 and 2 make less than 5, so make the rest greater.');
  assert.equal(string('en', 'counters_hint-steps-to-ten-minus', { first: '13', second: '5' }), 'First work out how many to take away to bring 13 down to 10, and set that. Then set what is left of the 5.');
  assert.equal(string('en', 'counters_hint-steps-to-ten-plus', { first: '8', second: '5' }), 'First work out how many 8 needs to make 10, and set that. Then set what is left of the 5.');
});
