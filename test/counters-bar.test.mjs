// Checks the bar scene of the counters family: what its Node half accepts, what each link shows as a page opens and
// at every step of its handles and every cover, and its two goals over many draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts, LINES, measuresOf, labelKeys } from '../src/families/counters/bar-model.js';
import { BAR_GOALS, barStart, OPEN, THIRD, USES, thirdOf, partsOf } from '../src/families/counters/bar-goals.js';
import { words, reading, DASH, FACT_IDS, FACTS, factLine } from '../src/kit/written.js';
import { numbers } from '../src/kit/format.js';
import { string } from '../src/node.mjs';
import { dice } from '../src/kit/random.js';

function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null;
  try { data = counters.read({ scene: 'bar', ...fields }, { at: 'page.yaml' }, ctx).data; } catch (err) { problems.push(err.message); }
  return { data, problems };
}
const spec = fields => { const r = read(fields); assert.deepEqual(r.problems, []); return r.data; };
const start = (fields, id, lang = 'en') => counters.start(spec(fields), lang, id);
// value gives what a link reads for the bar s, as the browser writes it.
const value = (page, s, id, lang = 'en') => {
  const int = numbers(lang).int;
  if (id in LINES) { const l = LINES[id](page, s); return !l ? DASH : id.startsWith('written') ? words(l, int) : reading(l, int, (k, v) => string(lang, `hesap_${k}`, v)); }
  return int(counts(page, s)[id]);
};
const bar = (whole, first, more = {}) => ({ whole, first, cover: null, found: null, ...more });
// family gives what the three numbers and the eight facts read for a whole and a first part.
const family = (w, a) => {
  const b = w - a;
  return [String(w), String(a), String(b), `${a} + ${b} = ${w}`, `${b} + ${a} = ${w}`, `${w} − ${b} = ${a}`, `${w} − ${a} = ${b}`,
    `${a} plus ${b} is equal to ${w}`, `${b} plus ${a} is equal to ${w}`, `${w} minus ${b} is equal to ${a}`, `${w} minus ${a} is equal to ${b}`];
};
const IDS = ['whole', 'first', 'second', ...FACT_IDS];

const PAGES = {
  410: { whole: 8, first: 5, drag: ['end'], counters: true, written: true, readout: ['second', 'whole'] },
  420: { whole: 8, first: 5, written: 'family' },
  430: { whole: 11, first: 7, drag: ['split'], written: 'family', readout: ['first', 'second'] },
  440: { whole: 15, first: 6, ask: 'second', cover: true, written: true },
  620: { look: 'chocolate', whole: 12, first: 3, drag: ['split'], written: 'family', readout: ['first', 'second'] },
  720: { written: 'family', challenge: { goal: 'bar-for-fact', whole: [6, 18] } },
  730: { written: 'family', challenge: { goal: 'bar-for-two', numbers: [2, 12] } },
  810: { whole: 14, first: 8, ask: 'second', cover: true, written: true },
};

test('bar: the family lists the scene, and the pages of the section read without a problem', () => {
  assert.ok(counters.scenes.includes('bar'));
  for (const fields of Object.values(PAGES)) spec(fields);
});

test('bar: the links of each page as it opens', () => {
  assert.deepEqual(['whole', 'first', 'second', 'written', 'reading', 'written-swap'].map(id => start(PAGES[410], id)), ['8', '5', '3', '5 + 3 = 8', '5 plus 3 is equal to 8', null]);
  assert.deepEqual(IDS.map(id => start(PAGES[420], id)), family(8, 5));
  assert.deepEqual(IDS.map(id => start(PAGES[430], id)), family(11, 7));
  assert.deepEqual(IDS.map(id => start(PAGES[620], id)), family(12, 3));
  assert.deepEqual(['whole', 'first', 'second', 'written', 'reading'].map(id => start(PAGES[440], id)), ['15', '6', '9', '15 − 6', '15 minus 6']);
  assert.deepEqual(['whole', 'first', 'second', 'written', 'reading'].map(id => start(PAGES[810], id)), ['14', '8', '6', '14 − 8', '14 minus 8']);
  assert.deepEqual([measuresOf(spec(PAGES[720])), measuresOf(spec(PAGES[730]))], [[], []]);
  assert.equal(start(PAGES[430], 'reading-minus-first', 'tr'), '11 eksi 7 eşittir 4');
});

test('bar: the end at its lowest and highest place, and every link at every step of the end', () => {
  const page = spec(PAGES[410]);
  // The end pushes the split along, so the first part stays below the whole.
  for (let w = 2; w <= 20; w++) {
    const a = Math.min(5, w - 1), s = bar(w, a);
    assert.deepEqual(['whole', 'first', 'second', 'written', 'reading'].map(id => value(page, s, id)), [String(w), String(a), String(w - a), `${a} + ${w - a} = ${w}`, `${a} plus ${w - a} is equal to ${w}`]);
  }
  assert.deepEqual(['whole', 'second', 'written'].map(id => value(page, bar(10, 5), id)), ['10', '5', '5 + 5 = 10']);
  assert.deepEqual(['whole', 'second', 'written'].map(id => value(page, bar(6, 5), id)), ['6', '1', '5 + 1 = 6']);
});

test('bar: the split at its lowest and highest place, and every link at every step of the split', () => {
  for (const [n, w] of [[430, 11], [620, 12]]) {
    const page = spec(PAGES[n]);
    for (let a = 1; a <= w - 1; a++) assert.deepEqual(IDS.map(id => value(page, bar(w, a), id)), family(w, a));
  }
  // With two equal parts the swap reads the first addition, and the whole minus the first the whole minus the second.
  const even = IDS.map(id => value(spec(PAGES[620]), bar(12, 6), id));
  assert.deepEqual(even.slice(3, 7), ['6 + 6 = 12', '6 + 6 = 12', '12 − 6 = 6', '12 − 6 = 6']);
});

test('bar: the line finds the covered number, and takes its answer once the card lifts', () => {
  const page = spec(PAGES[440]), at = (cover, found) => bar(15, 6, { cover, found });
  assert.deepEqual(opening(page), at('second', 'second'));
  const read = s => ['written', 'reading', 'second'].map(id => value(page, s, id));
  assert.deepEqual(read(at('second', 'second')), ['15 − 6', '15 minus 6', '9']);
  assert.deepEqual(read(at(null, 'second')), ['15 − 6 = 9', '15 minus 6 is equal to 9', '9']);
  assert.deepEqual(read(at('whole', 'whole')), ['6 + 9', '6 plus 9', '9']);
  assert.deepEqual(read(at(null, 'whole')), ['6 + 9 = 15', '6 plus 9 is equal to 15', '9']);
  assert.deepEqual(read(at('first', 'first')), ['15 − 9', '15 minus 9', '9']);
  assert.deepEqual(read(at(null, 'first')), ['15 − 9 = 6', '15 minus 9 is equal to 6', '9']);
  assert.equal(value(spec({ whole: 15, first: 6, cover: true, written: true }), bar(15, 6), 'written'), '6 + 9 = 15');
  assert.equal(value(page, at('second', 'second'), 'reading', 'tr'), '15 eksi 6');
});

test('bar: the readouts and handles are named, the chocolate with its own words', () => {
  const T = k => string('en', `counters_${k}`), name = (page, id) => labelKeys(page, id).map(T).find(Boolean);
  assert.deepEqual(['first', 'second', 'whole', 'split', 'end'].map(id => name(spec(PAGES[430]), id)), ['First part', 'Second part', 'Whole', 'Split', 'End']);
  assert.deepEqual(['first', 'second', 'whole', 'split'].map(id => name(spec(PAGES[620]), id)), ['First piece', 'Second piece', 'Squares', 'Split']);
  assert.equal(string('tr', 'counters_bar-split'), undefined, 'the split waits for its Turkish word');
});

test('bar-for-fact: it draws facts of its range evenly, opens unsolved, and the handles reach each', () => {
  const g = BAR_GOALS['bar-for-fact'], c = PAGES[720].challenge, page = { ...spec(PAGES[720]), ...g.page() }, seen = new Set(), kinds = {};
  assert.deepEqual([page.whole, page.first, page.drag], [10, 5, ['split', 'end']]);
  for (let seed = 1; seed <= 4000; seed++) {
    const t = g.draw(c, page, dice(seed)), b = t.whole - t.first;
    seen.add(`${t.whole}:${t.first}`); kinds[t.fact] = (kinds[t.fact] ?? 0) + 1;
    assert.ok(t.whole >= 6 && t.whole <= 18 && t.first >= 1 && t.first < t.whole);
    assert.ok(!(t.whole === 10 && t.first === 5), 'the opening bar is not drawn');
    if (t.first === b) assert.ok(['written', 'written-minus-second'].includes(t.fact), 'two equal parts draw one of their two facts');
    assert.deepEqual(g.holds({ ...barStart(), checked: true }, page, c, t).done, false);
    assert.equal(g.reach(page, c, t), null);
    // Every bar the handles can set: the end from 2 to 20 and the split below it. The two answers are the parts in
    // either order.
    const ways = [];
    for (let w = 2; w <= 20; w++) for (let a = 1; a < w; a++) if (g.holds({ whole: w, first: a, checked: true }, page, c, t).done) ways.push(a);
    assert.deepEqual(ways.sort((x, y) => x - y), [...new Set([t.first, b])].sort((x, y) => x - y));
  }
  assert.equal(seen.size, [...Array(13)].reduce((n, _, i) => n + (i + 6 - 1), 0) - 1, 'every bar of the range but the opening one is drawn');
  // An addition and a subtraction each about half the time, and each written fact from one draw only.
  assert.ok(kinds.written > 1800 && (kinds['written-minus-first'] ?? 0) + (kinds['written-minus-second'] ?? 0) > 1800, 'additions and subtractions are each drawn about half the time');
  const said = new Map();
  for (let w = 6; w <= 18; w++) for (let a = 1; a < w; a++) for (const f of ['written', 'written-minus-first']) {
    const key = words(factLine(f, a, w - a), String), was = said.get(key);
    assert.ok(!was || (a === w - a), `${key} comes from one draw`); said.set(key, true);
  }
  const t = { whole: 16, first: 9, fact: 'written-minus-first' }, int = String;
  const at = (w, a) => g.holds({ whole: w, first: a, checked: true }, page, c, t);
  // A right whole with a wrong split says which way to the nearer of the two places that give the parts 9 and 7.
  assert.deepEqual([at(16, 9), at(16, 7), at(17, 9), at(15, 9), at(16, 8), at(16, 3), at(16, 12), at(16, 9).done && g.holds({ whole: 16, first: 9, checked: false }, page, c, t)],
    [{ done: true }, { done: true }, { done: false, note: 'longer' }, { done: false, note: 'shorter' }, { done: false, note: 'right' }, { done: false, note: 'right' }, { done: false, note: 'left' }, { done: false }]);
  const v = g.words(c, t, null, { int, written: l => words(l, int) });
  assert.equal(string('en', 'counters_goal-bar-for-fact', v), 'Set the bar model of the family of 16 − 9 = 7, then press Check.');
  assert.equal(string('en', 'counters_goal-bar-for-fact-done', v), '16 is the whole, and 9 and 7 are its parts.');
  assert.equal(string('en', 'counters_note-bar-for-fact-longer', v), 'The bar is longer than the whole of 16 − 9 = 7.');
  assert.deepEqual([g.hint(t), g.hint({ ...t, fact: 'written-swap' })], ['minus', 'plus']);
  assert.equal(string('en', 'counters_note-bar-for-fact-right', v), 'The whole is right, and the split is too far to the left for the parts of 16 − 9 = 7. Drag it to the right.');
  assert.equal(string('en', 'counters_hint-bar-for-fact-minus', v), 'In 16 − 9 = 7, the whole comes first. Drag the end to the whole, then split it into the other two numbers.');
  const plus = { whole: 13, first: 9, fact: 'written-swap' }, pv = g.words(c, plus, null, { int, written: l => words(l, int) });
  assert.equal(string('en', 'counters_hint-bar-for-fact-plus', pv), 'In 4 + 9 = 13, the whole comes after the = sign. Drag the end to the whole, then split it into the two parts.');
  assert.deepEqual(g.facts(t, null, false), { first: 9, second: 7, listed: ['written'], lines: { written: factLine('written-minus-first', 9, 7) } });
  assert.deepEqual(g.facts(t, { whole: 16, first: 7 }, true), { first: 7, second: 9, listed: FACTS });
});

test('bar-for-two: it draws two different numbers, opens unsolved at 0, and both uses reach the goal on the stepper', () => {
  const g = BAR_GOALS['bar-for-two'], c = PAGES[730].challenge, page = { ...spec(PAGES[730]), ...g.page() }, seen = new Set();
  assert.deepEqual([page.drag, page.useCtl.items, page.thirdCtl, barStart({ greater: 9, less: 4 }).third], [[], USES, { kind: 'stepper', lo: 0, hi: 20 }, 9]);
  for (let seed = 1; seed <= 3000; seed++) {
    const t = g.draw(c, page, dice(seed));
    seen.add(`${t.greater}:${t.less}`);
    assert.ok(t.less >= 2 && t.greater <= 12 && t.less < t.greater && t.greater + t.less <= 20);
    for (const use of USES) assert.equal(g.holds({ ...barStart(t), use, checked: true }, page, c, t).done, false, 'the page opens unsolved in either use');
    assert.equal(g.reach(page, c, t), null);
    // Every setting of the segment and the stepper: the sum and the difference each solve the goal whatever the
    // segment shows, and the goal names the use each one matches.
    const ways = [];
    for (const use of USES) for (let n = THIRD[0]; n <= THIRD[1]; n++) { const r = g.holds({ use, third: n, checked: true }, page, c, t); if (r.done) ways.push(`${use}:${n}:${r.use}`); }
    const sum = t.greater + t.less, diff = t.greater - t.less;
    assert.deepEqual(ways, [`parts:${diff}:whole`, `parts:${sum}:parts`, `whole:${diff}:whole`, `whole:${sum}:parts`]);
  }
  let pairs = 0;
  for (let a = 2; a <= 12; a++) for (let b = a + 1; b <= 12; b++) if (a + b <= 20) pairs++;
  assert.equal(seen.size, pairs, 'every pair of the range is drawn');
  const t = { greater: 7, less: 4 }, int = String;
  const at = (use, third) => g.holds({ use, third, checked: true }, page, c, t);
  assert.deepEqual([at('parts', 11), at('whole', 3), at('parts', 3), at('whole', 11), at('parts', 12), at('parts', 10), at('whole', 5), at('whole', 2)],
    [{ done: true, use: 'parts' }, { done: true, use: 'whole' }, { done: true, use: 'whole' }, { done: true, use: 'parts' }, { done: false, note: 'parts-over' }, { done: false, note: 'parts-under' }, { done: false, note: 'whole-over' }, { done: false, note: 'whole-under' }]);
  const say = (k, s) => string('en', `counters_${k}`, g.words(c, t, s, { int }));
  assert.equal(say('goal-bar-for-two', null), 'Find a third number that makes a family with 7 and 4, then press Check.');
  assert.equal(say('goal-bar-for-two-done', { use: 'parts', third: 11 }), 'The family of 7, 4 and 11 holds both numbers. So does the family of 7, 4 and 3.');
  assert.equal(say('goal-bar-for-two-done', { use: 'whole', third: 3 }), 'The family of 7, 4 and 3 holds both numbers. So does the family of 7, 4 and 11.');
  assert.equal(say('note-bar-for-two-parts-over', { use: 'parts', third: 12 }), '7 and 4 make less than 12.');
  assert.equal(say('note-bar-for-two-parts-under', { use: 'parts', third: 10 }), '7 and 4 make more than 10.');
  assert.equal(say('note-bar-for-two-whole-over', { use: 'whole', third: 5 }), '4 and 5 make more than 7.');
  assert.equal(say('note-bar-for-two-whole-under', { use: 'whole', third: 2 }), '4 and 2 make less than 7.');
  assert.equal(say('hint-bar-for-two', null), 'A family holds a whole and two parts. Use 7 and 4 as the two parts and add them, or use 7 as the whole and 4 as a part and find the missing part.');
  assert.deepEqual([thirdOf(t, 'parts'), thirdOf(t, 'whole')], [11, 3]);
  // The bar holds the two numbers where the segment puts them, and the facts are the reader's family once it holds.
  assert.deepEqual([partsOf(t, 'parts', 11), partsOf(t, 'whole', 3)], [{ first: 7, second: 4, whole: 11 }, { first: 4, second: 3, whole: 7 }]);
  assert.deepEqual(g.facts(t, { use: 'whole', third: 3 }, true), { first: 4, second: 3, listed: FACTS });
  assert.deepEqual(g.facts(t, { use: 'parts', third: 11 }, false).listed, []);
});

test('bar: the end runs over the places a page gives it', () => {
  const page = spec({ ...PAGES[410], end: [6, 12] });
  assert.deepEqual(page.end, [6, 12]);
  for (let w = 6; w <= 12; w++) assert.deepEqual(['whole', 'first', 'second', 'written'].map(id => value(page, bar(w, 5), id)), [String(w), '5', String(w - 5), `5 + ${w - 5} = ${w}`]);
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...PAGES[410], end: [9, 12] }, /with the whole 8 between them/);
  fails({ ...PAGES[410], end: [6, 21] }, /from 2 to 20/);
  fails({ whole: 8, first: 5, end: [6, 12] }, /write drag: \[end\] as well/);
});

test('bar: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ first: 3 }, /whole is missing/);
  fails({ whole: 21, first: 3 }, /from 2 to 20/);
  fails({ whole: 8 }, /first is missing/);
  fails({ whole: 8, first: 8 }, /from 1 to 7, below the whole/);
  fails({ whole: 8, first: 5, drag: ['end', 'end'] }, /each handle once/);
  fails({ look: 'chocolate', whole: 12, first: 3, drag: ['end'] }, /write drag: \[split\]/);
  fails({ look: 'chocolate', whole: 12, first: 3, counters: true }, /counters belongs to look: bar/);
  fails({ whole: 15, first: 6, ask: 'second', cover: true, written: 'family' }, /write written: true or leave written out/);
  fails({ whole: 15, first: 6, ask: 'second' }, /write cover: true/);
  fails({ whole: 8, first: 5, facts: ['written'] }, /facts goes with written: family/);
  fails({ whole: 8, first: 5, written: 'family', facts: [] }, /write each fact once/);
  fails({ whole: 8, first: 5, written: 'family', readout: ['written'] }, /reads out whole, first, second$/m);
  fails({ whole: 8, first: 5, readout: ['sum'] }, /reads out whole, first, second$/m);
  fails({ written: 'family', whole: 8, challenge: PAGES[720].challenge }, /whole is set by challenge.goal bar-for-fact/);
  fails({ written: 'family', drag: ['end'], challenge: PAGES[720].challenge }, /drag is set by challenge.goal/);
  fails({ written: true, challenge: PAGES[720].challenge }, /write written: family or leave it out/);
  fails({ challenge: { goal: 'bar-for-fact', whole: [2, 10] } }, /from 3 to 20/);
  fails({ challenge: { goal: 'bar-for-fact', numbers: [2, 10] } }, /numbers belongs to another goal/);
  fails({ challenge: { goal: 'bar-for-two', numbers: [0, 12] } }, /from 1 to 19/);
  fails({ challenge: { goal: 'bar-for-two', numbers: [12, 12] } }, /leave no two different numbers/);
  fails({ challenge: { goal: 'bar-for-two', numbers: [11, 19] } }, /whose sum is 20 at most/);
  fails({ written: 'family', end: [6, 12], challenge: PAGES[730].challenge }, /end is set by challenge.goal/);
  fails({ challenge: { goal: 'find-sum', whole: [6, 18] } }, /the goals are bar-for-fact, bar-for-two/);
  assert.deepEqual(OPEN, { whole: 10, first: 5 });
});
