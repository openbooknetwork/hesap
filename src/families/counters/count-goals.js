// The goals a count page can name. The page declares ranges, and the goal draws a target from them each time the
// page opens and each time the reader asks for another one. Each goal holds once the reader presses Check on the
// right number. The build and the browser both use this file.

export const APPLES = 35; // The apples in the pile beside the basket.
export const LOOSE = 12; // The counters in the pile beside the box.
const span = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const range = (r, lo, hi) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1] && r[0] >= lo && r[1] <= hi;
const words = r => JSON.stringify(r ?? null);
// off judges a checked number against the target and says in which direction a wrong one is off.
const off = (n, want) => n === want ? { done: true } : { done: false, note: n > want ? 'more' : 'fewer' };

export const COUNT_GOALS = {
  // The reader moves apples from a pile into the basket.
  'fill-basket': {
    scenes: ['count'],
    problem(c) {
      return range(c.target, 1, APPLES) ? null : `target is ${words(c.target)}, write the apples to put in as [low, high] from 1 to ${APPLES}, such as [6, 30]`;
    },
    draw: (c, spec, dice) => ({ target: dice.int(c.target[0], c.target[1]) }),
    holds: (state, spec, c, t) => state.checked ? off(state.basket, t.target) : { done: false },
    words: (c, t, f) => ({ target: f.int(t.target) }),
  },
  // A closed box holds a number, and the reader puts counters beside it until box and counters make the target.
  'count-on': {
    scenes: ['count'],
    problem(c) {
      if (!range(c.box, 1, 90)) return `box is ${words(c.box)}, write the number in the box as [low, high] from 1 to 90, such as [10, 60]`;
      if (!range(c.more, 1, LOOSE)) return `more is ${words(c.more)}, write how far the target lies past the box as [low, high] from 1 to ${LOOSE}, such as [3, 9]`;
      return null;
    },
    draw(c, spec, dice) { const box = dice.int(c.box[0], c.box[1]); return { box, target: box + dice.int(c.more[0], c.more[1]) }; },
    holds: (state, spec, c, t) => state.checked ? off(t.box + state.beside, t.target) : { done: false },
    words: (c, t, f) => ({ box: f.int(t.box), target: f.int(t.target) }),
  },
  // Counters stand in rows of ten, and the reader takes them away until the target is left. The target lies in a
  // lower ten than the start, so counting back crosses a ten.
  'count-back': {
    scenes: ['count'],
    problem(c) {
      if (!range(c.start, 2, 100)) return `start is ${words(c.start)}, write the counters as the page opens as [low, high] from 2 to 100, such as [25, 100]`;
      if (!range(c.less, 1, 99)) return `less is ${words(c.less)}, write how many to take away as [low, high], such as [3, 12]`;
      return null;
    },
    draw(c, spec, dice) {
      const pairs = span(c.start[0], c.start[1]).flatMap(start => span(c.less[0], c.less[1]).map(d => ({ start, target: start - d })))
        .filter(p => p.target >= 0 && Math.floor(p.target / 10) < Math.floor((p.start - 1) / 10));
      return pairs.length ? dice.pick(pairs) : null;
    },
    holds: (state, spec, c, t) => state.checked ? off(state.left, t.target) : { done: false },
    words: (c, t, f) => ({ start: f.int(t.start), target: f.int(t.target) }),
  },
};

// The reader's state as a challenge opens: nothing checked, an empty basket, nothing beside the box and every counter
// of the rows in place.
export const countStart = (spec, t) => ({ checked: false, basket: 0, beside: 0, left: t?.start ?? 0 });
