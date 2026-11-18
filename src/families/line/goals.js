// The goals a challenge page of the line scene can name. The page declares ranges, and the goal draws a target from
// them each time the page opens and each time the reader asks for another one. Every goal answers Check the same way:
// the point is on the target, or to its left, or to its right, and its goal line and notes are those of place. The
// build and the browser both use this file.
import { gapsOf, numberAt, labelled } from './model.js';
import { PLUS, MINUS } from '../../kit/written.js';

const range = r => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] <= r[1];
const span = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
// judge compares the number at the point with the target once the reader has pressed Check.
const judge = (state, target) => !state.checked ? { done: false } : state.point === target ? { done: true } : { done: false, note: state.point < target ? 'left' : 'right' };
// The line of place-unmarked is at least UNMARKED_APART long, and its length is one of UNMARKED_LENGTHS, so its
// middle is a ten.
export const UNMARKED_APART = 40, UNMARKED_LENGTHS = [20, 40, 60, 80, 100];
const lengths = () => UNMARKED_LENGTHS.filter(n => n >= UNMARKED_APART);
export const TWO_GAPS = 10, TWO_TOP = 100, TWO_STEPS = [2, 5, 10], TWO_APART = 3; // The line of place-two-labels.


// The words of a goal's hint and of its notes, as a string key and the numbers in it. The place goals share their
// notes: the side the point is on, and the number to move it to.
const sideNote = (t, note) => ({ key: `note-place-${note}`, vars: { target: t.target } });

export const GOALS = {
  // The reader puts the point on a number of a marked line that carries no label, and presses Check. The target is
  // a mark of the line in the page's range, with no label and away from the point's start.
  place: {
    fields: ['target'],
    problem(c, spec) {
      if (!range(c.target)) return `target is ${JSON.stringify(c.target ?? null)}, write the range of numbers to place as [low, high], such as [11, 99]`;
      if (c.target[0] < spec.from || c.target[1] > spec.to) return `target is [${c.target}], write a range inside the line from ${spec.from} to ${spec.to}`;
      return null;
    },
    targets(c, spec) {
      const start = spec.point ?? spec.from;
      return span(0, gapsOf(spec)).map(k => numberAt(spec, k)).filter(n => n >= c.target[0] && n <= c.target[1] && !labelled(spec, n) && n !== start);
    },
    draw(c, spec, dice) { const all = GOALS.place.targets(c, spec); return all.length ? { target: dice.pick(all) } : null; },
    holds: (state, spec, c, t) => judge(state, t.target),
    // Every mark of a marked line is in reach of the drag and of the jumps.
    reach: () => null,
    // The hint names the long marks either side of the number and counts from the nearer one.
    hint(t, spec) {
      const marks = span(0, gapsOf(spec)).map(k => numberAt(spec, k)).filter(n => labelled(spec, n));
      const before = Math.max(...marks.filter(n => n < t.target)), after = Math.min(...marks.filter(n => n > t.target));
      return { key: t.target - before <= after - t.target ? 'hint-place-on' : 'hint-place-back', vars: { target: t.target, before, after } };
    },
    note: sideNote,
  },
  // The goal draws the line: a step, a left end that is a multiple of it, and 10 gaps that end at 100 or below. Two
  // marks next to each other carry labels, and the point starts on one of them. The target is a mark at least three
  // steps from both, so the reader reads the step and counts jumps. Once the goal holds every mark shows its label.
  'place-two-labels': {
    fields: ['step', 'from'],
    draws: true,
    problem(c) {
      if (!Array.isArray(c.step) || !c.step.length || !c.step.every(v => TWO_STEPS.includes(v))) return `step is ${JSON.stringify(c.step ?? null)}, write a list of steps from ${TWO_STEPS.join(', ')}, such as [2, 5, 10]`;
      if (!range(c.from) || c.from[0] < 0) return `from is ${JSON.stringify(c.from ?? null)}, write the range of the left end as [low, high] from 0, such as [0, 50]`;
      return null;
    },
    // lines gives every line the page's ranges allow: each step with each left end that is a multiple of it.
    noLine: c => `step [${c.step}] and from [${c.from}] give no line of 10 gaps that ends at 100 or below`,
    lines: c => c.step.flatMap(step => span(c.from[0], c.from[1]).filter(from => from % step === 0 && from + TWO_GAPS * step <= TWO_TOP).map(from => ({ step, from }))),
    draw(c, spec, dice) {
      // The step comes first, each step that has a line as likely as the others, and then a left end of that step, so
      // the steps with many left ends do not crowd out the others.
      const lines = GOALS['place-two-labels'].lines(c), steps = [...new Set(lines.map(l => l.step))];
      if (!lines.length) return null;
      const pickStep = dice.pick(steps), { step, from } = dice.pick(lines.filter(l => l.step === pickStep)), k = dice.int(0, TWO_GAPS - 1), at = k2 => from + k2 * step;
      const marks = span(0, TWO_GAPS).filter(j => Math.abs(j - k) >= TWO_APART && Math.abs(j - k - 1) >= TWO_APART);
      return { step, from, to: at(TWO_GAPS), labels: [at(k), at(k + 1)], start: at(dice.pick([k, k + 1])), target: at(dice.pick(marks)) };
    },
    // The page's line as the goal drew it. Its ends are marks like the others, and reveal shows every label once the
    // goal holds.
    page: t => ({ from: t.from, to: t.to, step: t.step, labels: t.labels, point: t.start, reveal: true }),
    holds: (state, spec, c, t) => judge(state, t.target),
    // The hint reads the step from the two labels and counts on from the right one, or back from the left one.
    hint: t => ({ key: t.target > t.labels[1] ? 'hint-place-two-labels-on' : 'hint-place-two-labels-back', vars: { a: t.labels[0], b: t.labels[1], target: t.target } }),
    note: sideNote,
    reach: (spec, c, t) => t.target < t.from || t.target > t.to || (t.target - t.from) % t.step ? `the target ${t.target} is no mark of the line from ${t.from} to ${t.to} in steps of ${t.step}` : null,
  },
  // The goal draws an unmarked line between two tens whose length is one of UNMARKED_LENGTHS, and a whole number more
  // than a tenth of the line from each end and from its middle, so neither the start nor the Middle button holds the
  // goal. The point starts at the left end and moves freely. Check holds within a tenth of the line either side of
  // the number. Once the goal holds, a flag shows where the number is.
  'place-unmarked': {
    fields: ['from', 'to'],
    draws: true,
    takes: ['middle'],
    flags: true,
    problem(c) {
      for (const f of ['from', 'to']) if (!range(c[f]) || c[f][0] < 0 || c[f][1] > 100) return `${f} is ${JSON.stringify(c[f] ?? null)}, write the range of the ${f === 'from' ? 'left' : 'right'} end as [low, high] from 0 to 100, such as ${f === 'from' ? '[0, 30]' : '[40, 100]'}`;
      return null;
    },
    noLine: c => `from [${c.from}] and to [${c.to}] give no two tens ${lengths().slice(0, -1).join(', ')} or ${lengths().at(-1)} apart`,
    lines: c => span(c.from[0], c.from[1]).filter(a => a % 10 === 0).flatMap(a => span(c.to[0], c.to[1]).filter(b => b % 10 === 0 && lengths().includes(b - a)).map(b => ({ from: a, to: b }))),
    // targets gives the whole numbers of a line more than a tenth of it from its ends and its middle.
    targets: (from, to) => { const far = (to - from) / 10, mid = (from + to) / 2; return span(from, to).filter(n => n - from > far && to - n > far && Math.abs(n - mid) > far); },
    draw(c, spec, dice) {
      // The length comes first, each length that has a line as likely as the others, and then a line of that length.
      const lines = GOALS['place-unmarked'].lines(c), lens = [...new Set(lines.map(l => l.to - l.from))];
      if (!lines.length) return null;
      const len = dice.pick(lens), { from, to } = dice.pick(lines.filter(l => l.to - l.from === len));
      return { from, to, start: from, target: dice.pick(GOALS['place-unmarked'].targets(from, to)) };
    },
    page: t => ({ from: t.from, to: t.to, step: 1, marks: 'ends', labels: 'ends', point: t.start }),
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      const off = state.point - t.target;
      return Math.abs(off) <= (t.to - t.from) / 10 ? { done: true } : { done: false, note: off < 0 ? 'left' : 'right' };
    },
    reach: (spec, c, t) => t.target < t.from || t.target > t.to ? `the target ${t.target} is off the line from ${t.from} to ${t.to}` : null,
    // The hint marks the middle, names the half the number lies in, and the guide it lies closer to.
    hint(t) {
      const mid = (t.from + t.to) / 2, end = t.target > mid ? t.to : t.from;
      return { key: 'hint-place-unmarked', vars: { mid, target: t.target, lo: Math.min(mid, end), hi: Math.max(mid, end), near: Math.abs(t.target - mid) <= Math.abs(t.target - end) ? mid : end } };
    },
    note: sideNote,
  },
  // The goal draws a start and a number to add or to subtract, each sign as likely as the other where both draw, with
  // the answer on the line. The point opens on the start, whose ring stays put, and the reader jumps it to the answer
  // and presses Check. A wrong Check says the point went the wrong way, or made too few or too many jumps. Once the
  // goal holds, the written line shows.
  'jump-to': {
    fields: ['start', 'add', 'subtract'],
    labels: true,
    problem(c, spec) {
      if (!range(c.start) || c.start[0] < spec.from || c.start[1] > spec.to) return `start is ${JSON.stringify(c.start ?? null)}, write the range of the start as [low, high] inside the line from ${spec.from} to ${spec.to}, such as [2, 18]`;
      for (const f of ['add', 'subtract']) if (c[f] !== undefined && (!range(c[f]) || c[f][0] < 1)) return `${f} is ${JSON.stringify(c[f])}, write the numbers to ${f} as [low, high] from 1, such as [2, 4]`;
      if (c.add === undefined && c.subtract === undefined) return 'add and subtract are missing, write the numbers to add, to subtract, or both, such as add: [2, 4]';
      return null;
    },
    // sums gives every start and number of one sign whose answer is a mark of the line.
    sums(c, spec, sign) {
      const r = sign === PLUS ? c.add : c.subtract;
      if (!r) return [];
      return span(c.start[0], c.start[1]).filter(n => (n - spec.from) % spec.step === 0).flatMap(start => span(r[0], r[1]).map(n => ({ start, sign, n, target: sign === PLUS ? start + n * spec.step : start - n * spec.step })))
        .filter(d => d.target >= spec.from && d.target <= spec.to);
    },
    draw(c, spec, dice) {
      const signs = [PLUS, MINUS].filter(sign => GOALS['jump-to'].sums(c, spec, sign).length);
      return signs.length ? dice.pick(GOALS['jump-to'].sums(c, spec, dice.pick(signs))) : null;
    },
    page: t => ({ start: t.start, point: t.start }),
    holds(state, spec, c, t) {
      if (!state.checked) return { done: false };
      if (state.point === t.target) return { done: true };
      const way = Math.sign(t.target - t.start), went = Math.sign(state.point - t.start);
      return { done: false, note: went === -way ? 'way' : Math.abs(state.point - t.start) < Math.abs(t.target - t.start) ? 'few' : 'many' };
    },
    reach: () => null,
    // The hint says the start, the button and the numbers said at the first jumps. The calculation is written as the
    // kit writes it, so the scene passes calc in.
    hint(t) {
      const dir = t.sign === PLUS ? 1 : -1, sign = t.sign === PLUS ? 'plus' : 'minus';
      return { key: t.n === 1 ? `hint-jump-${sign}-one` : `hint-jump-${sign}`, vars: { start: t.start, n: t.n, next: t.start + dir, then: t.start + 2 * dir } };
    },
    // A note says which way the calculation goes, or how many jumps the point made against the number it needs.
    note(t, note, state) {
      const done = Math.abs(state.point - t.start);
      if (note === 'way') return { key: `note-jump-way-${t.sign === PLUS ? 'plus' : 'minus'}`, vars: { start: t.start } };
      if (note === 'few') return { key: done ? 'note-jump-few' : 'note-jump-few-none', vars: { start: t.start, done, n: t.n } };
      return { key: 'note-jump-many', vars: { done, n: t.n } };
    },
  },
};

// The reader's state as a challenge opens: the point on its start and nothing checked.
export const challengeStart = (spec, t) => ({ checked: false, point: t?.start ?? spec.point ?? spec.from });
