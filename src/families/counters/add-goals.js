// The goals a counters/add page can name. The page declares ranges, and the goal draws a target from them each time
// the page opens and each time the reader asks for another one. The build and the browser both use this file.
import { PLUS, MINUS, answerOf } from '../../kit/written.js';

export const SUM_STEP = [0, 20]; // The stepper Sum of a find-sum page, as far as the two frames hold.
export const PART_STEP = [0, 9]; // The steppers Makes ten and The rest of a steps-to-ten page.
// The widest ranges a page may draw from. A first number reaches past the first ten, and the second joins after it
// within the two frames.
const FIRSTS = [1, 19], PARTS = [1, 10], SUMS = [1, 20], SECONDS = [2, 9];
const span = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const range = (r, [lo, hi]) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1] && r[0] >= lo && r[1] <= hi;
const extra = (c, names) => { const f = Object.keys(c).find(k => k !== 'goal' && !names.includes(k)); return f ? `${f} belongs to another goal, this one draws from ${names.join(' and ')}` : null; };
const words = r => JSON.stringify(r ?? null);
const stepper = ([lo, hi]) => ({ kind: 'stepper', lo, hi });

// The additions a find-sum page can draw: every first and second number of their ranges whose sum lies in its range.
const sums = c => span(...c.first).flatMap(a => span(...c.second).map(b => ({ a, b }))).filter(t => t.a + t.b >= c.sum[0] && t.a + t.b <= c.sum[1]);
// The calculations a steps-to-ten page can draw, of one kind: an addition from 1 to 9 whose sum lies from 11 to 18, or
// a subtraction from 11 to 18 that leaves 1 to 9. Each crosses ten.
const crossing = (c, sign) => sign === PLUS
  ? span(1, 9).flatMap(a => span(...c.second).map(b => ({ a, sign, b }))).filter(t => t.a + t.b >= 11 && t.a + t.b <= 18)
  : span(11, 18).flatMap(a => span(...c.second).map(b => ({ a, sign, b }))).filter(t => t.a - t.b >= 1 && t.a - t.b <= 9);
// toTenOf gives the part of the second number that takes the first number to 10.
export const toTenOf = t => t.sign === PLUS ? 10 - t.a : t.a - 10;

export const ADD_GOALS = {
  // The page writes a drawn addition open, such as 4 + 3, over empty frames. The reader sets its sum on the stepper
  // Sum and presses Check, and the two groups join in the frames once the sum is right.
  'find-sum': {
    scenes: ['add'],
    problem(c) {
      const stop = extra(c, ['first', 'second', 'sum']);
      if (stop) return stop;
      for (const [k, [lo, hi], eg] of [['first', FIRSTS, '[9, 15]'], ['second', PARTS, '[2, 4]']]) if (!range(c[k], [lo, hi])) return `${k} is ${words(c[k])}, write the range of the ${k} number as [low, high] from ${lo} to ${hi}, such as ${eg}`;
      if (!range(c.sum, SUMS)) return `sum is ${words(c.sum)}, write the range of the sum as [low, high] from ${SUMS[0]} to ${SUMS[1]}, such as [11, 19], since the stepper Sum opens at 0`;
      return sums(c).length ? null : 'first, second and sum leave no addition to draw, widen one of them';
    },
    draw: (c, spec, dice) => { const all = sums(c); return all.length ? dice.pick(all) : null; },
    page: () => ({ first: 0, second: 0, sumCtl: stepper(SUM_STEP) }),
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      const sum = t.a + t.b;
      return state.sum === sum ? { done: true } : { done: false, note: state.sum > sum ? 'less' : 'greater' };
    },
    reach: (spec, c, t) => t.a + t.b > SUM_STEP[1] ? `the stepper Sum stops at ${SUM_STEP[1]}, below ${t.a + t.b}` : null,
    // The line the page writes as it opens, without its answer.
    line: (t, done) => ({ a: t.a, sign: PLUS, b: t.b, open: !done }),
    words: (c, t, f) => ({ a: f.int(t.a), b: f.int(t.b), sum: f.int(t.a + t.b) }),
  },
  // The page writes a drawn addition or subtraction across ten open, such as 8 + 5 or 15 − 8, over its counters. The
  // reader splits the second number on the steppers Makes ten and The rest and presses Check, and the counters move in
  // the two steps once the split is right.
  'steps-to-ten': {
    scenes: ['add'],
    problem(c) {
      const stop = extra(c, ['second']);
      if (stop) return stop;
      if (!range(c.second, SECONDS)) return `second is ${words(c.second)}, write the range of the second number as [low, high] from ${SECONDS[0]} to ${SECONDS[1]}, such as [3, 9]`;
      for (const [sign, kind] of [[PLUS, 'addition'], [MINUS, 'subtraction']]) if (!crossing(c, sign).length) return `second is ${words(c.second)}, which leaves no ${kind} across ten to draw, widen it`;
      return null;
    },
    // An addition or a subtraction each half the time, then one calculation of that kind.
    draw: (c, spec, dice) => { const all = crossing(c, dice.pick([PLUS, MINUS])); return all.length ? dice.pick(all) : null; },
    page: t => ({ first: t.a, second: 0, ...(t.sign === PLUS ? { waiting: t.b } : { take: true }), toTenCtl: stepper(PART_STEP), restCtl: stepper(PART_STEP) }),
    // The reader's Makes ten is checked first, then the two parts against the second number.
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      const toTen = toTenOf(t);
      if (state.toTen !== toTen) return { done: false, note: state.toTen > toTen ? 'past' : 'short' };
      const both = state.toTen + state.rest;
      return both === t.b ? { done: true } : { done: false, note: both > t.b ? 'more' : 'less' };
    },
    reach: (spec, c, t) => toTenOf(t) > PART_STEP[1] || t.b - toTenOf(t) > PART_STEP[1] ? `the steppers stop at ${PART_STEP[1]}` : null,
    line: (t, done) => ({ a: t.a, sign: t.sign, b: t.b, open: !done }),
    // The two steps of the drawn calculation: to 10, then from 10.
    steps: t => [{ a: t.a, sign: t.sign, b: toTenOf(t) }, { a: 10, sign: t.sign, b: t.b - toTenOf(t) }],
    words: (c, t, f) => ({ first: f.int(t.a), second: f.int(t.b), sum: f.int(answerOf(t)) }),
  },
};

// The reader's state as a challenge opens: every stepper at 0 and nothing checked.
export const addStart = () => ({ sum: 0, toTen: 0, rest: 0, checked: false });
