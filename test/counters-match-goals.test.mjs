// Checks the three goals of the match scene: what each draws, when it holds and what a wrong check says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { MATCH_GOALS, matchStart, STEP } from '../src/families/counters/match-goals.js';
import { signOf } from '../src/families/counters/reading.js';
import { dice } from '../src/kit/random.js';

function read(challenge, more = {}) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  try { counters.read({ scene: 'match', challenge, ...more }, { at: 'page.yaml' }, ctx); } catch (err) { problems.push(err.message); }
  return problems.join('\n');
}
const draws = (name, c) => Array.from({ length: 400 }, (_, i) => MATCH_GOALS[name].draw(c, {}, dice(i + 1)));
const check = (name, c, t, state) => MATCH_GOALS[name].holds({ ...matchStart({}, t), checked: true, ...state }, {}, c, t);

test('same-rows: it draws two different rows inside the ranges, and holds on a check of equal rows', () => {
  const c = { goal: 'same-rows', top: [1, 10], bottom: [3, 10] }, all = draws('same-rows', c);
  assert.equal(read(c), '');
  for (const t of all) assert.ok(t.top !== t.bottom && t.top >= 1 && t.top <= 10 && t.bottom >= 3 && t.bottom <= 10 && ['top', 'bottom'].includes(t.wide));
  assert.deepEqual([...new Set(all.map(t => t.wide))].sort(), ['bottom', 'top']);
  const t = { top: 4, bottom: 7, wide: 'top' };
  assert.deepEqual(MATCH_GOALS['same-rows'].page(t), { top: 4, bottom: 7, wide: 'top', topCtl: { kind: 'stepper', lo: STEP[0], hi: STEP[1] } });
  assert.deepEqual(MATCH_GOALS['same-rows'].holds({ ...matchStart({}, t), top: 7 }, {}, c, t), { done: false });
  assert.deepEqual(check('same-rows', c, t, { top: 7 }), { done: true });
  assert.deepEqual(check('same-rows', c, t, {}), { done: false, note: 'bottom' });
  assert.deepEqual(check('same-rows', c, t, { top: 9 }), { done: false, note: 'top' });
});

test('one-less: it draws rows that are not one apart that way, and holds on a check of one counter fewer', () => {
  const c = { goal: 'one-less', top: [1, 10], bottom: [3, 10] };
  assert.equal(read(c), '');
  for (const t of draws('one-less', c)) assert.ok(t.top !== t.bottom - 1);
  assert.ok(draws('one-less', c).some(t => t.top === t.bottom), 'equal rows are drawn too');
  const t = { top: 7, bottom: 7, wide: 'bottom' };
  assert.deepEqual(check('one-less', c, t, { top: 6 }), { done: true });
  assert.deepEqual(check('one-less', c, t, {}), { done: false, note: 'over' });
  assert.deepEqual(check('one-less', c, t, { top: 8 }), { done: false, note: 'over' });
  assert.deepEqual(check('one-less', c, t, { top: 5 }), { done: false, note: 'short' });
  assert.equal(MATCH_GOALS['one-less'].ends, true);
});

test('right-sign: each sign is the true one in about a third of the draws, and the tile opens on a false sign', () => {
  const c = { goal: 'right-sign', rows: [4, 10], apart: [1, 3] }, all = draws('right-sign', c), share = {};
  assert.equal(read(c), '');
  for (const t of all) {
    const sign = signOf(t.top, t.bottom), far = Math.abs(t.top - t.bottom);
    share[sign] = (share[sign] ?? 0) + 1;
    assert.ok(t.top >= 4 && t.top <= 10 && t.bottom >= 4 && t.bottom <= 10 && (far === 0 || (far >= 1 && far <= 3)));
    assert.ok(t.opens !== sign && ['<', '=', '>'].includes(t.opens));
  }
  for (const sign of ['<', '=', '>']) assert.ok(share[sign] > 90 && share[sign] < 180, `${sign} is drawn ${share[sign]} times of 400`);
  const t = { top: 7, bottom: 9, wide: 'top', opens: '>' };
  assert.deepEqual(MATCH_GOALS['right-sign'].page(t), { top: 7, bottom: 9, wide: 'top', sign: '>', hidden: true });
  assert.deepEqual(MATCH_GOALS['right-sign'].holds(matchStart({}, t), {}, c, t), { done: false });
  assert.deepEqual(check('right-sign', c, t, { sign: '<' }), { done: true });
  assert.deepEqual(check('right-sign', c, t, { sign: '>' }), { done: false, note: 'fewer' });
  assert.deepEqual(check('right-sign', c, t, { sign: '=' }), { done: false, note: 'fewer' });
  assert.deepEqual(check('right-sign', c, { ...t, top: 9, bottom: 7 }, { top: 9, bottom: 7, sign: '<' }), { done: false, note: 'more' });
  assert.deepEqual(check('right-sign', c, { ...t, top: 8, bottom: 8 }, { top: 8, bottom: 8, sign: '<' }), { done: false, note: 'more' });
  assert.deepEqual(check('right-sign', c, { ...t, top: 8, bottom: 8 }, { top: 8, bottom: 8, sign: '>' }), { done: false, note: 'fewer' });
});

test('match goals: a page with a range or a field out of place is told what to write', () => {
  assert.match(read({ goal: 'same-rows', top: [0, 10], bottom: [3, 10] }), /top is \[0,10\].*from 1 to 10/);
  assert.match(read({ goal: 'same-rows', top: [1, 10], bottom: [2, 10] }), /bottom is \[2,10\].*from 3 to 10/);
  assert.match(read({ goal: 'same-rows', top: [5, 5], bottom: [5, 5] }), /leave no two rows to draw/);
  assert.match(read({ goal: 'one-less', top: [4, 4], bottom: [5, 5] }), /leave no two rows to draw/);
  assert.match(read({ goal: 'one-less', bottom: [3, 10] }), /top is null/);
  assert.match(read({ goal: 'same-rows', top: [1, 10], bottom: [3, 10], rows: [4, 10] }), /rows belongs to another goal/);
  assert.match(read({ goal: 'right-sign', rows: [0, 10], apart: [1, 3] }), /rows is \[0,10\].*from 1 to 10/);
  assert.match(read({ goal: 'right-sign', rows: [4, 5], apart: [2, 3] }), /hold no two rows that far apart/);
  assert.match(read({ goal: 'right-sign', rows: [4, 10] }), /apart is null/);
  assert.match(read({ goal: 'other', top: [1, 10], bottom: [3, 10] }), /the goals are same-rows, one-less, right-sign/);
  assert.match(read({ goal: 'same-rows', top: [1, 10], bottom: [3, 10] }, { pair: 'auto' }), /pair is set by challenge.goal same-rows/);
  assert.match(read({ goal: 'same-rows', top: [1, 10], bottom: [3, 10] }, { top: 4 }), /top is set by challenge.goal/);
  assert.match(read({ goal: 'right-sign', rows: [4, 10], apart: [1, 3] }, { sign: '<' }), /sign is set by challenge.goal/);
  assert.match(read({ goal: 'right-sign', rows: [4, 10], apart: [1, 3] }, { look: 'cups' }), /look is set by challenge.goal/);
  assert.match(read({ goal: 'same-rows', top: [1, 10], bottom: [3, 10] }, { readout: ['unpaired'] }), /readout is set by challenge.goal/);
});
