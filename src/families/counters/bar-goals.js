// The goals a counters/bar page can name. The page declares a range, and the goal draws a target from it each time the
// page opens and each time the reader asks for another one. The build and the browser both use this file.
import { FACTS, sameFact, factLine } from '../../kit/written.js';

// The bar bar-for-fact opens on, with both handles.
export const OPEN = { whole: 10, first: 5 };
// The stepper Third number of bar-for-two, and the two uses its segment offers.
export const THIRD = [0, 20];
export const USES = ['parts', 'whole'];
const WHOLES = [3, 20], NUMBERS = [1, 19];
const span = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const range = (r, [lo, hi]) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1] && r[0] >= lo && r[1] <= hi;
const extra = (c, names) => { const f = Object.keys(c).find(k => k !== 'goal' && !names.includes(k)); return f ? `${f} belongs to another goal, this one draws from ${names.join(' and ')}` : null; };
const words = r => JSON.stringify(r ?? null);

// The pairs a bar-for-two page can draw: two different numbers of its range whose sum the stepper reaches. The
// stepper opens at 0, which neither use of two different numbers needs.
const pairs = c => span(...c.numbers).flatMap(less => span(less + 1, c.numbers[1]).map(greater => ({ greater, less }))).filter(p => p.greater + p.less <= THIRD[1]);
// The third number of each use: the sum for the two parts, and the missing part for the whole and a part.
export const thirdOf = (t, use) => use === 'parts' ? t.greater + t.less : t.greater - t.less;
// The parts of the bar of a use: the two numbers as the parts, or the less and the third number as the parts of the
// greater.
export const partsOf = (t, use, third) => use === 'parts' ? { first: t.greater, second: t.less, whole: third } : { first: t.less, second: third, whole: t.greater };


export const BAR_GOALS = {
  // The page writes a drawn fact under the bar. The reader drags the end to its whole and the split to one of its
  // parts, and presses Check. Once the goal holds the other facts of the family join it.
  'bar-for-fact': {
    scenes: ['bar'],
    problem(c) {
      const stop = extra(c, ['whole']);
      if (stop) return stop;
      return range(c.whole, WHOLES) ? null : `whole is ${words(c.whole)}, write the range of the whole as [low, high] from ${WHOLES[0]} to ${WHOLES[1]}, such as [6, 18]`;
    },
    // A whole of the range, a part below it, and an addition that writes that part first or a subtraction that takes
    // it away, each half the time. So every fact the page writes comes from one draw, and Another one gives a new fact.
    // Two equal parts give two facts, and the drawn fact is the one the figure writes.
    draw(c, spec, dice) {
      for (let i = 0; i < 50; i++) {
        const whole = dice.int(...c.whole), first = dice.int(1, whole - 1), fact = dice.pick(['written', 'written-minus-first']);
        if (whole === OPEN.whole && first === OPEN.first) continue;
        return { whole, first, fact: sameFact(fact, first, whole - first) };
      }
      return null;
    },
    page: () => ({ ...OPEN, drag: ['split', 'end'] }),
    // A wrong whole says which way the end goes. A right whole with wrong parts says which way the split goes, to the
    // nearer of the two places that give the fact's parts.
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      if (state.whole !== t.whole) return { done: false, note: state.whole > t.whole ? 'longer' : 'shorter' };
      const places = [t.first, t.whole - t.first];
      if (places.includes(state.first)) return { done: true };
      const near = places.reduce((a, b) => Math.abs(b - state.first) < Math.abs(a - state.first) ? b : a);
      return { done: false, note: near > state.first ? 'right' : 'left' };
    },
    reach: (spec, c, t) => t.whole < 2 || t.whole > WHOLES[1] || t.first < 1 || t.first >= t.whole ? `its whole ${t.whole} and part ${t.first} lie out of the reach of the handles` : null,
    // The facts the figure writes: the drawn fact in the first place, under the bar, then its whole family in their
    // places once the goal holds, with the parts in the order of the reader's bar so each number takes its part's
    // colour.
    facts: (t, s, done) => done ? { first: s.first, second: s.whole - s.first, listed: FACTS }
      : { first: t.first, second: t.whole - t.first, listed: ['written'], lines: { written: factLine(t.fact, t.first, t.whole - t.first) } },
    words(c, t, s, { int, written }) {
      const b = t.whole - t.first;
      return { fact: written(factLine(t.fact, t.first, b)), whole: int(t.whole), first: int(Math.max(t.first, b)), second: int(Math.min(t.first, b)) };
    },
    hint: t => factLine(t.fact, t.first, t.whole - t.first).sign === '+' ? 'plus' : 'minus',
  },
  // The page draws two different numbers. The reader picks whether they are the two parts or the whole and a part,
  // sets the third number of the family and presses Check. Either use solves a draw. Until it holds the bar is a
  // sketch: the third number carries a question mark, and as the whole and a part the two pieces are half and half,
  // so no length gives the answer. Once it holds the reader's family is drawn to scale.
  'bar-for-two': {
    scenes: ['bar'],
    problem(c) {
      const stop = extra(c, ['numbers']);
      if (stop) return stop;
      if (!range(c.numbers, NUMBERS)) return `numbers is ${words(c.numbers)}, write the range of the two numbers as [low, high] from ${NUMBERS[0]} to ${NUMBERS[1]}, such as [2, 12]`;
      return pairs(c).length ? null : `numbers ${words(c.numbers)} leave no two different numbers whose sum is ${THIRD[1]} at most, widen the range`;
    },
    draw: (c, spec, dice) => { const all = pairs(c); return all.length ? dice.pick(all) : null; },
    page: () => ({ drag: [], useCtl: { kind: 'segment', items: USES }, thirdCtl: { kind: 'stepper', lo: THIRD[0], hi: THIRD[1] } }),
    // A wrong third number says which way it is off, in the reader's numbers, without the answer.
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      // Either third number makes a family, whatever the segment shows, and the goal names the use it matches.
      const use = USES.find(u => state.third === thirdOf(t, u));
      if (use) return { done: true, use };
      const right = thirdOf(t, state.use);
      return { done: false, note: `${state.use}-${state.third > right ? 'over' : 'under'}` };
    },
    reach: (spec, c, t) => USES.every(u => thirdOf(t, u) >= THIRD[0] && thirdOf(t, u) <= THIRD[1]) ? null : `a third number of ${t.greater} and ${t.less} lies past the stepper's reach of ${THIRD[0]} to ${THIRD[1]}`,
    // The facts of the reader's family, once the goal holds.
    facts: (t, s, done) => { const p = partsOf(t, s.use, s.third); return { first: p.first, second: p.second, listed: done ? FACTS : [] }; },
    // The done line names the reader's family first, then the family of the other use.
    words(c, t, s, { int }) {
      const use = s?.use ?? 'parts', other = USES.find(u => u !== use);
      return { greater: int(t.greater), less: int(t.less), n: int(s?.third ?? 0), mine: int(thirdOf(t, use)), other: int(thirdOf(t, other)) };
    },
  },
};

// The reader's state as a challenge opens: the opening bar, the two numbers as parts, and nothing checked. The third
// number opens at the greater of the two drawn numbers, which solves neither use: the sum is more and the difference
// less.
export const barStart = t => ({ ...OPEN, use: 'parts', third: t?.greater ?? THIRD[0], checked: false });
