// What a counters/add page holds and what it counts: two groups of counters in two ten frames, or counters taken
// away from one group, or the jars of a shop shelf, and the written lines of their calculation. The build and the
// browser both use this file, so a page's text and its live values agree.
import { PLUS, MINUS, FACTS, FACT_IDS, factLine, finding } from '../../kit/written.js';

// frames is two ten frames, shelf a shop shelf of jars of jam with two crates under it, and tray a seed tray of two
// rows of ten that fills as the frames do, the first row first. eggs is a box of ten eggs that fills as one ten frame
// does, and domino one domino whose two halves show the two groups as pips. squad is a football pitch with the players
// of the known part and a bench where the players of the missing part sit down.
export const ADD_LOOKS = ['frames', 'shelf', 'tray', 'eggs', 'domino', 'squad'];
// A team has this many players on the pitch, and the bench of the squad holds this many players at most.
export const PITCH = 11, BENCH = 9;
// The egg box holds this many eggs, and a half of a domino shows from 1 to 6 pips.
export const EGGS = 10;
export const PIPS = [1, 6];
// The two ten frames hold this many counters, and every counter of a page fits in them.
export const CELLS = 20;
// The shelf holds this many jars.
export const JARS = 10;
// A die shows a number from 1 to 6.
export const DIE = [1, 6];

const shelf = spec => spec.look === 'shelf';
// A family page writes the facts of its two groups.
export const family = spec => spec.written === 'family';
// A claim page writes the parts with a sum the reader claims, and checks it by taking the second part away again.
export const claims = spec => spec.claim != null;
// A page with a whole has outlined places for the missing part, which taps fill.
export const fills = spec => spec.whole != null;
// A seed tray with waiting has a packet of seeds beside it, and its written line writes the whole packet.
export const packet = spec => spec.look === 'tray' && spec.waiting != null;

// opening gives the counts as the page opens. first is the first group, or every counter of a take-away page, or
// the jars sold in the morning. second is the second group in the frames, the counters taken away, or the jars sold
// in the afternoon. waiting is the counters of the second group in the tray.
// ten says that the figure shows the full ten: on an addition the first frame is full, and on a take away every
// counter of the second frame is taken. The counters open in order, so they show it as the page opens.
// On a cover page, cover is the half under the card, and found the number the written line finds, which it keeps
// once the card is lifted. On a claim page, claim is the sum the reader claims. On a page with a whole, whole is the whole and second the counters put in. On an undo page,
// done says that the join is done, which happens once the tray is empty for the first time.
export const opening = spec => ({ first: spec.first, second: spec.second, waiting: spec.waiting ?? 0, ten: true, cover: null, found: null, whole: spec.whole ?? null, done: false, claim: spec.claim ?? null });

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
// A page with a whole counts the missing part, and an undo page the counters taken back and left once the join is done.
export function counts(spec, s) {
  const sum = s.first + s.second;
  const steps = stepsOf(spec, s), undone = spec.undo && s.done;
  return { first: s.first, second: s.second, waiting: s.waiting, sum, whole: fills(spec) ? s.whole : sum,
    left: spec.take ? s.first - s.second : shelf(spec) ? JARS - sum : undone ? sum : null,
    missing: fills(spec) ? s.whole - s.first : null, back: undone ? s.waiting : null, claim: claims(spec) ? s.claim : null,
    'to-ten': steps?.toTen ?? null, rest: steps?.rest ?? null };
}

// lineOf gives the written line of the counters: first + second, or first − second on a take-away page. The line of
// a seed packet adds the seeds sown and in the packet, and takes its answer once the packet is empty.
// A cover page writes the addition until a half is covered, then the calculation that finds the covered half, open
// while the card is on.
// A page with a whole writes the subtraction that asks for the missing part, and a family page with a whole the first
// fact of its family. An undo page keeps the line of the join once it is done.
export const lineOf = (spec, s) => spec.cover && s.found ? finding(s.first, s.second, s.found, s.cover != null)
  : claims(spec) ? { a: s.first, sign: PLUS, b: s.second, c: s.claim }
  : fills(spec) ? (family(spec) ? factLine('written', s.first, s.whole - s.first) : askOf(spec, s))
  : spec.undo && s.done ? { a: s.first, sign: PLUS, b: s.second + s.waiting }
  : packet(spec) ? { a: s.first, sign: PLUS, b: s.second + s.waiting, open: s.waiting > 0 }
  : { a: s.first, sign: spec.take ? MINUS : PLUS, b: s.second };
// askOf gives the subtraction that asks for the missing part, whole − first, open until every place is filled. Each
// number carries the link id of what it counts.
export const askOf = (spec, s) => ({ a: s.whole, sign: MINUS, b: s.first, open: s.second < s.whole - s.first, refs: { a: 'whole', b: 'first', c: 'missing' } });
// full says that every place of the missing part is filled.
export const full = s => s.second === s.whole - s.first;
// backOf gives the line that undoes the join: the sum of the join minus the counters taken back, once one is back.
// On a claim page it is the check of the claimed sum: the claim minus the second part.
export const backOf = (spec, s) => claims(spec) ? { a: s.claim, sign: MINUS, b: s.second } : spec.undo && s.done && s.waiting > 0 ? { a: s.first + s.second + s.waiting, sign: MINUS, b: s.waiting } : null;
// checked says whether the check of a claim page gives back the first part, so the claimed sum is right.
export const checked = s => s.claim - s.second === s.first;
// leftOf gives the shelf's line of the jars left: the jars of a full shelf minus the jars sold.
export const leftOf = (spec, s) => ({ a: JARS, sign: MINUS, b: s.first + s.second });
// The lines a link reads, by its id: the written line, its words, and on the shelf the line of the jars left.
// A step line gives null while the steps do not show.
const step = k => (spec, s) => stepsOf(spec, s)?.lines[k] ?? null;
// The facts of a family page beside the first addition, which is the written line. With a whole they are the facts of
// the known part and the missing part from the start, whatever the counters put in.
const fact = id => (spec, s) => factLine(id, s.first, fills(spec) ? s.whole - s.first : s.second);
export const LINES = { written: lineOf, reading: lineOf, 'written-left': leftOf, 'reading-left': leftOf, 'written-back': backOf, 'reading-back': backOf,
  'written-to-ten': step(0), 'reading-to-ten': step(0), 'written-rest': step(1), 'reading-rest': step(1),
  ...Object.fromEntries(FACT_IDS.filter(id => !['written', 'reading'].includes(id)).map(id => [id, fact(id)])) };

// The measures a page can read out and link in its text. The written lines and their words come with written.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  const lines = spec.written ? ['written', 'reading'] : [];
  if (fills(spec)) return ['first', 'second', 'whole', 'missing', ...(family(spec) ? FACT_IDS : lines)];
  if (claims(spec)) return ['first', 'second', 'claim', 'written', 'reading', 'written-back', 'reading-back'];
  if (spec.undo) return ['first', 'second', 'sum', 'waiting', 'back', 'left', ...lines, 'written-back', 'reading-back'];
  if (spec.written === 'ten') lines.push('to-ten', 'rest', 'written-to-ten', 'reading-to-ten', 'written-rest', 'reading-rest');
  if (family(spec)) return ['first', 'second', 'whole', ...FACT_IDS];
  if (spec.look === 'domino') return ['first', 'second', 'whole', ...lines];
  if (shelf(spec)) return ['first', 'second', 'sum', 'left', ...lines, ...(spec.written ? ['written-left', 'reading-left'] : [])];
  if (spec.take) return ['first', 'second', 'left', ...lines];
  return ['first', 'second', 'sum', ...(spec.waiting != null ? ['waiting'] : []), ...lines];
}

// The context of a page picks the names of its readouts and steppers, such as "Taken away" for second.
// A family page and the eggs name their groups as parts, and the domino as halves. A page with a whole names the known
// part and the missing part, and an undo page the counters taken back.
export const contextOf = spec => shelf(spec) ? 'shelf' : spec.look === 'squad' ? 'squad' : fills(spec) ? 'whole' : spec.undo ? 'undo' : spec.look === 'domino' ? 'domino' : family(spec) || spec.look === 'eggs' ? 'family' : spec.take ? 'take' : 'add';
// The facts a family page writes, all four when it lists none.
export const factsListed = spec => spec.facts ?? FACTS;
// labelKeys gives the strings that may name a readout or a stepper, the page's own first, so to-ten reads "Makes ten"
// on an addition and "Down to ten" on a take away. A dice page comes before the word sum, so its count has a plain name.
export const labelKeys = (spec, id) => [...(spec.dice ? [`add-dice-${id}`] : []), `add-${contextOf(spec)}-${id}`, `add-${id}`];
// goalKey gives a challenge's string for its kind of calculation: a subtraction of steps-to-ten has its own goal
// line and notes, which name Down to ten, and every other draw takes the plain key.
export const goalKey = (key, t, has) => t?.sign === '−' && has(`${key}-minus`) ? `${key}-minus` : key;
