// Checks the line scene of the line family: what its Node half accepts, what each link shows as a page opens, the
// jumps and their arcs, the drag of a point and the line of words, at every mark of the pages' lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import line from '../src/families/line/index.mjs';
import { opening, jump, place, pick, open, lay, show, next, toggleMiddle, estimate, numbered, standing, moveStart, resize, writtenOf, backOf, secondTo, drawLine, isMark, posOf, slide, labelKeep, LABELS_APART, PHONE, DIGIT, settle, even, gapsKey, sides, offsetsOf, markOf, shuffled, findsOf, middleOf, readoutsOf, arcsOf, jumpsOf, counts, readingOf, gapsOf, labelled, numberAt, tensOf, cardsOf, gapOn, labelRows } from '../src/families/line/model.js';
import { GOALS, challengeStart, TWO_GAPS, UNMARKED_APART } from '../src/families/line/goals.js';
import { dice } from '../src/kit/random.js';
import { string } from '../src/node.mjs';
import { words as kitWords, reading as kitReading } from '../src/kit/written.js';

function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null, has = null;
  try { const r = line.read({ scene: 'line', ...fields }, { at: 'page.yaml' }, ctx); data = r.data; has = r.has; } catch (err) { problems.push(err.message); }
  return { data, has, problems };
}
const spec = fields => { const r = read(fields); assert.deepEqual(r.problems, []); return r.data; };
const start = (fields, ids) => ids.map(id => line.start(spec(fields), 'en', id));
const PAGES = {
  110: { look: 'stones', to: 10, point: 0, jump: true, readout: ['jumps'] },
  120: { look: 'stones-on-line', to: 10, point: 0, readout: ['point'] },
  130: { to: 20, point: 0, jump: true, readout: ['point', 'jumps'] },
  150: { to: 10, point: 0, jump: true, moved: [{ mark: 4, by: 0.4 }, { mark: 7, by: -0.4 }], readout: ['point', 'jumps'] },
  140: { to: 20, point: 13, second: 3, flag: true, reading: true },
  210: { to: 100, step: { segment: [1, 2, 5, 10], start: 10 }, jump: true, readout: ['jumps', 'point'] },
  220: { to: 100, labels: 10, point: 30, jump: true, readout: ['point', 'jumps'] },
  310: { to: 100, step: 10, open: true, point: false },
  320: { from: 30, to: 60, labels: 10, point: 46, jump: true, bracket: 10, readout: ['point', 'ten-before', 'ten-after'] },
  330: { from: 25, to: 55, step: 5, labels: [35, 40], blank: [25, 30, 45, 50, 55], cards: [45, 25, 55, 41, 30, 50], point: false, readout: ['placed'] },
  410: { from: 0, to: 20, labels: 'ends', jump: true, find: [3, 19, 14], readout: ['jumps'] },
  420: { from: 0, to: 100, labels: 'ends', middle: 'button', jump: true, find: [48, 53, 96], readout: ['jumps'] },
  610: { look: 'street', from: 1, to: 60, labels: [1, 20, 50, 60], find: [46, 22, 57] },
  510: { from: 0, to: 10, marks: 'ends', find: [8, 2, 4] },
  520: { from: 0, to: 100, marks: 'ends', middle: 'button', find: [60, 44, 78] },
  530: { from: 10, to: 20, marks: 'ends', point: 16, middle: 'button', estimate: { stepper: [10, 20], start: 15 } },
  620: { look: 'book', from: 0, to: 100, find: [75, 25, 90] },
  730: { middle: 'button', challenge: { goal: 'place-unmarked', from: [0, 30], to: [40, 100] } },
  810: { from: 0, to: 100, labels: 10, point: 64, bracket: 10, readout: ['point', 'ten-before', 'ten-after'] },
  720: { challenge: { goal: 'place-two-labels', step: [2, 5, 10], from: [0, 50] } },
  710: { from: 0, to: 100, labels: 10, jump: true, challenge: { goal: 'place', target: [11, 99] } },
};
const link = (page, s, id) => counts(page, s)[id];
const presses = (page, s, dir, n) => { for (let i = 0; i < n; i++) s = jump(page, s, dir) ?? s; return s; };

test('line: the family has one scene, named line', () => assert.deepEqual(line.scenes, ['line']));

test('line: the pages of in-order link what they show as they open', () => {
  assert.deepEqual(start(PAGES[110], ['jumps', 'point', 'second', 'reading']), ['0', '0', null, null]);
  assert.deepEqual(start(PAGES[120], ['point', 'jumps']), ['0', null]);
  assert.deepEqual(start(PAGES[130], ['point', 'jumps', 'to', 'from', 'step']), ['0', '0', '20', '0', '1']);
  assert.deepEqual(start(PAGES[140], ['point', 'second', 'reading', 'jumps']), ['13', '3', '13 is greater than 3', null]);
  assert.equal(line.start(spec({ ...PAGES[140], second: 13 }), 'en', 'reading'), 'Both points are on 13');
  assert.equal(line.start(spec(PAGES[140]), 'tr', 'reading'), '13, 3 sayısından büyüktür');
  const { has } = read(PAGES[130]);
  assert.deepEqual(['point', 'jumps', 'second', 'reading'].map(has), [true, true, false, false]);
});

test('line: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ point: 3 }, /to/);
  fails({ to: 0 }, /write a number above the left end 0/);
  fails({ to: 101 }, /at most 100/);
  fails({ to: 20, point: 21 }, /point is 21, write a number on a mark from 0 to 20/);
  fails({ to: 20, second: -1, flag: true }, /second is -1/);
  fails({ look: 'stones', to: 21 }, /at most 20 stones/);
  fails({ look: 'stones', to: 10, second: 3, flag: true }, /second belongs to the line look/);
  fails({ look: 'stones-on-line', to: 10, reading: true }, /reading belongs to the line look/);
  fails({ to: 20, second: 3 }, /second goes with flag/);
  fails({ to: 20, reading: true }, /reading compares two points/);
  fails({ to: 20, readout: ['jumps'] }, /readout names "jumps", this page reads out point, step, from, to/);
  fails({ to: 20, second: 3, flag: true, reading: true, readout: ['reading'] }, /readout names "reading"/);
  fails({ look: 'street', to: 20 }, /look/);
});

test('line: the jump buttons stop at the ends of the line', () => {
  for (const id of [110, 130]) {
    const page = spec(PAGES[id]), n = gapsOf(page), s = opening(page);
    assert.equal(jump(page, s, -1), null, `${id}: Jump left does nothing at the left end`);
    const end = presses(page, s, 1, n);
    assert.deepEqual([end.at, jumpsOf(end), jump(page, end, 1)], [n, n, null], `${id}: Jump right reaches the right end and stops`);
  }
});

test('line: the jumps from 0 are as many as the number at the point, at every mark', () => {
  for (const id of [110, 130]) {
    const page = spec(PAGES[id]);
    let s = opening(page);
    for (let k = 1; k <= gapsOf(page); k++) {
      s = jump(page, s, 1);
      const c = counts(page, s);
      assert.deepEqual([c.point, c.jumps], [k, k]);
      assert.deepEqual(arcsOf(s).map(a => [a.from, a.to]), Array.from({ length: k }, (_, i) => [i, i + 1]));
    }
    for (let k = gapsOf(page) - 1; k >= 0; k--) { s = jump(page, s, -1); assert.deepEqual([counts(page, s).point, counts(page, s).jumps], [k, k]); }
  }
});

test('line: a press against the last jump takes it back, and a drag starts the jumps again', () => {
  const page = spec(PAGES[130]);
  let s = presses(page, opening(page), 1, 5);
  assert.deepEqual([counts(page, s).point, jumpsOf(s), arcsOf(s).length], [5, 5, 5]);
  s = place(s, 'point', 12);
  assert.deepEqual([counts(page, s).point, jumpsOf(s), arcsOf(s)], [12, 0, []]);
  s = jump(page, s, 1);
  assert.deepEqual([counts(page, s).point, jumpsOf(s), arcsOf(s)], [13, 1, [{ from: 12, to: 13, dir: 1 }]]);
  s = jump(page, s, -1);
  assert.deepEqual([counts(page, s).point, jumpsOf(s)], [12, 0]);
  s = jump(page, s, -1);
  assert.deepEqual([counts(page, s).point, jumpsOf(s), arcsOf(s)], [11, 1, [{ from: 12, to: 11, dir: -1 }]]);
  // A drag from any mark to any mark reads that mark and no jumps.
  for (let k = 0; k <= 20; k++) assert.deepEqual([counts(page, place(s, 'point', k)).point, counts(page, place(s, 'point', k)).jumps], [k, 0]);
});

test('line: the line of words names the later number, at every mark of the second point', () => {
  const page = spec(PAGES[140]), s = opening(page);
  for (let k = 0; k <= 20; k++) {
    const t = place(s, 'second', k), r = readingOf(page, t), words = string('en', `line_${r.key}`, { a: String(r.a), b: String(r.b) });
    assert.equal(counts(page, t).second, k);
    assert.equal(words, k === 13 ? 'Both points are on 13' : `${Math.max(k, 13)} is greater than ${Math.min(k, 13)}`);
  }
  const moved = place(place(s, 'second', 18), 'point', 0), r = readingOf(page, moved);
  assert.deepEqual([r.a, r.b], [18, 0]);
});

test('line: the point of page 140 reads at every mark, with the second point on 3', () => {
  const page = spec(PAGES[140]), s = place(opening(page), 'second', 3);
  for (let k = 0; k <= 20; k++) {
    const t = place(s, 'point', k), r = readingOf(page, t), words = string('en', `line_${r.key}`, { a: String(r.a), b: String(r.b) });
    assert.deepEqual([link(page, t, 'point'), link(page, t, 'second')], [k, 3]);
    assert.equal(words, k === 3 ? 'Both points are on 3' : `${Math.max(k, 3)} is greater than ${Math.min(k, 3)}`);
  }
});

test('line: a drag on the stones over the line of page 120 reads every mark from 0 to 10', () => {
  const page = spec(PAGES[120]), s = opening(page);
  assert.equal(link(page, s, 'point'), 0);
  for (let k = 0; k <= 10; k++) assert.equal(line.start({ ...page, point: k }, 'en', 'point'), String(k));
  for (let k = 0; k <= 10; k++) assert.equal(link(page, place(s, 'point', k), 'point'), k);
  assert.equal(gapsOf(page), 10);
});

test('line: the step picker of page 210 keeps the mark of the point and its jumps, and every label follows the step', () => {
  assert.deepEqual(start(PAGES[210], ['to', 'step', 'jumps', 'point']), ['100', '10', '0', '0']);
  const page = spec(PAGES[210]);
  assert.deepEqual([page.step, page.stepCtl], [10, { kind: 'segment', items: [1, 2, 5, 10] }]);
  const three = presses(page, opening(page), 1, 3);
  assert.deepEqual([link(page, three, 'point'), link(page, three, 'jumps')], [30, 3]);
  const read = step => { const t = pick(three, step); return [link(page, t, 'step'), link(page, t, 'to'), link(page, t, 'point'), link(page, t, 'jumps'), arcsOf(t).length]; };
  assert.deepEqual([5, 2, 1, 10].map(read), [[5, 50, 15, 3, 3], [2, 20, 6, 3, 3], [1, 10, 3, 3, 3], [10, 100, 30, 3, 3]]);
  // point is jumps times step at every pick and every mark, from the least step to the greatest.
  for (const step of [1, 2, 5, 10]) {
    let s = pick(opening(page), step);
    for (let k = 0; k <= 10; k++) {
      assert.deepEqual([link(page, s, 'point'), link(page, s, 'jumps'), link(page, s, 'to')], [k * step, k, 10 * step]);
      for (let j = 0; j <= 10; j++) assert.ok(labelled(page, numberAt(page, j, step)), 'a page with a step picker labels every mark');
      s = jump(page, s, 1) ?? s;
    }
    assert.equal(jump(page, s, 1), null, `the step ${step} stops at its right end`);
  }
});

test('line: page 220 labels the tens on long marks, and the point reads every mark from 0 to 100', () => {
  assert.deepEqual(start(PAGES[220], ['point', 'jumps', 'step', 'to']), ['30', '0', '1', '100']);
  const page = spec(PAGES[220]);
  assert.deepEqual(Array.from({ length: 101 }, (_, n) => n).filter(n => labelled(page, n)), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  let s = presses(page, opening(page), 1, 7);
  assert.deepEqual([link(page, s, 'point'), link(page, s, 'jumps')], [37, 7]);
  s = presses(page, s, 1, 3);
  assert.deepEqual([link(page, s, 'point'), link(page, s, 'jumps')], [40, 10]);
  s = jump(page, place(s, 'point', 80), -1);
  assert.deepEqual([link(page, s, 'point'), link(page, s, 'jumps')], [79, 1]);
  for (let k = 0; k <= 100; k++) assert.deepEqual([link(page, place(s, 'point', k), 'point'), link(page, place(s, 'point', k), 'jumps')], [k, 0]);
  assert.equal(jump(page, place(s, 'point', 0), -1), null);
  assert.equal(jump(page, place(s, 'point', 100), 1), null);
});

test('line: a step, labels or a challenge out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ to: 100, step: { segment: [5, 2], start: 5 } }, /from the least to the greatest/);
  fails({ to: 100, step: { segment: [1, 2, 5, 10], start: 3 } }, /step.start is 3, write one of the steps 1, 2, 5, 10/);
  fails({ to: 100, step: { segment: [1, 2, 5, 10], start: 10 }, labels: 10 }, /labels every mark, leave labels out/);
  fails({ to: 25, step: 10 }, /a whole number of steps of 10/);
  fails({ to: 100, step: 5, labels: 12 }, /labels is 12, write a multiple of the step 5/);
  fails({ look: 'stones', to: 10, step: 2 }, /step belongs to the line look/);
  const place = PAGES[710];
  fails({ ...place, labels: 'all' }, /labels is all, so every target would carry its label/);
  fails({ ...place, readout: ['point'] }, /a challenge page shows no readouts/);
  fails({ ...place, flag: true }, /flag would give the answer away/);
  fails({ ...place, step: { segment: [1, 2, 5, 10], start: 1 }, labels: 'all' }, /step is a segment/);
  fails({ ...place, challenge: { goal: 'place', target: [11, 120] } }, /inside the line from 0 to 100/);
  fails({ ...place, challenge: { goal: 'place' } }, /target is null/);
  fails({ ...place, challenge: { goal: 'other', target: [11, 99] } }, /the goals are place/);
  fails({ ...place, challenge: { goal: 'place', target: [10, 10] } }, /draws nothing from what the page declares/);
  fails({ ...place, point: 15, challenge: { goal: 'place', target: [15, 15] } }, /draws nothing/);
});

test('line: the goal place draws every number from 11 to 99 that is no ten, and each is reached by the jumps and the drag', () => {
  const r = read(PAGES[710]);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(['point', 'jumps', 'step'].map(id => r.has(id)), [false, false, false]);
  const page = r.data, c = page.challenge, goal = GOALS.place, seen = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const t = goal.draw(c, page, dice(seed)).target;
    assert.ok(t >= 11 && t <= 99 && t % 10, `${t} is from 11 to 99 and no ten`);
    seen.add(t);
  }
  const all = Array.from({ length: 89 }, (_, i) => i + 11).filter(n => n % 10);
  assert.deepEqual([...seen].sort((a, b) => a - b), all);
  for (const t of all) {
    const s0 = opening(page), state = s => ({ checked: s.checked, point: link(page, s, 'point') });
    assert.deepEqual(goal.holds(challengeStart(page), page, c, { target: t }), { done: false });
    // The jumps from 0 reach the target, and Check holds there and nowhere else.
    let s = s0;
    for (let k = 0; k < t; k++) { assert.deepEqual(goal.holds(state({ ...s, checked: true }), page, c, { target: t }), { done: false, note: 'left' }); s = jump(page, s, 1); }
    assert.deepEqual(goal.holds(state(s), page, c, { target: t }), { done: false }, 'the goal waits for Check');
    assert.deepEqual(goal.holds(state({ ...s, checked: true }), page, c, { target: t }), { done: true });
    assert.deepEqual(goal.holds(state({ ...jump(page, s, 1), checked: true }), page, c, { target: t }), { done: false, note: 'right' });
    // A drag to the ten before and jumps from there reach it as well, and a move after Check takes the tick back.
    const ten = Math.floor(t / 10) * 10, d = presses(page, place({ ...s0, checked: true }, 'point', ten), 1, t - ten);
    assert.deepEqual([link(page, d, 'point'), d.checked], [t, false]);
    assert.equal(goal.reach(page, c, { target: t }), null);
  }
});

test('line: labelRows, given the width of a digit, keeps the labels of 0 to 20 on a 390px stage at 10px or more and 4px apart', () => {
  // The stage of a 390px phone is 357px wide, and a digit of the labels is about 0.6 of their size wide.
  const gap = gapOn(357, 20, false), wide = 2 * 0.6, { font, rows } = labelRows(wide, gap, { base: 14, least: 10, apart: 4 });
  assert.ok(font >= 10, `the labels are ${font}px`);
  const apart = rows * gap - wide * font;
  assert.ok(apart >= 4 - 1e-9, `two labels next to each other stand ${apart}px apart`);
  // Wider digits move every other label to a second row, still at 10px or more and 4px apart.
  const two = labelRows(2 * 0.75, gap, { base: 14, least: 10, apart: 4 });
  assert.equal(two.rows, 2);
  assert.ok(two.font >= 10 && 2 * gap - 1.5 * two.font >= 4 - 1e-9);
  // A wide stage keeps one row at the full size.
  assert.deepEqual(labelRows(wide, gapOn(1000, 20, false), { base: 16 }), { font: 16, rows: 1 });
});

test('line: page 310 has no point and opens each gap, one at a time', () => {
  assert.deepEqual(start(PAGES[310], ['from', 'to', 'step', 'point', 'jumps']), ['0', '100', '10', null, null]);
  const page = spec(PAGES[310]);
  let s = opening(page);
  assert.deepEqual([s.at, s.open], [null, null]);
  for (let k = 0; k < 10; k++) { s = open(s, k); assert.equal(s.open, k); }
  s = open(s, 4); assert.equal(s.open, 4);
  s = open(s, 4); assert.equal(s.open, null, 'a tap on the open gap closes it');
});

test('line: the bracket of page 320 reaches from the ten before to the ten after, at every mark from 30 to 60', () => {
  assert.deepEqual(start(PAGES[320], ['point', 'ten-before', 'ten-after', 'from', 'to', 'step', 'jumps']), ['46', '40', '50', '30', '60', '1', '0']);
  const page = spec(PAGES[320]), s = opening(page);
  for (let n = 30; n <= 60; n++) {
    const t = place(s, 'point', n - 30), c = counts(page, t);
    const want = n % 10 ? [n - n % 10, n - n % 10 + 10] : [null, null];
    assert.deepEqual([c.point, c['ten-before'], c['ten-after']], [n, ...want]);
    assert.deepEqual(['ten-before', 'ten-after'].map(id => line.start({ ...page, point: n }, 'en', id)), n % 10 ? want.map(String) : ['–', '–']);
  }
  // On each ten of the line both links read a dash.
  for (const n of [30, 40, 50, 60]) assert.deepEqual(['ten-before', 'ten-after'].map(id => line.start({ ...page, point: n }, 'en', id)), ['–', '–']);
  let t = place(s, 'point', 53 - 30);
  t = presses(page, t, -1, 3);
  assert.deepEqual([counts(page, t).point, tensOf(page, t)], [50, null]);
  t = jump(page, t, -1);
  assert.deepEqual([counts(page, t).point, tensOf(page, t), counts(page, t).jumps], [49, { before: 40, after: 50 }, 4]);
});

test('line: a card of page 330 stays on its own blank mark and goes back from any other', () => {
  assert.deepEqual(start(PAGES[330], ['placed', 'step', 'from', 'to', 'point']), ['0', '5', '25', '55', null]);
  const page = spec(PAGES[330]);
  assert.deepEqual(cardsOf(page), [45, 25, 55, 41, 30, 50]);
  let s = opening(page);
  for (const m of page.blank) assert.equal(lay(page, s, 41, m), s, `41 goes back from ${m}`);
  assert.equal(lay(page, s, 45, 50), s);
  let n = 0;
  for (const m of [25, 30, 45, 50, 55]) { s = lay(page, s, m, m); assert.equal(counts(page, s).placed, ++n); }
  assert.equal(lay(page, s, 45, 45), s, 'a card is placed once');
  assert.deepEqual(cardsOf(spec({ ...PAGES[330], cards: true })), [25, 30, 45, 50, 55]);
});

test('line: fields of section 030 out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ to: 20, point: false, jump: true }, /jump moves or reads the point, and point is false/);
  fails({ to: 100, open: true }, /a line in ones has none/);
  fails({ from: 45, to: 60, bracket: 10, labels: 10 }, /from and to are tens/);
  fails({ from: 40, to: 60, bracket: 10, labels: [40, 60] }, /label every ten/);
  fails({ ...PAGES[330], labels: [35, 41] }, /labels lists 41, which is no mark/);
  fails({ ...PAGES[330], blank: [35] }, /blank lists 35/);
  fails({ ...PAGES[330], cards: [45, 25] }, /cards leaves out 55/);
  fails({ ...PAGES[330], blank: [] }, /cards go with blank/);
  fails({ ...PAGES[720], to: 100 }, /to is drawn by challenge.goal place-two-labels/);
  fails({ challenge: { goal: 'place-two-labels', step: [3], from: [0, 50] } }, /write a list of steps from 2, 5, 10/);
  fails({ challenge: { goal: 'place-two-labels', step: [10], from: [10, 50] } }, /draws no line, as step \[10\] and from \[10,50\] give no line of 10 gaps that ends at 100 or below/);
  fails({ challenge: { goal: 'place-two-labels', step: [10], from: [0, 50], target: [1, 9] } }, /challenge.target belongs to another goal/);
});

test('line: the goal place-two-labels draws a line of 10 gaps up to 100, and every target is reached by the drag', () => {
  const r = read(PAGES[720]);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(['point', 'step', 'from'].map(id => r.has(id)), [false, false, false]);
  const c = PAGES[720].challenge, goal = GOALS['place-two-labels'], lines = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const t = goal.draw(c, r.data, dice(seed)), page = spec({ to: t.to, from: t.from, step: t.step, labels: t.labels, point: t.start });
    lines.add(`${t.step}:${t.from}`);
    assert.ok([2, 5, 10].includes(t.step) && t.from % t.step === 0 && t.from >= 0 && t.from <= 50 && t.to === t.from + TWO_GAPS * t.step && t.to <= 100);
    assert.equal(t.labels[1] - t.labels[0], t.step, 'the two labels are marks next to each other');
    assert.ok(t.labels.includes(t.start));
    for (const l of t.labels) assert.ok(Math.abs(t.target - l) >= 3 * t.step, `the target ${t.target} is three steps or more from ${l}`);
    assert.equal(goal.reach(page, c, t), null);
    // The drag puts the point on any mark: on the target Check holds, and on its neighbours it says which side.
    const s0 = opening(page), at = n => place(s0, 'point', (n - t.from) / t.step), state = (s, checked) => ({ checked, point: counts(page, s).point });
    assert.deepEqual(goal.holds(challengeStart(page, t), page, c, t), { done: false });
    assert.deepEqual(goal.holds(state(at(t.target), true), page, c, t), { done: true });
    assert.deepEqual(goal.holds(state(at(t.target), false), page, c, t), { done: false });
    if (t.target > t.from) assert.deepEqual(goal.holds(state(at(t.target - t.step), true), page, c, t), { done: false, note: 'left' });
    if (t.target < t.to) assert.deepEqual(goal.holds(state(at(t.target + t.step), true), page, c, t), { done: false, note: 'right' });
  }
  // Steps of 2 and 5 start from 0 to 50, and a step of 10 from 0 alone.
  assert.equal(lines.size, 26 + 11 + 1);
  assert.deepEqual(goal.page({ step: 5, from: 10, to: 60, labels: [30, 35], start: 35, target: 50 }), { from: 10, to: 60, step: 5, labels: [30, 35], point: 35, reveal: true });
});

test('line: the cards of cards: true come in an order the dice draw, never the order of their marks', () => {
  const blanks = [25, 30, 45, 50, 55], orders = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const c = shuffled(blanks, dice(seed));
    assert.deepEqual([...c].sort((a, b) => a - b), blanks);
    assert.notDeepEqual(c, blanks, `seed ${seed} lays the cards in the order of their marks`);
    orders.add(c.join());
  }
  assert.ok(orders.size > 50, `${orders.size} orders in 500 draws`);
  assert.deepEqual(shuffled([7], dice(1)), [7]);
  assert.deepEqual(opening(spec(PAGES[330])).cards, [45, 25, 55, 41, 30, 50], 'a list keeps its written order');
});

test('line: page 410 labels its ends, and find, Show and Next go through 3, 19 and 14', () => {
  assert.deepEqual(start(PAGES[410], ['find', 'jumps', 'from', 'to', 'point', 'middle']), ['3', '0', '0', '20', null, null]);
  const page = spec(PAGES[410]);
  assert.deepEqual(Array.from({ length: 21 }, (_, n) => n).filter(n => labelled(page, n)), [0, 20]);
  assert.deepEqual(readoutsOf(page), ['find', 'jumps', 'step', 'from', 'to']);
  let s = opening(page);
  const seen = [];
  for (let i = 0; i < 4; i++) { seen.push(link(page, s, 'find')); s = next(page, show(s)); }
  assert.deepEqual(seen, [3, 19, 14, 3], 'Next goes through the list and back to its first number');
  s = show(presses(page, opening(page), 1, 3));
  assert.deepEqual([s.shown, link(page, s, 'jumps')], [true, 3]);
  assert.equal(jump(page, s, 1).shown, false, 'a jump takes the reveal away');
  assert.equal(place(s, 'point', 20).shown, false, 'a drag takes the reveal away');
  // The jumps reach both ends, and back from 20 one jump finds 19.
  const end = place(s, 'point', 20);
  assert.deepEqual([jump(page, end, 1), link(page, jump(page, end, -1), 'jumps')], [null, 1]);
  assert.equal(jump(page, opening(page), -1), null);
});

test('line: page 420 draws the middle, 50, with its button, and the lens shows its label', () => {
  assert.deepEqual(start(PAGES[420], ['find', 'middle', 'jumps', 'from', 'to']), ['48', '50', '0', '0', '100']);
  const page = spec(PAGES[420]);
  let s = opening(page);
  assert.deepEqual([s.middle, middleOf(page)], [false, 50]);
  s = toggleMiddle(s); assert.equal(s.middle, true);
  s = toggleMiddle(s); assert.equal(s.middle, false);
  assert.equal(opening(spec({ ...PAGES[420], middle: true })).middle, true);
  // From the middle, two jumps back find 48 and three on find 53, and 96 is four back from 100.
  const mid = place(s, 'point', 50);
  assert.deepEqual([link(page, presses(page, mid, -1, 2), 'jumps'), link(page, presses(page, mid, 1, 3), 'jumps')], [2, 3]);
  assert.deepEqual(findsOf(page), [48, 53, 96]);
  for (const n of findsOf(page)) assert.equal(labelled(page, n), false);
});

test('line: the street of page 610 labels its doors and asks for 46, 22 and 57', () => {
  assert.deepEqual(start(PAGES[610], ['find', 'from', 'to', 'point', 'jumps']), ['46', '1', '60', null, null]);
  const page = spec(PAGES[610]);
  assert.equal(gapsOf(page), 59);
  assert.deepEqual(Array.from({ length: 60 }, (_, i) => i + 1).filter(n => labelled(page, n)), [1, 20, 50, 60]);
  let s = opening(page);
  assert.equal(counts(page, s).point, 1);
  for (let k = 0; k <= 59; k++) assert.equal(counts(page, place(s, 'point', k)).point, k + 1, 'the van stands at every house');
  const seen = [];
  for (let i = 0; i < 3; i++) { seen.push(link(page, s, 'find')); s = next(page, show(s)); }
  assert.deepEqual(seen, [46, 22, 57]);
});

test('line: fields of section 040 out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...PAGES[410], find: [3, 20] }, /find has 20, which carries a label/);
  fails({ ...PAGES[410], find: [21] }, /find has 21, write numbers on marks/);
  fails({ ...PAGES[420], find: [50] }, /find has 50, which carries a label/);
  fails({ ...PAGES[410], second: 4, flag: true }, /second belongs to pages without find/);
  fails({ to: 21, middle: true }, /its middle is no mark/);
  fails({ to: 20, labels: 10, middle: true }, /which labels already gives/);
  fails({ ...PAGES[610], labels: 10 }, /door numbers it shows, write them as a list/);
  fails({ ...PAGES[610], jump: true }, /jump belongs to the line look, the street look takes/);
  fails({ ...PAGES[610], middle: true }, /middle belongs to the line look/);
  fails({ look: 'stones', to: 10, find: 3 }, /find belongs to the line look/);
});

test('line: the unmarked lines of pages 510 and 520 label their ends, and the point stops anywhere between them', () => {
  assert.deepEqual(start(PAGES[510], ['find', 'from', 'to', 'point', 'middle']), ['8', '0', '10', null, null]);
  assert.deepEqual(start(PAGES[520], ['find', 'middle', 'from', 'to', 'point']), ['60', '50', '0', '100', null]);
  for (const id of [510, 520]) {
    const page = spec(PAGES[id]), s = opening(page);
    assert.deepEqual([page.marks, page.labels, readoutsOf(page).includes('point')], ['ends', 'ends', false]);
    // A drag lets the point go at any place. Show reveals the flag of the number, and the point carries no number.
    assert.equal(numbered(page), false);
    // A screen reader hears where the point stands: on a number, or between two.
    assert.deepEqual([0, 0.3, 7.6, 4, gapsOf(page)].map(k => standing(page, place(s, 'point', k))), [{ on: 0 }, { between: [0, 1] }, { between: [7, 8] }, { on: 4 }, { on: gapsOf(page) }]);
    for (const k of [0, 0.3, 2.5, 4.49, gapsOf(page) / 2, gapsOf(page) - 0.01, gapsOf(page)]) {
      const t = show(place(s, 'point', k));
      assert.deepEqual([counts(page, t).point, t.shown], [k, true]);
    }
  }
  const page = spec(PAGES[510]);
  let s = opening(page);
  const seen = [];
  for (let i = 0; i < 3; i++) { seen.push(link(page, s, 'find')); s = next(page, show(s)); }
  assert.deepEqual(seen, [8, 2, 4]);
});

test('line: the estimate of page 530 steps from 10 to 20, Show reveals its mark and 16, and a step takes both away', () => {
  assert.deepEqual(start(PAGES[530], ['estimate', 'middle', 'from', 'to', 'point']), ['15', '15', '10', '20', null]);
  const page = spec(PAGES[530]);
  assert.deepEqual([page.estimate, page.estimateCtl, numbered(page)], [15, { kind: 'stepper', lo: 10, hi: 20 }, true]);
  let s = show(opening(page));
  assert.deepEqual([s.shown, counts(page, s).point], [true, 16]);
  for (let n = 10; n <= 20; n++) {
    s = estimate(s, n);
    assert.deepEqual([link(page, s, 'estimate'), markOf(page, n), s.shown, counts(page, s).point], [n, n - 10, false, 16]);
  }
  assert.equal(line.start({ ...page, estimate: 20 }, 'en', 'estimate'), '20');
});

test('line: the book of page 620 is an unmarked line from 0 to 100 with Show named for the book', () => {
  assert.deepEqual(start(PAGES[620], ['find', 'from', 'to', 'point']), ['75', '0', '100', null]);
  const page = spec(PAGES[620]);
  assert.deepEqual([page.marks, page.labels], ['ends', 'ends']);
  let s = opening(page);
  const seen = [];
  for (let i = 0; i < 3; i++) { seen.push(link(page, s, 'find')); s = next(page, show(s)); }
  assert.deepEqual(seen, [75, 25, 90]);
  assert.equal(string('en', 'line_open-book'), 'Open the book');
  assert.deepEqual([numbered(page), numbered(spec(PAGES[410])), numbered(spec(PAGES[610]))], [false, true, true]);
});

test('line: page 810 reads the point and the tens round it, at every mark from 0 to 100', () => {
  assert.deepEqual(start(PAGES[810], ['point', 'ten-before', 'ten-after', 'from', 'to', 'step']), ['64', '60', '70', '0', '100', '1']);
  const page = spec(PAGES[810]), s = opening(page);
  for (let n = 0; n <= 100; n++) {
    const c = counts(page, place(s, 'point', n));
    assert.deepEqual([c.point, c['ten-before'], c['ten-after']], n % 10 ? [n, n - n % 10, n - n % 10 + 10] : [n, null, null]);
  }
});

test('line: the goal place-unmarked draws lines 40, 60, 80 or 100 long, each length evenly, and holds within a tenth', () => {
  const r = read(PAGES[730]);
  assert.deepEqual(r.problems, []);
  const c = PAGES[730].challenge, goal = GOALS['place-unmarked'], lines = new Set(), lens = { 40: 0, 60: 0, 80: 0, 100: 0 }, N = 6000;
  for (let seed = 1; seed <= N; seed++) {
    const t = goal.draw(c, r.data, dice(seed)), len = t.to - t.from, mid = (t.from + t.to) / 2;
    lines.add(`${t.from}-${t.to}`); lens[len]++;
    assert.ok(t.from % 10 === 0 && t.to % 10 === 0 && t.from >= 0 && t.from <= 30 && t.to >= 40 && t.to <= 100 && [40, 60, 80, 100].includes(len) && mid % 10 === 0, JSON.stringify(t));
    // The target is more than a tenth of the line from each end and from the middle.
    assert.ok(Number.isInteger(t.target) && t.target - t.from > len / 10 && t.to - t.target > len / 10 && Math.abs(t.target - mid) > len / 10, JSON.stringify(t));
    const { step, ...drawnLine } = goal.page(t), page = spec({ ...drawnLine, middle: 'button' }), s0 = opening(page), at = n => place(s0, 'point', n - t.from), state = (s, checked) => ({ checked, point: counts(page, s).point });
    assert.deepEqual([page.marks, page.from, page.to, middleOf(page), s0.at, numbered(page)], ['ends', t.from, t.to, mid, 0, false]);
    assert.deepEqual(goal.holds(challengeStart(page, t), page, c, t), { done: false });
    assert.equal(goal.reach(page, c, t), null);
    // Check at the start or at the middle does not hold, and the free drag holds within a tenth of the line.
    for (const n of [t.from, mid]) assert.equal(goal.holds(state(at(n), true), page, c, t).done, false, `Check at ${n}`);
    const tol = len / 10;
    for (const d of [0, tol, -tol, tol * 0.5, tol - 0.01, -tol + 0.01]) assert.deepEqual(goal.holds(state(at(t.target + d), true), page, c, t), { done: true }, `${d} from ${t.target}`);
    assert.deepEqual(goal.holds(state(at(t.target - tol - 0.01), true), page, c, t), { done: false, note: 'left' });
    assert.deepEqual(goal.holds(state(at(t.target + tol + 0.01), true), page, c, t), { done: false, note: 'right' });
    assert.deepEqual(goal.holds(state(at(t.target), false), page, c, t), { done: false });
  }
  // Each length comes about a quarter of the time, and every line of the ranges is drawn: 4 of 40, 4 of 60, 3 of 80, 1 of 100.
  for (const len of [40, 60, 80, 100]) assert.ok(Math.abs(lens[len] / N - 1 / 4) < 0.03, `length ${len} comes ${lens[len]} times in ${N}`);
  assert.equal(lines.size, 4 + 4 + 3 + 1);
  assert.equal(string('en', 'line_goal-place-unmarked', { target: '45' }), 'Put the point close to 45, then press Check.');
});

test('line: fields of section 050 out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...PAGES[510], labels: 5 }, /labels of an unmarked line are its ends/);
  fails({ ...PAGES[510], jump: true }, /jump takes a marked line, and marks is ends/);
  fails({ to: 20, estimate: { stepper: [0, 20], start: 0 } }, /estimate takes an unmarked line/);
  fails({ ...PAGES[530], estimate: { stepper: [10, 20], start: 25 } }, /starts at 25/);
  fails({ ...PAGES[530], estimate: { stepper: [0, 20] } }, /write a range inside the line from 10 to 20/);
  fails({ ...PAGES[530], find: 12 }, /find belongs to pages without an estimate/);
  fails({ ...PAGES[620], middle: 'button' }, /middle belongs to the line look, the book look takes/);
  fails({ ...PAGES[620], find: [100] }, /find has 100, which carries a label/);
  fails({ ...PAGES[730], middle: true }, /write middle: button/);
  fails({ ...PAGES[730], to: 100 }, /to is drawn by challenge.goal place-unmarked/);
  fails({ challenge: { goal: 'place-unmarked', from: [0, 30], to: [40, 120] } }, /from 0 to 100/);
  fails({ challenge: { goal: 'place-unmarked', from: [30, 30], to: [40, 60] } }, /draws no line, as from \[30,30\] and to \[40,60\] give no two tens 40, 60, 80 or 100 apart/);
});

test('line: page 150 opens with 4 and 7 off their places, and gaps reads that some gaps are longer', () => {
  assert.deepEqual(start(PAGES[150], ['gaps', 'point', 'jumps']), ['Some gaps are longer than others.', '0', '0']);
  assert.equal(line.start(spec(PAGES[150]), 'tr', 'gaps'), 'Bazı aralıklar ötekilerden uzun.');
  const page = spec(PAGES[150]), s = opening(page);
  assert.deepEqual(s.offs, { 4: 0.4, 7: -0.4 });
  assert.deepEqual([posOf(s, 4), posOf(s, 7), posOf(s, 5)], [4.4, 6.6, 5]);
  assert.deepEqual(readoutsOf(page), ['point', 'jumps', 'step', 'from', 'to'], 'gaps is a link and no readout');
  assert.deepEqual([sides(s, 4), sides(s, 7), sides(s, 5), sides(s, 3)], ['mark-left', 'mark-right', 'mark-right', 'mark-right']);
});

test('line: a dragged mark stops a fifth of a gap from each neighbour, and the ends do not move', () => {
  const page = spec(PAGES[150]), s = opening(page);
  // Mark 4 between 3 and 5, and mark 7 between 6 and 8, at their furthest places either way.
  assert.equal(posOf(slide(page, s, 4, -100), 4), 3.2);
  assert.equal(posOf(slide(page, s, 4, 100), 4), 4.8);
  assert.ok(Math.abs(posOf(slide(page, s, 7, -100), 7) - 6.2) < 1e-9);
  assert.ok(Math.abs(posOf(slide(page, s, 7, 100), 7) - 7.8) < 1e-9);
  // A neighbour that is off its place moves the limit with it: mark 5 stops a fifth from 4 where 4 stands.
  assert.ok(Math.abs(posOf(slide(page, s, 5, 0), 5) - 4.6) < 1e-9);
  assert.equal(posOf(slide(page, s, 8, 0), 8), 6.8);
  for (const k of [0, 10]) assert.equal(slide(page, s, k, 3), s, `the end ${k} stays`);
  // Every mark between the ends takes a drag across its whole room.
  for (let k = 1; k < 10; k++) {
    const lo = posOf(slide(page, s, k, -100), k), hi = posOf(slide(page, s, k, 100), k);
    assert.ok(Math.abs(lo - (posOf(s, k - 1) + 0.2)) < 1e-9 && Math.abs(hi - (posOf(s, k + 1) - 0.2)) < 1e-9, `mark ${k}`);
  }
});

test('line: gaps reads equal once every mark is within a tenth of its place, the marks settle, and a drag brings it back', () => {
  const page = spec(PAGES[150]), words = s => string('en', `line_${gapsKey(s)}`);
  let s = opening(page);
  // Mark 4 across its drag: the words stay while 7 is off, at every tenth of a gap.
  for (let x = 3.2; x <= 4.8 + 1e-9; x += 0.1) assert.equal(words(slide(page, s, 4, x)), 'Some gaps are longer than others.');
  s = slide(page, s, 7, 7);
  assert.deepEqual([even(s), words(s)], [false, 'Some gaps are longer than others.']);
  for (const x of [4.15, 4.12, 3.88, 3.85]) assert.equal(words(slide(page, s, 4, x)), 'Some gaps are longer than others.', `4 at ${x}`);
  for (const x of [4.1, 4.05, 4, 3.95, 3.9]) {
    const t = slide(page, s, 4, x);
    assert.deepEqual([words(t), settle(t).offs], ['All the gaps are the same length.', {}], `4 at ${x}`);
  }
  // The keys move a tenth of a gap: three steps left bring 4 from 4.4 to 4.1, where the marks settle.
  let k = slide(page, opening(page), 7, 7);
  for (let i = 0; i < 3; i++) k = settle(slide(page, k, 4, posOf(k, 4) - 0.1));
  assert.deepEqual([k.offs, words(k), sides(k, 4)], [{}, 'All the gaps are the same length.', 'mark-even']);
  // A drag that takes a mark out of place again brings the first words back.
  k = slide(page, k, 6, 6.3);
  assert.deepEqual([words(k), sides(k, 6)], ['Some gaps are longer than others.', 'mark-left']);
});

test('line: the point and the jumps follow the marks where they stand', () => {
  const page = spec(PAGES[150]);
  let s = presses(page, opening(page), 1, 10);
  assert.deepEqual([link(page, s, 'point'), link(page, s, 'jumps'), arcsOf(s).length], [10, 10, 10]);
  // The point sits on mark 4 and keeps its number as the mark slides.
  s = slide(page, place(s, 'point', 4), 4, 3.6);
  assert.deepEqual([link(page, s, 'point'), posOf(s, s.at)], [4, 3.6]);
});

test('line: fields of page 150 out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...PAGES[150], to: 13 }, /to from 4 to 12/);
  fails({ ...PAGES[150], moved: [{ mark: 4, by: 0.5 }] }, /labels of 4 and 5 about 8px apart on a 390px phone.*at most 0.44 in size/);
  fails({ ...PAGES[150], to: 12, moved: [{ mark: 10, by: 0.3 }] }, /labels of 10 and 11 about \d+px apart/);
  fails({ ...PAGES[150], to: 12, moved: [{ mark: 9, by: 0.6 }] }, /labels of 9 and 10 about \d+px apart on a 390px phone, where they would read as one number, no by from 0.3 to 0.6 leaves them 10px apart, move another mark or shorten the line/);
  fails({ ...PAGES[150], step: 2 }, /in steps of 1/);
  fails({ ...PAGES[150], labels: 2 }, /every mark labelled/);
  fails({ ...PAGES[150], moved: [{ mark: 0, by: 0.5 }] }, /write a mark between the ends 0 and 10/);
  fails({ ...PAGES[150], moved: [{ mark: 4, by: 0.1 }] }, /from 0.3 to 0.6 in size/);
  fails({ ...PAGES[150], moved: [{ mark: 4, by: 0.7 }] }, /from 0.3 to 0.6 in size/);
  fails({ ...PAGES[150], moved: [{ mark: 4, by: 0.5 }, { mark: 5, by: 0.4 }] }, /no two next to each other/);
  fails({ ...PAGES[150], second: 3, flag: true }, /second belongs to pages without moved/);
  fails({ ...PAGES[150], reading: true }, /reading belongs to pages without moved/);
  fails({ ...PAGES[150], readout: ['gaps'] }, /readout names "gaps"/);
  assert.deepEqual(offsetsOf(spec({ to: 10 })), {});
});

test('line: on a 390px phone a dragged mark stops with its label 10px from its neighbour\'s', () => {
  const page = spec(PAGES[150]), s = opening(page), keep = labelKeep(page, PHONE), gap = gapOn(PHONE, 10, false);
  const font = labelRows(DIGIT * 2, gap, { base: 14 }).font, width = n => DIGIT * font * String(n).length;
  // The edge to edge room between the labels of a and b, in pixels, with the marks where they stand.
  const apart = (t, a, b) => (posOf(t, b) - posOf(t, a)) * gap - (width(a) + width(b)) / 2;
  // Mark 4 pushed hard against 5, and 9 against 10, stop with their labels LABELS_APART pixels apart.
  const four = slide(page, s, 4, 100, keep), nine = slide(page, s, 9, 100, keep);
  assert.ok(Math.abs(apart(four, 4, 5) - LABELS_APART) < 1e-9, `4 and 5 stand ${apart(four, 4, 5)}px apart`);
  assert.ok(Math.abs(apart(nine, 9, 10) - LABELS_APART) < 1e-9, `9 and 10 stand ${apart(nine, 9, 10)}px apart`);
  // Every mark pushed either way keeps its label at least that far from both neighbours.
  for (let k = 1; k < 10; k++) for (const to of [-100, 100]) {
    const t = slide(page, s, k, to, keep);
    assert.ok(apart(t, k - 1, k) >= LABELS_APART - 1e-9 && apart(t, k, k + 1) >= LABELS_APART - 1e-9, `mark ${k} to ${to}`);
  }
  // The page opens with every label that far apart, and a wide stage keeps at least a fifth of a gap.
  for (let k = 0; k < 10; k++) assert.ok(apart(s, k, k + 1) >= LABELS_APART, `${k} and ${k + 1} as the page opens`);
  assert.ok(labelKeep(page, 1000)(4, 5) >= 0.2);
});

// The pages of adding-within-20 that draw the line.
const ADD = {
  310: { to: 20, point: 14, jump: true, readout: ['point', 'jumps'] },
  320: { to: 20, start: 9, jump: true, written: true, readout: ['jumps'] },
  330: { to: 20, start: 9, point: 12, jump: true, written: true, readout: ['start', 'jumps'] },
  720: { to: 20, jump: true, written: true, challenge: { goal: 'jump-to', start: [2, 18], add: [2, 4], subtract: [1, 3] } },
  430: { from: 0, to: 20, jump: true, start: 8, second: 13, flag: true, written: 'difference', readout: ['jumps'] },
};
const writes = (page, s) => kitWords(writtenOf(page, s), String);

test('line: pages 310, 320 and 330 of adding-within-20 link what they show as they open', () => {
  assert.deepEqual(start(ADD[310], ['point', 'jumps', 'start', 'written']), ['14', '0', null, null]);
  assert.deepEqual(start(ADD[320], ['start', 'point', 'jumps', 'written', 'reading']), ['9', '9', '0', '9 + 0 = 9', '9 plus 0 is equal to 9']);
  assert.deepEqual(start(ADD[330], ['start', 'point', 'jumps', 'written', 'reading']), ['9', '12', '3', '9 + 3 = 12', '9 plus 3 is equal to 12']);
  assert.equal(line.start(spec(ADD[330]), 'tr', 'reading'), '9 artı 3 eşittir 12');
  assert.deepEqual(readoutsOf(spec(ADD[330])), ['point', 'start', 'written', 'reading', 'jumps', 'step', 'from', 'to']);
  const s = opening(spec(ADD[330]));
  assert.deepEqual([s.base, s.at, arcsOf(s).length], [9, 12, 3]);
});

test('line: the written line of 320 follows the jumps from the start, at every mark from 0 to 20', () => {
  const page = spec(ADD[320]), s0 = opening(page);
  for (let n = 0; n <= 20; n++) {
    const s = n >= 9 ? presses(page, s0, 1, n - 9) : presses(page, s0, -1, 9 - n), w = writtenOf(page, s);
    assert.deepEqual([counts(page, s).point, counts(page, s).jumps], [n, Math.abs(n - 9)]);
    assert.equal(writes(page, s), n >= 9 ? `9 + ${n - 9} = ${n}` : `9 − ${9 - n} = ${n}`);
    assert.deepEqual(w.ids, { a: 'start', b: 'jumps', c: 'point' });
  }
  // Jump left takes the last arc to the right back, and Jump right takes back the last to the left.
  const back = jump(page, presses(page, s0, 1, 3), -1);
  assert.deepEqual([writes(page, back), arcsOf(back).length], ['9 + 2 = 11', 2]);
});

test('line: a drag of the start of 330 carries the point and its jumps, and stops where the point would leave the line', () => {
  const page = spec(ADD[330]);
  let s = opening(page);
  for (let k = 0; k <= 20; k++) {
    const t = moveStart(page, s, k), want = Math.min(k, 17);
    assert.deepEqual([counts(page, t).start, counts(page, t).point, counts(page, t).jumps], [want, want + 3, 3], `start to ${k}`);
    assert.equal(writes(page, t), `${want} + 3 = ${want + 3}`);
  }
  s = presses(page, moveStart(page, s, 9), -1, 6);
  assert.deepEqual([counts(page, s).point, writes(page, s)], [6, '9 − 3 = 6']);
  for (const k of [0, 2, 3, 10, 20]) assert.equal(counts(page, moveStart(page, s, k)).start, Math.max(k, 3), `the start of three jumps left stops at 3, asked for ${k}`);
});

test('line: written: difference of 430 writes 13 − 8 and adds 5 once the point reaches the second point', () => {
  assert.deepEqual(start(ADD[430], ['start', 'point', 'second', 'jumps', 'written', 'reading']), ['8', '8', '13', '0', '13 − 8', '13 minus 8']);
  const page = spec(ADD[430]), s0 = opening(page);
  for (let k = 0; k <= 12; k++) {
    const s = presses(page, s0, 1, k);
    assert.equal(writes(page, s), k === 5 ? '13 − 8 = 5' : '13 − 8', `${k} jumps`);
    assert.deepEqual(writtenOf(page, s).ids, { a: 'second', b: 'start', c: 'jumps' });
  }
  let s = place(presses(page, s0, 1, 5), 'second', 15);
  assert.equal(writes(page, s), '15 − 8');
  s = presses(page, s, 1, 2);
  assert.deepEqual([writes(page, s), counts(page, s).jumps], ['15 − 8 = 7', 7]);
});

test('line: the goal jump-to draws starts from 2 to 18 with 2 to 4 to add or 1 to 3 to subtract, and the jumps reach each one', () => {
  const r = read(ADD[720]);
  assert.deepEqual(r.problems, []);
  const page = r.data, c = page.challenge, goal = GOALS['jump-to'], seen = new Set(), signs = { '+': 0, '−': 0 };
  for (let seed = 1; seed <= 3000; seed++) {
    const t = goal.draw(c, page, dice(seed));
    seen.add(`${t.start}${t.sign}${t.n}`); signs[t.sign]++;
    assert.ok(t.start >= 2 && t.start <= 18 && t.target >= 0 && t.target <= 20);
    assert.ok(t.sign === '+' ? t.n >= 2 && t.n <= 4 && t.target === t.start + t.n : t.n >= 1 && t.n <= 3 && t.target === t.start - t.n);
    const s0 = opening({ ...page, ...goal.page(t) }), dir = t.sign === '+' ? 1 : -1;
    const state = (s, checked) => ({ checked, point: counts(page, s).point });
    assert.deepEqual(goal.holds(challengeStart(page, t), page, c, t), { done: false });
    const there = presses(page, s0, dir, t.n);
    assert.deepEqual([goal.holds(state(there, true), page, c, t), goal.holds(state(there, false), page, c, t)], [{ done: true }, { done: false }]);
    assert.deepEqual(goal.holds(state(s0, true), page, c, t), { done: false, note: 'few' }, 'on the start is too few');
    if (t.n > 1) assert.deepEqual(goal.holds(state(presses(page, s0, dir, t.n - 1), true), page, c, t), { done: false, note: 'few' });
    const past = jump(page, there, dir);
    if (past) assert.deepEqual(goal.holds(state(past, true), page, c, t), { done: false, note: 'many' });
    const wrong = jump(page, s0, -dir);
    if (wrong) assert.deepEqual(goal.holds(state(wrong, true), page, c, t), { done: false, note: 'way' });
    assert.equal(jump(page, there, dir)?.checked ?? false, false, 'a jump after Check takes the check back');
  }
  // Every start and number with the answer on the line: 17 + 4, 18 + 3, 18 + 4 and 2 − 3 leave it.
  assert.equal(seen.size, 17 * 3 - 3 + 17 * 3 - 1);
  assert.ok(signs['+'] > 1300 && signs['−'] > 1300, JSON.stringify(signs));
  assert.deepEqual(goal.page({ start: 7, sign: '+', n: 4, target: 11 }), { start: 7, point: 7 });
});

test('line: fields of start, written and jump-to out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ to: 20, start: 9 }, /start is the start of the jumps, write jump: true/);
  fails({ to: 20, start: 21, jump: true }, /start is 21, write a number on a mark/);
  fails({ to: 20, start: 9, jump: true, marks: 'ends' }, /start takes a marked line/);
  fails({ to: 20, written: true }, /written writes the jumps, write jump: true/);
  fails({ to: 20, jump: true, written: 'difference' }, /write second as well/);
  fails({ to: 20, jump: true, second: 4, flag: true, written: true, reading: true }, /leave the field reading out/);
  fails({ ...ADD[720], start: 4 }, /start is drawn by challenge.goal jump-to/);
  fails({ ...ADD[720], challenge: { goal: 'jump-to', start: [2, 18] } }, /add and subtract are missing/);
  fails({ ...ADD[720], challenge: { goal: 'jump-to', start: [2, 30], add: [2, 4] } }, /inside the line from 0 to 20/);
  fails({ ...ADD[720], challenge: { goal: 'jump-to', start: [2, 18], add: [0, 4] } }, /from 1/);
  fails({ ...ADD[720], challenge: { goal: 'jump-to', start: [19, 20], add: [2, 4] } }, /draws nothing/);
  fails({ ...ADD[720], readout: ['written'] }, /a challenge page shows no readouts/);
  assert.deepEqual(read(ADD[720]).problems, [], 'jump-to takes labels: all');
});

test('line: the second point of 430 walks from 9 to 20, with the point on the start and on the second point', () => {
  const page = spec(ADD[430]), s0 = opening(page), say = (s, lang = 'en') => kitReading(writtenOf(page, s), String, (key, vars) => string(lang, `hesap_${key}`, vars));
  for (let k = 9; k <= 20; k++) {
    const ids = { a: 'second', b: 'start', c: 'jumps' };
    // The point on the start: the line waits for its answer.
    const onStart = place(s0, 'second', k);
    assert.deepEqual(start({ ...ADD[430], second: k }, ['second', 'written', 'reading']), [String(k), `${k} − 8`, `${k} minus 8`], `second on ${k}, point on the start`);
    assert.deepEqual([writtenOf(page, onStart).ids, counts(page, onStart).second], [ids, k]);
    // The point jumped onto the second point: the line has its answer, the number of jumps.
    const onSecond = presses(page, onStart, 1, k - 8);
    assert.deepEqual([counts(page, onSecond).point, counts(page, onSecond).jumps], [k, k - 8]);
    assert.deepEqual([writes(page, onSecond), say(onSecond), say(onSecond, 'tr'), writtenOf(page, onSecond).ids], [`${k} − 8 = ${k - 8}`, `${k} minus 8 is equal to ${k - 8}`, `${k} eksi 8 eşittir ${k - 8}`, ids], `second and point on ${k}`);
  }
});

test('line: on 430 the second point stops one mark right of the start, and the start one mark left of the second point', () => {
  const page = spec(ADD[430]), s0 = opening(page);
  // A drag or a key of the second point to the start or left of it stops on 9.
  for (let k = 0; k <= 20; k++) assert.equal(secondTo(page, s0, k), Math.max(k, 9), `second to ${k}`);
  // A drag of the start stops on 12, left of the second point on 13, with the point and its jumps carried along.
  for (let k = 0; k <= 20; k++) assert.equal(counts(page, moveStart(page, s0, k)).start, Math.min(k, 12), `start to ${k}`);
  const two = presses(page, s0, 1, 2);
  assert.deepEqual([counts(page, moveStart(page, two, 20)).start, counts(page, moveStart(page, two, 20)).point], [12, 14]);
  // A page without written: difference keeps the old reach: the second point goes anywhere and the start to the end.
  const other = spec({ ...ADD[430], written: true });
  assert.deepEqual([secondTo(other, s0, 2), counts(other, moveStart(other, s0, 20)).start], [2, 20]);
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...ADD[430], second: 8 }, /second is 8, at or left of the start 8, and the page counts on from the start, write a second point greater than the start, such as 13/);
  fails({ ...ADD[430], second: 3 }, /second is 3, at or left of the start 8/);
});

test('line: page 330 draws a line of cards: steps of 2, 5 and 10 to the limits of their left ends, one card that fits no mark', () => {
  const r = read({ draw: true, readout: ['placed'] });
  assert.deepEqual(r.problems, []);
  assert.deepEqual([line.start(r.data, 'en', 'placed'), ...['from', 'to', 'step', 'point'].map(r.has)], ['0', false, false, false, false]);
  const ends = { 2: new Set(), 5: new Set(), 10: new Set() }, labelsAt = new Set(), odd = { after: 0, before: 0 };
  let last = null;
  for (let seed = 1; seed <= 3000; seed++) {
    const d = drawLine(dice(seed), last), page = spec({ to: d.to, from: d.from, step: d.step, labels: d.labels, blank: d.blank, cards: d.cards, point: false });
    ends[d.step].add(d.from);
    assert.ok(d.from % d.step === 0 && d.from >= d.step && d.to === d.from + 6 * d.step && d.to <= 100, JSON.stringify(d));
    // The two labels stand on marks next to each other, from the second mark to the fifth, so a blank lies on each side.
    const k = (d.labels[0] - d.from) / d.step;
    labelsAt.add(k);
    assert.ok(k >= 1 && k <= 4 && d.labels[1] - d.labels[0] === d.step);
    assert.deepEqual([...d.blank, ...d.labels].sort((a, b) => a - b), Array.from({ length: 7 }, (_, j) => d.from + j * d.step));
    // The cards: the five blanks and one number that fits no mark, never from least to greatest.
    assert.equal(d.cards.length, 6);
    const extra = d.cards.filter(n => !d.blank.includes(n));
    assert.deepEqual(extra, [d.odd]);
    assert.ok(!isMark(page, d.odd), `${d.odd} fits no mark`);
    if (d.odd === d.labels[1] + 1) odd.after++; else { assert.equal(d.odd, d.labels[0] - 1); odd.before++; }
    assert.ok(d.cards.some((n, i) => i && n < d.cards[i - 1]), `the cards ${d.cards} stand in order`);
    // The card that fits no mark goes back from every box, and placed opens at 0.
    const s = opening(page);
    assert.equal(counts(page, s).placed, 0);
    for (const m of d.blank) assert.equal(lay(page, s, d.odd, m), s);
    assert.ok(last === null || last.from !== d.from || last.step !== d.step || last.labels[0] !== d.labels[0], 'New line draws another line');
    last = d;
  }
  // Each step reaches both limits of its left end, and every place of the two labels is drawn.
  const lim = { 2: [2, 88], 5: [5, 70], 10: [10, 40] };
  for (const step of [2, 5, 10]) assert.deepEqual([Math.min(...ends[step]), Math.max(...ends[step])], lim[step], `step ${step}`);
  assert.deepEqual([...labelsAt].sort(), [1, 2, 3, 4]);
  assert.ok(odd.after > 1000 && odd.before > 1000, JSON.stringify(odd));
});

test('line: a draw lays every card back, so placed reads 0 again', () => {
  const d = drawLine(dice(7)), page = spec({ to: d.to, from: d.from, step: d.step, labels: d.labels, blank: d.blank, cards: d.cards, point: false });
  let s = opening(page);
  for (const m of d.blank) s = lay(page, s, m, m);
  assert.equal(counts(page, s).placed, 5);
  const e = drawLine(dice(8), d), next = spec({ to: e.to, from: e.from, step: e.step, labels: e.labels, blank: e.blank, cards: e.cards, point: false });
  assert.equal(counts(next, opening(next)).placed, 0);
});

test('line: a page with draw leaves out the fields of the line', () => {
  const fails = (fields, words) => assert.match(read({ draw: true, ...fields }).problems.join('\n'), words);
  for (const f of ['from', 'to', 'step', 'point', 'jump', 'bracket', 'middle', 'find']) fails({ [f]: f === 'jump' ? true : f === 'point' ? 3 : f === 'bracket' ? 10 : f === 'middle' ? true : 10 }, new RegExp(`${f} is drawn with the line on a page with draw`));
  fails({ labels: [3, 4] }, /labels is drawn with the line/);
  fails({ readout: ['to'] }, /readout names "to", this page reads out placed/);
  fails({ look: 'street' }, /a page with draw shows the line look/);
});

test('line: the goal place-two-labels draws each step of 720 about a third of the time, and still reaches all 38 lines', () => {
  const c = { goal: 'place-two-labels', step: [2, 5, 10], from: [0, 50] }, goal = GOALS['place-two-labels'], counts = { 2: 0, 5: 0, 10: 0 }, lines = new Set(), N = 6000;
  for (let seed = 1; seed <= N; seed++) { const t = goal.draw(c, {}, dice(seed)); counts[t.step]++; lines.add(`${t.step}:${t.from}`); }
  for (const step of [2, 5, 10]) assert.ok(Math.abs(counts[step] / N - 1 / 3) < 0.03, `step ${step} comes ${counts[step]} times in ${N}`);
  assert.equal(lines.size, 26 + 11 + 1);
  // A page whose ranges give one step draws that step alone.
  assert.ok([1, 2, 3, 4, 5].every(seed => goal.draw({ ...c, step: [5] }, {}, dice(seed)).step === 5));
});

test('line: place-unmarked fails ranges that give no line of an even length', () => {
  const fails = (c, words) => assert.match(read({ middle: 'button', challenge: { goal: 'place-unmarked', ...c } }).problems.join('\n'), words);
  fails({ from: [10, 10], to: [40, 40] }, /draws no line, as from \[10,10\] and to \[40,40\] give no two tens 40, 60, 80 or 100 apart/);
  fails({ from: [30, 30], to: [60, 60] }, /draws no line/);
  assert.deepEqual(read({ middle: 'button', challenge: { goal: 'place-unmarked', from: [30, 30], to: [70, 70] } }).problems, []);
});

test('line: each hint and note reads with the numbers of its case', () => {
  const say = ({ key, vars }, calc) => string('en', `line_${key}`, { ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])), calc });
  const place = spec(PAGES[710]), g = GOALS;
  assert.equal(say(g.place.hint({ target: 64 }, place)), '64 is between the long marks for 60 and 70. Start at 60 and count on one mark at a time until you get to 64.');
  assert.equal(say(g.place.hint({ target: 67 }, place)), '67 is between the long marks for 60 and 70. Start at 70 and count back one mark at a time until you get to 67.');
  assert.equal(say(g.place.note({ target: 64 }, 'left')), 'The point is to the left of 64. Move it to the right.');
  assert.equal(say(g.place.note({ target: 64 }, 'right')), 'The point is to the right of 64. Move it to the left.');
  const two = { labels: [30, 35], target: 50 };
  assert.equal(say(g['place-two-labels'].hint(two)), 'The labels 30 and 35 are on marks next to each other, so the step from one mark to the next is 35 − 30. Count on from 35 in steps of that size until you get to 50.');
  assert.equal(say(g['place-two-labels'].hint({ ...two, target: 15 })), 'The labels 30 and 35 are on marks next to each other, so the step from one mark to the next is 35 − 30. Count back from 30 in steps of that size until you get to 15.');
  assert.equal(say(g['place-unmarked'].hint({ from: 30, to: 90, target: 44 })), 'Press Middle to mark 60. 44 is between 30 and 60, and closer to 30. Put the point there.');
  assert.equal(say(g['place-unmarked'].hint({ from: 0, to: 100, target: 85 })), 'Press Middle to mark 50. 85 is between 50 and 100, and closer to 100. Put the point there.');
  const plus = { start: 7, sign: '+', n: 4, target: 11 }, minus = { start: 12, sign: '−', n: 3, target: 9 }, j = g['jump-to'];
  assert.equal(say(j.hint(plus)), 'Start at 7 and press Jump right 4 times. At each jump, say the next number. The first two are 8 and 9.');
  assert.equal(say(j.hint(minus)), 'Start at 12 and press Jump left 3 times. At each jump, say the number before. The first two are 11 and 10.');
  assert.equal(say(j.hint({ start: 12, sign: '−', n: 1, target: 11 })), 'Start at 12. Press Jump left once and say the number before, 11.');
  assert.equal(say(j.note(plus, 'way', { point: 5 }), '7 + 4'), '7 + 4 is an addition, so the jumps go to the right from 7.');
  assert.equal(say(j.note(minus, 'way', { point: 14 }), '12 − 3'), '12 − 3 is a subtraction, so the jumps go to the left from 12.');
  assert.equal(say(j.note(plus, 'few', { point: 7 }), '7 + 4'), 'The point is still on 7. Make the jumps for 7 + 4 from there.');
  assert.equal(say(j.note(plus, 'few', { point: 9 }), '7 + 4'), 'The point has made 2 of the 4 jumps that 7 + 4 needs. Keep jumping.');
  assert.equal(say(j.note(plus, 'many', { point: 13 }), '7 + 4'), 'The point has made 6 jumps, but 7 + 4 needs only 4. Jump back.');
  assert.deepEqual(['next', 'find', 'find-short'].map(k => string('en', `line_${k}`)), ['Next number', 'Number to find', 'Find']);
});

// The pages of the section undoing of fact-families: a jump of a size and the same jump back.
const UNDO = {
  320: { to: 20, start: 9, jump: 8, undo: true, written: true },
  330: { to: 20, start: 19, jump: { stepper: [1, 10], start: 8 }, undo: true, written: true, readout: ['start'] },
};
const IDS = ['start', 'point', 'size', 'written', 'reading', 'written-back', 'reading-back'];
const linkOf = (page, s, id, lang = 'en') => {
  const T = (key, vars) => string(lang, `hesap_${key}`, vars), say = (w, wording) => !w ? '–' : wording ? kitReading(w, String, T) : kitWords(w, String);
  if (id === 'written' || id === 'reading') return say(writtenOf(page, s), id === 'reading');
  if (id === 'written-back' || id === 'reading-back') return say(backOf(page, s), id === 'reading-back');
  return String(counts(page, s)[id]);
};

test('line: pages 320 and 330 of undoing link what they show as they open', () => {
  assert.deepEqual(start(UNDO[320], IDS), ['9', '9', '8', '–', '–', '–', '–']);
  assert.deepEqual(start(UNDO[330], IDS), ['19', '19', '8', '–', '–', '–', '–']);
  assert.deepEqual(start(UNDO[330], ['jumps']), [null], 'an undo page offers no count of jumps');
  assert.deepEqual(readoutsOf(spec(UNDO[330])), ['point', 'start', 'size', 'written', 'reading', 'step', 'from', 'to']);
  const { has } = read(UNDO[320]);
  assert.deepEqual(['size', 'written-back', 'reading-back', 'jumps'].map(has), [true, true, true, false]);
});

test('line: on 320 a jump of 8 and the jump back loop to 9 either way, and a press after the loop starts again', () => {
  const page = spec(UNDO[320]), s0 = opening(page);
  assert.ok(jump(page, s0, 1) && jump(page, s0, -1), 'from 9 both jumps of 8 fit');
  const right = jump(page, s0, 1), loop = jump(page, right, -1);
  assert.deepEqual(IDS.map(id => linkOf(page, right, id)), ['9', '17', '8', '9 + 8 = 17', '9 plus 8 is equal to 17', '–', '–']);
  assert.equal(jump(page, right, 1), null, 'the button of the first jump rests');
  assert.deepEqual(IDS.map(id => linkOf(page, loop, id)), ['9', '9', '8', '9 + 8 = 17', '9 plus 8 is equal to 17', '17 − 8 = 9', '17 minus 8 is equal to 9']);
  assert.deepEqual(arcsOf(loop), [{ from: 9, to: 17, dir: 1 }, { from: 17, to: 9, dir: -1 }]);
  assert.equal(linkOf(page, loop, 'reading-back', 'tr'), '17 eksi 8 eşittir 9');
  const left = jump(page, s0, -1), back = jump(page, left, 1);
  assert.deepEqual(['written', 'written-back', 'point'].map(id => linkOf(page, back, id)), ['9 − 8 = 1', '1 + 8 = 9', '9']);
  assert.equal(jump(page, left, -1), null);
  // A press after the jump back clears both and makes a new first jump in the direction pressed.
  const again = jump(page, loop, -1);
  assert.deepEqual([linkOf(page, again, 'written'), linkOf(page, again, 'written-back'), arcsOf(again).length], ['9 − 8 = 1', '–', 1]);
  assert.deepEqual(writtenOf(page, right).ids, { a: 'start', b: 'size' });
  assert.deepEqual(backOf(page, loop).ids, { b: 'size', c: 'start' });
});

test('line: on 330 every size from 1 to 10 from every start loops back, and a button rests where its jump leaves the line', () => {
  const page = spec(UNDO[330]), s0 = opening(page);
  assert.deepEqual([jump(page, s0, 1), jump(page, s0, -1)?.at], [null, 11], 'Jump right rests as the page opens');
  const first = jump(page, s0, -1), loop = jump(page, first, 1);
  assert.deepEqual(['written', 'written-back'].map(id => linkOf(page, loop, id)), ['19 − 8 = 11', '11 + 8 = 19']);
  for (let size = 1; size <= 10; size++) {
    for (let k = 0; k <= 20; k++) {
      const s = resize(moveStart(page, s0, k), size);
      assert.deepEqual([counts(page, s).start, counts(page, s).point, counts(page, s).size, linkOf(page, s, 'written')], [k, k, size, '–']);
      for (const dir of [1, -1]) {
        const one = jump(page, s, dir), end = k + dir * size;
        if (end < 0 || end > 20) { assert.equal(one, null, `a jump of ${size} from ${k} to ${end} rests`); continue; }
        const two = jump(page, one, -dir), sign = dir > 0 ? '+' : '−', other = dir > 0 ? '−' : '+';
        assert.deepEqual(IDS.map(id => linkOf(page, two, id)), [`${k}`, `${k}`, `${size}`, `${k} ${sign} ${size} = ${end}`, `${k} ${dir > 0 ? 'plus' : 'minus'} ${size} is equal to ${end}`, `${end} ${other} ${size} = ${k}`, `${end} ${dir > 0 ? 'minus' : 'plus'} ${size} is equal to ${k}`]);
        assert.equal(counts(page, one).point, end);
      }
    }
  }
});

test('line: on 330 a change of the size or a drag of the start clears both jumps and puts the point on the start', () => {
  const page = spec(UNDO[330]), loop = jump(page, jump(page, opening(page), -1), 1);
  for (const s of [resize(loop, 1), resize(loop, 10), moveStart(page, loop, 4), moveStart(page, loop, 20)]) {
    assert.deepEqual([arcsOf(s).length, s.at, s.base, linkOf(page, s, 'written'), linkOf(page, s, 'written-back')], [0, s.base, s.base, '–', '–']);
  }
  const half = jump(page, opening(page), -1), moved = moveStart(page, half, 4);
  assert.deepEqual([counts(page, moved).start, counts(page, moved).point, arcsOf(moved).length], [4, 4, 0]);
  assert.equal(counts(page, moveStart(page, half, 30)).start, 20);
});

test('line: jumps of a size without undo count the jumps, and a press against them takes the last back', () => {
  const page = spec({ to: 20, point: 0, jump: 4, readout: ['jumps', 'size'] });
  let s = presses(page, opening(page), 1, 5);
  assert.deepEqual([counts(page, s).point, counts(page, s).jumps, arcsOf(s).length, arcsOf(s)[4]], [20, 5, 5, { from: 16, to: 20, dir: 1 }]);
  assert.equal(jump(page, s, 1), null);
  s = jump(page, s, -1);
  assert.deepEqual([counts(page, s).point, counts(page, s).jumps], [16, 4]);
  const w = spec({ to: 20, start: 2, jump: 3, written: true });
  const t = presses(w, opening(w), 1, 2);
  assert.deepEqual([kitWords(writtenOf(w, t), String), writtenOf(w, t).ids], ['2 + 6 = 8', { a: 'start', b: null, c: 'point' }]);
  assert.deepEqual(start({ to: 20, point: 0, jump: true, readout: ['jumps'] }, ['size']), [null], 'jump: true links no size');
});

test('line: fields of a size and of undo out of place are told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ ...UNDO[320], jump: true }, /undo jumps a size and back, write jump as a size/);
  fails({ ...UNDO[320], start: undefined }, /undo jumps from the start and back to it, write start/);
  fails({ ...UNDO[320], written: undefined }, /undo writes the line of each jump, write written: true/);
  fails({ ...UNDO[320], point: 9 }, /point belongs to pages without undo/);
  fails({ ...UNDO[320], flag: true }, /flag belongs to pages without undo/);
  fails({ ...UNDO[320], readout: ['jumps'] }, /readout names "jumps"/);
  fails({ ...UNDO[320], readout: ['written-back'] }, /readout names "written-back"/);
  fails({ ...UNDO[320], jump: 21 }, /a size of 21, and the line has 20 gaps/);
  fails({ ...UNDO[320], to: 10, start: 5, jump: 6 }, /either way from the start 5 leaves the line/);
  fails({ ...UNDO[330], jump: { stepper: [0, 10], start: 7 } }, /jump.stepper is \[0, 10\]/);
  fails({ ...UNDO[330], jump: { stepper: [1, 10], start: 12 } }, /a start between them/);
  fails({ look: 'stones', to: 10, point: 0, jump: 2 }, /takes a marked line in the line look/);
  fails({ to: 100, labels: 10, jump: 3, challenge: { goal: 'place', target: [11, 99] } }, /a challenge jumps one gap at a time/);
  fails({ draw: true, undo: true }, /undo is drawn with the line/);
  assert.deepEqual(read(UNDO[330]).problems, []);
});

test('line: an undo page refuses a size over half the gaps, which a moved start could make rest both ways', () => {
  assert.match(read({ ...UNDO[330], jump: { stepper: [1, 11], start: 8 } }).problems.join('\n'), /write a size of 10 at most/);
  assert.match(read({ ...UNDO[320], jump: 11, start: 0 }).problems.join('\n'), /write a size of 10 at most/);
  assert.deepEqual(read({ to: 20, start: 0, jump: 11 }).problems, [], 'a page without undo keeps its size');
});
