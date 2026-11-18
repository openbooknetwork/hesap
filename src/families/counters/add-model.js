// What a counters/add page holds and what it counts: two groups of counters in two ten frames, or counters taken
// away from one group, or the jars of a shop shelf, and the written lines of their calculation. The build and the
// browser both use this file, so a page's text and its live values agree.
import { PLUS, MINUS } from '../../kit/written.js';

// frames is two ten frames, shelf a shop shelf of jars of jam with two crates under it, and tray a seed tray of two
// rows of ten that fills as the frames do, the first row first.
export const ADD_LOOKS = ['frames', 'shelf', 'tray'];
// The two ten frames hold this many counters, and every counter of a page fits in them.
export const CELLS = 20;
// The shelf holds this many jars.
export const JARS = 10;
// A die shows a number from 1 to 6.
export const DIE = [1, 6];

const shelf = spec => spec.look === 'shelf';
// A seed tray with waiting has a packet of seeds beside it, and its written line writes the whole packet.
export const packet = spec => spec.look === 'tray' && spec.waiting != null;

// opening gives the counts as the page opens. first is the first group, or every counter of a take-away page, or
// the jars sold in the morning. second is the second group in the frames, the counters taken away, or the jars sold
// in the afternoon. waiting is the counters of the second group in the tray.
// ten says that the figure shows the full ten: on an addition the first frame is full, and on a take away every
// counter of the second frame is taken. The counters open in order, so they show it as the page opens.
export const opening = spec => ({ first: spec.first, second: spec.second, waiting: spec.waiting ?? 0, ten: true });

// stepsOf gives the two steps of making ten while the calculation crosses ten and the figure shows the ten: to-ten
// fills the ten or takes the first number down to it, and rest is the rest of the second number. It gives null
// otherwise, and on a page without written: ten.
export function stepsOf(spec, s) {
  if (spec.written !== 'ten' || !s.ten || (packet(spec) && s.waiting > 0)) return null;
  if (spec.take) {
    const left = s.first - s.second;
    if (s.first <= 10 || left >= 10) return null;
    const toTen = s.first - 10, rest = 10 - left;
    return { toTen, rest, lines: [{ a: s.first, sign: MINUS, b: toTen }, { a: 10, sign: MINUS, b: rest }] };
  }
  const sum = s.first + s.second;
  if (s.first >= 10 || sum <= 10) return null;
  const toTen = 10 - s.first, rest = sum - 10;
  return { toTen, rest, lines: [{ a: s.first, sign: PLUS, b: toTen }, { a: 10, sign: PLUS, b: rest }] };
}

// counts gives every number a page can show. A take-away page leaves first minus second, and the shelf leaves the
// jars that are not sold.
export function counts(spec, s) {
  const sum = s.first + s.second;
  const steps = stepsOf(spec, s);
  return { first: s.first, second: s.second, waiting: s.waiting, sum, left: spec.take ? s.first - s.second : shelf(spec) ? JARS - sum : null,
    'to-ten': steps?.toTen ?? null, rest: steps?.rest ?? null };
}

// lineOf gives the written line of the counters: first + second, or first − second on a take-away page. The line of
// a seed packet adds the seeds sown and in the packet, and takes its answer once the packet is empty.
export const lineOf = (spec, s) => packet(spec) ? { a: s.first, sign: PLUS, b: s.second + s.waiting, open: s.waiting > 0 }
  : { a: s.first, sign: spec.take ? MINUS : PLUS, b: s.second };
// leftOf gives the shelf's line of the jars left: the jars of a full shelf minus the jars sold.
export const leftOf = (spec, s) => ({ a: JARS, sign: MINUS, b: s.first + s.second });
// The lines a link reads, by its id: the written line, its words, and on the shelf the line of the jars left.
// A step line gives null while the steps do not show.
const step = k => (spec, s) => stepsOf(spec, s)?.lines[k] ?? null;
export const LINES = { written: lineOf, reading: lineOf, 'written-left': leftOf, 'reading-left': leftOf,
  'written-to-ten': step(0), 'reading-to-ten': step(0), 'written-rest': step(1), 'reading-rest': step(1) };

// The measures a page can read out and link in its text. The written lines and their words come with written.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  const lines = spec.written ? ['written', 'reading'] : [];
  if (spec.written === 'ten') lines.push('to-ten', 'rest', 'written-to-ten', 'reading-to-ten', 'written-rest', 'reading-rest');
  if (shelf(spec)) return ['first', 'second', 'sum', 'left', ...lines, ...(spec.written ? ['written-left', 'reading-left'] : [])];
  if (spec.take) return ['first', 'second', 'left', ...lines];
  return ['first', 'second', 'sum', ...(spec.waiting != null ? ['waiting'] : []), ...lines];
}

// The context of a page picks the names of its readouts and steppers, such as "Taken away" for second.
export const contextOf = spec => shelf(spec) ? 'shelf' : spec.take ? 'take' : 'add';
// labelKeys gives the strings that may name a readout or a stepper, the page's own first, so to-ten reads "Makes ten"
// on an addition and "Down to ten" on a take away. A dice page comes before the word sum, so its count has a plain name.
export const labelKeys = (spec, id) => [...(spec.dice ? [`add-dice-${id}`] : []), `add-${contextOf(spec)}-${id}`, `add-${id}`];
// goalKey gives a challenge's string for its kind of calculation: a subtraction of steps-to-ten has its own goal
// line and notes, which name Down to ten, and every other draw takes the plain key.
export const goalKey = (key, t, has) => t?.sign === '−' && has(`${key}-minus`) ? `${key}-minus` : key;
