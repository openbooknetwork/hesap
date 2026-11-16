// The goals a match page can name. The page declares ranges, and the goal draws two rows from them each time the
// page opens and each time the reader asks for another one. One of the rows stands wide and the other close, so the
// ends of the rows say nothing about their numbers. The build and the browser both use this file.
import { SIGNS, signOf } from './reading.js';

export const STEP = [0, 12]; // The stepper of the top row on a challenge page.
const TOPS = [1, 10], BOTTOMS = [3, 10], ROWS = [1, 10]; // The widest ranges a page may draw its rows from.
const span = ([lo, hi]) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const range = (r, [lo, hi]) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1] && r[0] >= lo && r[1] <= hi;
const words = r => JSON.stringify(r ?? null);
// The two rows of a goal whose top row the reader steps: every pair of the page's ranges that fits.
const pairs = (c, fits) => span(c.bottom).flatMap(bottom => span(c.top).filter(top => fits(top, bottom)).map(top => ({ top, bottom })));
const ranges = c => !range(c.top, TOPS) ? `top is ${words(c.top)}, write the top row's range as [low, high] from ${TOPS[0]} to ${TOPS[1]}, such as [1, 10]`
  : !range(c.bottom, BOTTOMS) ? `bottom is ${words(c.bottom)}, write the bottom row's range as [low, high] from ${BOTTOMS[0]} to ${BOTTOMS[1]}, such as [3, 10]` : null;
const extra = (c, names) => { const f = Object.keys(c).find(k => k !== 'goal' && !names.includes(k)); return f ? `${f} belongs to another goal, this one draws from ${names.join(' and ')}` : null; };
// A goal the reader reaches with the top row's stepper opens with that stepper and no lines.
const stepped = (fits, off) => ({
  scenes: ['match'],
  problem(c) {
    const stop = extra(c, ['top', 'bottom']) ?? ranges(c);
    return stop ?? (pairs(c, fits).length ? null : 'top and bottom leave no two rows to draw, widen one of them');
  },
  draw(c, spec, dice) { const all = pairs(c, fits); return all.length ? { ...dice.pick(all), wide: dice.pick(['top', 'bottom']) } : null; },
  page: t => ({ top: t.top, bottom: t.bottom, wide: t.wide, topCtl: { kind: 'stepper', lo: STEP[0], hi: STEP[1] } }),
  holds: (state, spec, c, t) => !state.checked ? { done: false } : off(state.top, state.bottom),
});

export const MATCH_GOALS = {
  // The reader steps the top row until it has as many counters as the bottom row. A wrong check names the row that
  // has counters without a partner.
  'same-rows': stepped((top, bottom) => top !== bottom, (top, bottom) => top === bottom ? { done: true } : { done: false, note: top > bottom ? 'top' : 'bottom' }),
  // The reader steps the top row until it has one counter fewer than the bottom row. Once it has, each row shows
  // its number at its end.
  'one-less': { ...stepped((top, bottom) => top !== bottom - 1, (top, bottom) => top === bottom - 1 ? { done: true } : { done: false, note: top > bottom - 1 ? 'over' : 'short' }), ends: true },
  // Two rows show no numbers, and the reader sets the sign between them. Each of the three signs is the true one in
  // one draw of three, and the tile opens on one of the two false signs. A wrong check says in which direction the
  // top row is off, with the signs in the order <, =, >.
  'right-sign': {
    scenes: ['match'],
    problem(c) {
      const stop = extra(c, ['rows', 'apart']);
      if (stop) return stop;
      if (!range(c.rows, ROWS)) return `rows is ${words(c.rows)}, write the range of both rows as [low, high] from ${ROWS[0]} to ${ROWS[1]}, such as [4, 10]`;
      if (!range(c.apart, [1, ROWS[1]])) return `apart is ${words(c.apart)}, write how far two different rows stand apart as [low, high] from 1, such as [1, 3]`;
      return c.rows[1] - c.rows[0] >= c.apart[0] ? null : `apart starts at ${c.apart[0]}, and rows from ${c.rows[0]} to ${c.rows[1]} hold no two rows that far apart, so the signs < and > have nothing to draw`;
    },
    draw(c, spec, dice) {
      const sign = dice.pick(SIGNS), far = span(c.rows).flatMap(a => span(c.apart).filter(d => a + d <= c.rows[1]).map(d => [a, a + d]));
      const [less, more] = sign === '=' ? Array(2).fill(dice.pick(span(c.rows))) : dice.pick(far);
      const [top, bottom] = sign === '>' ? [more, less] : [less, more];
      return { top, bottom, wide: dice.pick(['top', 'bottom']), opens: dice.pick(SIGNS.filter(x => x !== sign)) };
    },
    page: t => ({ top: t.top, bottom: t.bottom, wide: t.wide, sign: t.opens, hidden: true }),
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      const want = signOf(state.top, state.bottom);
      return state.sign === want ? { done: true } : { done: false, note: SIGNS.indexOf(want) > SIGNS.indexOf(state.sign) ? 'more' : 'fewer' };
    },
  },
};

// The reader's state as a challenge opens: the drawn rows, the sign the tile opens on, and nothing checked.
export const matchStart = (spec, t) => ({ checked: false, top: t.top, bottom: t.bottom, sign: t.opens ?? null });
