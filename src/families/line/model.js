// What a page of the line scene holds and what it reads out. The build and the browser both use this file, so a
// page's text and its live values agree. A point stands at a mark, counted from 0 at the left end, and the number
// of mark k is from + k * step.
import { PLUS, MINUS } from '../../kit/written.js';

// The number line, the stepping stones of the frog, and the stones over the number line.
export const LOOKS = ['line', 'stones', 'stones-on-line', 'street', 'book'];
// An unmarked line has a mark at each end alone, and its point moves freely between them. The book is one.
export const isFree = spec => spec.marks === 'ends';
export const STONES = ['stones', 'stones-on-line'];
export const isStones = spec => STONES.includes(spec.look);
export const STONES_TO = 20; // The most stones a pond holds.
export const GAPS = 100; // The most gaps a marked line holds.

// The line keeps its gaps when the reader picks another step, so the gaps are counted at the page's own step.
export const gapsOf = spec => (spec.to - spec.from) / spec.step;
export const numberAt = (spec, k, step = spec.step) => spec.from + k * step;
export const markOf = (spec, n, step = spec.step) => (n - spec.from) / step;
export const isMark = (spec, n) => n >= spec.from && n <= spec.to && Number.isInteger(markOf(spec, n));
// A mark carries its label when the page labels every mark, only the two ends, the multiples of a number, or the
// numbers of a list. A labelled mark is long and the others are short.
export function labelled(spec, n) {
  if (spec.labels === 'all') return true;
  if (spec.labels === 'ends') return n === spec.from || n === spec.to;
  return Array.isArray(spec.labels) ? spec.labels.includes(n) : n % spec.labels === 0;
}
// The middle of the line, which a page with middle draws as a long mark with its label.
export const middleOf = (spec, step = spec.step) => numberAt(spec, gapsOf(spec) / 2, step);
// The numbers a page asks the reader to place, one after another.
export const findsOf = spec => spec.find == null ? [] : [spec.find].flat();
// The cards a page lays out: the list it names, or one for each blank mark.
export const cardsOf = spec => !spec.cards ? [] : spec.cards === true ? [...spec.blank] : spec.cards;
// shuffled puts the cards of cards: true in an order the dice draw, and draws again while they stand in the order
// of their marks, which would give the answer away.
export function shuffled(cards, dice) {
  if (cards.length < 2) return [...cards];
  for (;;) { const c = dice.shuffle(cards); if (c.some((n, i) => i && n < c[i - 1])) return c; }
}

// opening gives the page's state as it opens. at is the mark of the point, or null on a page without one, second
// the mark of the second point or null, base the mark where the reader began to jump, step the step the line counts
// in, checked whether the reader has pressed Check since the point last moved, open the gap the reader opened,
// cards the order of the cards in their row, placed the cards that sit on their marks, middle whether the middle
// shows, find the place in the list of numbers to find, and shown whether Show has revealed where it is.
export function opening(spec) {
  // A page with start counts its jumps from the start, and its point takes the start when the page leaves it out.
  const at = spec.point === false ? null : markOf(spec, spec.point ?? spec.start ?? spec.from);
  return { at, base: spec.start != null ? markOf(spec, spec.start) : at, second: spec.second == null ? null : markOf(spec, spec.second), step: spec.step, checked: false, open: null,
    cards: cardsOf(spec), placed: [], middle: spec.middle === true, find: 0, shown: false, estimate: spec.estimate ?? null, offs: offsetsOf(spec),
    size: spec.size ?? 1, undo: !!spec.undo, first: 0, back: false };
}

// A page with moved opens with some marks off their places. offs holds each such mark's offset, in gaps, and a mark
// stands at posOf, its own mark plus its offset.
export const offsetsOf = spec => Object.fromEntries((spec.moved ?? []).map(m => [markOf(spec, m.mark), m.by]));
export const posOf = (s, k) => k + (s.offs?.[k] ?? 0);
// The marks settle within a tenth of a gap, and a mark keeps a fifth of a gap from each neighbour.
export const SETTLE = 0.1, KEEP = 0.2;
// slide moves mark k towards the place to, in gaps, between its two neighbours where they stand. The ends stay. keep
// gives the least room between marks a and b, in gaps: a fifth of a gap, or more where their labels need it.
export function slide(spec, s, k, to, keep = () => KEEP) {
  if (k <= 0 || k >= gapsOf(spec)) return s;
  const at = Math.max(posOf(s, k - 1) + keep(k - 1, k), Math.min(posOf(s, k + 1) - keep(k, k + 1), to));
  return { ...s, offs: { ...s.offs, [k]: at - k } };
}
// Two labels of a moved line stay this far apart, so two numbers next to each other never read as one. The build
// checks a page on a 390px phone, whose stage is PHONE wide, with a digit DIGIT of a label's size wide.
export const LABELS_APART = 10, PHONE = 357, DIGIT = 0.6;
// labelKeep gives keep for a line on a stage W pixels wide: the room in gaps that holds two labels LABELS_APART apart,
// or a fifth of a gap where that is more. width gives a label's width in pixels, measured in the browser and
// estimated from its digits in the build, at the size labelRows sets.
export function labelKeep(spec, W, width) {
  const n = gapsOf(spec), gap = gapOn(W, n, false);
  if (!width) {
    const digits = k => String(numberAt(spec, k)).length, font = labelRows(DIGIT * Math.max(digits(0), digits(n)), gap, { base: gap >= 34 ? 16 : 14 }).font;
    width = k => DIGIT * font * digits(k);
  }
  return (a, b) => Math.max(KEEP, (LABELS_APART + (width(a) + width(b)) / 2) / gap);
}
// even says every mark lies within a tenth of a gap of its place, and settle then puts every mark on its place.
export const even = s => Object.values(s.offs).every(o => Math.abs(o) <= SETTLE + 1e-9);
export const settle = s => even(s) && Object.keys(s.offs).length ? { ...s, offs: {} } : s;
// The words under a line with moved marks, and how a mark's two gaps compare, for a reader who does not see them.
export const gapsKey = s => even(s) ? 'gaps-equal' : 'gaps-unequal';
export function sides(s, k) {
  const left = posOf(s, k) - posOf(s, k - 1), right = posOf(s, k + 1) - posOf(s, k);
  return Math.abs(left - right) <= 2 * SETTLE + 1e-9 ? 'mark-even' : left > right ? 'mark-left' : 'mark-right';
}

// The jumps run from base to the point, each one arc over size gaps, all in one direction: a press against the last
// jump takes it back. On an undo page first is the direction of the first jump, or 0 before it, and back says the
// jump back is made: two arcs at most, the second from the end of the first back to base.
export const jumpsOf = s => s.undo ? arcsOf(s).length : s.at === null ? 0 : Math.abs(s.at - s.base) / (s.size ?? 1);
export function arcsOf(s) {
  const size = s.size ?? 1;
  if (s.undo) {
    if (!s.first) return [];
    const turn = s.base + s.first * size, out = [{ from: s.base, to: turn, dir: s.first }];
    return s.back ? [...out, { from: turn, to: s.base, dir: -s.first }] : out;
  }
  return Array.from({ length: jumpsOf(s) }, (_, i) => {
    const dir = Math.sign(s.at - s.base), from = s.base + i * dir * size;
    return { from, to: from + dir * size, dir };
  });
}
// jump moves the point one jump, dir 1 to the right and -1 to the left, and gives null where the jump would leave the
// line. On an undo page the button of the first jump's direction rests until the jump back is made, and a press after
// the jump back makes a new first jump from base.
export function jump(spec, s, dir) {
  const size = s.size ?? 1, fits = k => k >= 0 && k <= gapsOf(spec), moved = { checked: false, shown: false };
  if (s.undo) {
    if (s.first && !s.back) return dir === s.first ? null : { ...s, ...moved, at: s.base, back: true };
    const at = s.base + dir * size;
    return fits(at) ? { ...s, ...moved, at, first: dir, back: false } : null;
  }
  const at = s.at + dir * size;
  return fits(at) ? { ...s, ...moved, at } : null;
}
// resize sets the size of a jump, which clears the jumps and puts the point on base.
export const resize = (s, size) => ({ ...s, size, at: s.base, first: 0, back: false, checked: false });
// place puts a point on mark k after a drag. A drag of the point starts the jumps again from its new mark.
export const place = (s, who, k) => who === 'second' ? { ...s, second: k } : { ...s, at: k, base: k, checked: false, shown: false };
// show reveals where the number to find is, and next moves to the next number of the list, back to the first after
// the last.
export const show = s => ({ ...s, shown: true });
export const next = (spec, s) => ({ ...s, find: (s.find + 1) % findsOf(spec).length, shown: false });
// middle draws the middle's mark, or takes it away.
export const toggleMiddle = s => ({ ...s, middle: !s.middle });
// numbered says whether Show, or a goal that holds, writes the number at the point on the point. A point of an
// unmarked line may stand between two numbers and carries none. The fixed point of an estimate page stands on a whole
// number and shows it.
export const numbered = spec => !isFree(spec) || spec.estimate != null;
// standing says where a point of an unmarked line stands, for a screen reader: on a whole number, or between two.
export function standing(spec, s) {
  const n = numberAt(spec, s.at, s.step), near = Math.round(n);
  return Math.abs(n - near) < 1e-6 ? { on: near } : { between: [Math.floor(n), Math.ceil(n)] };
}
// estimate sets the reader's estimate, which takes the reveal away.
export const estimate = (s, n) => ({ ...s, estimate: n, shown: false });
// moveStart moves the start to mark k and carries the point and its arcs along, so the jumps keep their number and
// their direction. The start stops where the point would leave the line.
// On a page that counts on to the second point, the start also stops one mark left of the second point.
// On an undo page the start clears both jumps and takes the point along.
export function moveStart(spec, s, k) {
  if (s.undo) { const base = Math.max(0, Math.min(gapsOf(spec), k)); return { ...s, base, at: base, first: 0, back: false, checked: false }; }
  const n = gapsOf(spec), d = s.at - s.base, lo = Math.max(0, -d), hi = Math.min(n, n - d, keepsRight(spec) ? s.second - 1 : n), base = Math.max(lo, Math.min(hi, k));
  return { ...s, base, at: base + d, checked: false };
}
// keepsRight says the second point stays right of the start: a page with start and written: difference counts on
// from the less number, the start, to the greater, the second point.
export const keepsRight = spec => spec.start != null && spec.written === 'difference';
// secondTo gives the mark the second point stops on when the reader moves it to k: one right of the start at least on
// a page that keeps it right.
export const secondTo = (spec, s, k) => keepsRight(spec) ? Math.max(k, s.base + 1) : k;
// writtenOf gives the written line of a page with written, as the kit writes it: the start, the sign of the jumps'
// direction, the number they add or take away, and the number at the point. written: difference writes the second
// point minus the start, and its answer once the point stands on the second point. ids gives the link id of each
// number of the line.
export function writtenOf(spec, s) {
  if (!spec.written) return null;
  const at = numberAt(spec, s.at, s.step), start = numberAt(spec, s.base, s.step);
  if (spec.written === 'difference') {
    // The second point stands right of the start, so the line reads the second point minus the start.
    return { a: numberAt(spec, s.second, s.step), sign: MINUS, b: start, open: s.at !== s.second, ids: { a: 'second', b: 'start', c: 'jumps' } };
  }
  // An undo page writes its first jump once it is made, and the number between the signs is the size of a jump.
  if (spec.undo) return s.first ? { a: start, sign: s.first > 0 ? PLUS : MINUS, b: s.size, ids: { a: 'start', b: 'size' } } : null;
  // Jumps of a size write the gaps they cover, which no link reads.
  return { a: start, sign: at >= start ? PLUS : MINUS, b: Math.abs(at - start), ids: { a: 'start', b: s.size > 1 ? null : 'jumps', c: 'point' } };
}
// backOf gives the line of the jump back on an undo page once it is made, from the end of the first jump back to the
// start, or null.
export function backOf(spec, s) {
  if (!spec.undo || !s.back) return null;
  return { a: numberAt(spec, s.base + s.first * s.size, s.step), sign: s.first > 0 ? MINUS : PLUS, b: s.size, ids: { b: 'size', c: 'start' } };
}
// pick changes the step. Every label changes, and the point and its jumps keep their marks.
export const pick = (s, step) => ({ ...s, step });
// open opens gap k, the gap from mark k to mark k + 1, or closes it when it is open already.
export const open = (s, k) => ({ ...s, open: s.open === k ? null : k });
// lay puts card n on the blank mark m. It stays there when m is its own number, and goes back to the row otherwise.
export const lay = (spec, s, n, m) => n === m && spec.blank.includes(m) && !s.placed.includes(n) ? { ...s, placed: [...s.placed, n] } : s;

// tensOf gives the ten before and the ten after the point, or null while the point is on a ten.
export function tensOf(spec, s) {
  const n = numberAt(spec, s.at, s.step);
  return n % 10 === 0 ? null : { before: n - n % 10, after: n - n % 10 + 10 };
}

// The line of words names the number that comes later in the count, or the one number both points are on.
export function readingOf(spec, s) {
  const a = numberAt(spec, s.at, s.step), b = numberAt(spec, s.second, s.step);
  return a === b ? { key: 'reading-both', a, b } : { key: 'reading-later', a: Math.max(a, b), b: Math.min(a, b) };
}

// The ids a page offers its text, and the ones a readout may show: every id but the line of words. A challenge page
// offers none, as its numbers are drawn when it opens.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  // A page that draws its line names no number of it, as each draw changes them.
  if (spec.draw) return ['placed'];
  // A page that asks the reader to place a number reads out no number at the point.
  // An unmarked line, and an estimate page, read out no number at the point either.
  const has = spec.point !== false && spec.find == null && !isFree(spec) && spec.estimate == null;
  // An undo page offers the lines of both jumps and no count of jumps, since the loop ends where it began.
  return [...(has ? ['point'] : []), ...(spec.start != null ? ['start'] : []), ...(spec.sized ? ['size'] : []), ...(spec.written ? ['written', 'reading'] : []), ...(spec.undo ? BACK : []), ...(spec.moved ? ['gaps'] : []), ...(spec.find != null ? ['find'] : []), ...(spec.estimate != null ? ['estimate'] : []), ...(spec.middle ? ['middle'] : []), ...(spec.second != null ? ['second'] : []), ...(spec.reading ? ['reading'] : []), ...(spec.jump && !spec.undo ? ['jumps'] : []),
    ...(spec.bracket ? ['ten-before', 'ten-after'] : []), ...(spec.cards ? ['placed'] : []), 'step', 'from', 'to'];
}
export const BACK = ['written-back', 'reading-back'];
// The written line and its words take a readout. The words of two points and of the gaps take none, nor the line of
// the jump back, which the figure writes under the first.
export const readoutsOf = spec => measuresOf(spec).filter(id => (id !== 'reading' || spec.written) && id !== 'gaps' && !BACK.includes(id));

// counts gives every value a page can read out, as the page stands. The right end follows the step, and the ten
// before and the ten after read null while the point is on a ten.
export function counts(spec, s) {
  const at = s.at === null ? null : numberAt(spec, s.at, s.step), tens = spec.bracket && at !== null ? tensOf(spec, s) : null;
  return { point: at, second: s.second == null ? null : numberAt(spec, s.second, s.step), jumps: jumpsOf(s), step: s.step, from: spec.from, to: numberAt(spec, gapsOf(spec), s.step),
    'ten-before': tens?.before ?? null, 'ten-after': tens?.after ?? null, placed: s.placed.length, size: s.size,
    start: s.base === null ? null : numberAt(spec, s.base, s.step), find: findsOf(spec)[s.find] ?? null, estimate: s.estimate, middle: spec.middle ? middleOf(spec, s.step) : null };
}

// The width of the line on a stage W pixels wide, as the gap between two marks. The stones keep about half a gap
// past each end, for the bank on the left and the last stone on the right.
export const EDGE = 28, EDGE_PHONE = 14, MAX_GAP = 80, MAX_W = 1000;
export const gapOn = (W, n, stones) => Math.min((W - 2 * (W < 500 ? EDGE_PHONE : EDGE)) / (n + (stones ? 1.2 : 0)), MAX_GAP, MAX_W / n);

// labelRows sets the labels of a line: their size, and one row or two. Every labelled mark keeps its label, no label
// is smaller than least, and two labels next to each other stand at least apart pixels apart. wide is the width of
// the widest label at size 1 and spacing the room from one labelled mark to the next. One row is chosen while it
// holds the labels at least's size, and two rows, with every other label on the second, where it does not.
export function labelRows(wide, spacing, { base, least = 10, apart = 4 }) {
  const fit = rows => Math.min(base, (rows * spacing - apart) / wide);
  const one = fit(1);
  return one >= least ? { font: one, rows: 1 } : { font: Math.max(least, fit(2)), rows: 2 };
}

// drawLine draws a line of label cards for a page with draw: a step of 2, 5 or 10, a left end that is a multiple of
// the step from the step up to 100 less 6 steps, and 6 gaps, so the line starts past zero and ends at 100 or below.
// Two marks next to each other carry labels, the second to the fifth mark with the one after it, so a blank lies on
// each side. The cards are the five blanks and one number that fits no mark, the number after the right label or
// before the left label, in an order that is not from least to greatest. A draw differs from the line in last.
export const DRAW_STEPS = [2, 5, 10], DRAW_GAPS = 6, DRAW_TOP = 100;
export function drawLine(dice, last = null) {
  for (;;) {
    const step = dice.pick(DRAW_STEPS), hi = (DRAW_TOP - DRAW_GAPS * step) / step, from = dice.int(1, hi) * step, k = dice.int(1, 4);
    const at = j => from + j * step, labels = [at(k), at(k + 1)];
    const blank = Array.from({ length: DRAW_GAPS + 1 }, (_, j) => at(j)).filter(n => !labels.includes(n));
    const odd = dice.pick([labels[1] + 1, labels[0] - 1]);
    const line = { from, to: at(DRAW_GAPS), step, labels, blank, cards: shuffled([...blank, odd], dice), odd };
    if (!last || last.from !== line.from || last.step !== line.step || last.labels[0] !== line.labels[0]) return line;
  }
}
