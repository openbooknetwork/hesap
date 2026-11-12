// The goals a challenge page can name. The page declares ranges, and the goal draws a target from them each time the
// page opens and each time the reader asks for another one. The build and the browser both use this file.
import { capOf } from './model.js';

// A pile holds this many counters for the reader to take from.
export const PILE = 20;
const span = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const range = r => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1];

export const GOALS = {
  // Red counters wait beside the frames. The reader sets how many blue counters go with them and presses Check,
  // which drops them all into the frames. A whole ten of red is never drawn, because its partner is a whole ten too.
  'make-whole': {
    scenes: ['bonds'],
    looks: ['frames'],
    problem(c, spec) {
      if (!Number.isInteger(c.whole)) return 'whole is missing, write the number the frames must hold, such as 10';
      if (c.whole < 2 || c.whole > capOf(spec)) return `whole is ${c.whole}, ${spec.frames} frame${spec.frames > 1 ? 's hold' : ' holds'} from 2 to ${capOf(spec)} counters`;
      if (!range(c.part)) return 'part is missing, write the range of red counters as [low, high], such as [1, 9]';
      return null;
    },
    draw(c, spec, dice) {
      const parts = span(c.part[0], c.part[1]).filter(p => p > 0 && p < c.whole && p % 10);
      return parts.length ? { whole: c.whole, part: dice.pick(parts) } : null;
    },
    // The goal holds once the reader has checked a number of blue counters that fills the frames to the whole.
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      const n = t.part + state.blue;
      return n === t.whole ? { done: true } : { done: false, note: n < t.whole ? 'short' : 'over' };
    },
    reach(spec, c, t) {
      if (t.whole - t.part > c.whole) return `the blue slider stops at ${c.whole}, below the ${t.whole - t.part} blue counters it needs`;
      return null;
    },
    words: (c, t, f) => ({ part: f.int(t.part), whole: f.int(t.whole) }),
  },
  // The diagram shows the whole and one part as counters, and a cup hides the other part. The reader builds the
  // hidden part in a tray, then lifts the cup to compare.
  'hidden-part': {
    scenes: ['bonds'],
    looks: ['diagram'],
    problem(c) {
      if (!range(c.whole) || c.whole[0] < 2 || c.whole[1] > PILE) return `whole is ${JSON.stringify(c.whole)}, write the range of the whole as [low, high] from 2 to ${PILE}, such as [5, 20]`;
      if (c.part !== undefined && !range(c.part)) return 'part is not a range, write the part in sight as [low, high], or leave it out for 1 to one less than the whole';
      return null;
    },
    draw(c, spec, dice) {
      const pairs = span(c.whole[0], c.whole[1]).flatMap(w => span(Math.max(1, c.part?.[0] ?? 1), Math.min(w - 1, c.part?.[1] ?? w - 1)).map(p => ({ whole: w, part: p })));
      return pairs.length ? dice.pick(pairs) : null;
    },
    holds(state, spec, c, t) {
      if (!state.lifted) return { done: false };
      const want = t.whole - t.part;
      return state.tray === want ? { done: true } : { done: false, note: state.tray > want ? 'more' : 'fewer' };
    },
    reach(spec, c, t) {
      if (t.whole - t.part > PILE) return `the pile holds ${PILE} counters, fewer than the ${t.whole - t.part} the tray needs`;
      return null;
    },
    words: (c, t, f) => ({ part: f.int(t.part), whole: f.int(t.whole) }),
  },
};

// The reader's state as a challenge opens: no blue counters checked, an empty tray and the cup down.
export const challengeStart = () => ({ blue: 0, checked: false, tray: 0, lifted: false });

// another draws a target that differs from the last one, so Another one always changes the figure.
export function another(goal, c, spec, dice, last) {
  for (let i = 0; i < 40; i++) {
    const t = goal.draw(c, spec, dice);
    if (!last || JSON.stringify(t) !== JSON.stringify(last)) return t;
  }
  return goal.draw(c, spec, dice);
}
