// The Node half of the line family. Its one scene draws a number line with marks at equal gaps and a point the
// reader drags or jumps. It checks a page's fields and says what each link shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { LOOKS, isFree, gapsKey, writtenOf, labelKeep, posOf, gapOn, LABELS_APART, PHONE, STONES_TO, GAPS, isStones, isMark, gapsOf, labelled, cardsOf, middleOf, findsOf, opening, counts, measuresOf, readoutsOf, readingOf } from './model.js';
import { GOALS, challengeStart } from './goals.js';
import { numbers } from '../../kit/format.js';
import { words, reading, DASH } from '../../kit/written.js';
import { list, string, value, challenge, drawn } from '../../node.mjs';

const { z, check } = schema;
// The longest line a page with moved marks takes: on a 390px phone a longer one leaves no room for a mark off its
// place a third of a gap with its label 10px from the next.
const MOVED_TO = 12;
const Int = z.number().int();
const Fields = z.object({
  look: z.enum(LOOKS).default('line'), // The number line, or the frog's stones for the opening pages.
  from: Int.min(0).default(0), // The number at the left end.
  to: Int.optional(), // The number at the right end, at the page's own step.
  // The number between two marks next to each other, or a row of steps the reader picks from.
  step: z.union([Int.min(1), z.object({ segment: z.array(Int.min(1)).min(2), start: Int.optional() }).strict()]).default(1),
  marks: z.enum(['all', 'ends']).default('all'), // A mark at every step, or at the two ends alone for an unmarked line.
  // Every mark carries its number, or the two ends alone, or the multiples of a number, or the numbers of a list.
  labels: z.union([z.enum(['all', 'ends']), Int.min(1), z.array(Int)]).optional(),
  blank: z.array(Int).default([]), // Marks that carry an empty label box.
  cards: z.union([z.literal(true), z.array(Int)]).optional(), // Label cards the reader drags onto the blank marks.
  point: z.union([Int, z.literal(false)]).optional(), // The mark the point starts on, the left end when left out, or no point.
  start: Int.optional(), // The start of the jumps, a ring the reader drags, which the point takes when point is left out.
  // The written line of the jumps under the line, or of the difference of the start and the second point.
  written: z.union([z.literal(true), z.literal('difference')]).optional(),
  second: Int.optional(), // A second point, of another shape and colour.
  flag: z.boolean().default(false), // Each point carries its number in a flag above it.
  reading: z.boolean().default(false), // A line of words says which point's number comes later in the count.
  jump: z.boolean().default(false), // Jump left and Jump right move the point one gap and draw an arc over it.
  bracket: z.literal(10).optional(), // A bracket from the ten before the point to the ten after it.
  open: z.boolean().default(false), // A tap on a gap opens it under the line, with a mark for every number in it.
  middle: z.union([z.boolean(), z.literal('button')]).default(false), // The middle's long mark, or a button that draws it.
  find: z.union([Int, z.array(Int).min(1)]).optional(), // The number to place, or a list of them, with Show and Next.
  // The reader's estimate of the number at the point, on a stepper or a slider, with its estimate mark.
  estimate: z.union([z.object({ stepper: z.tuple([Int, Int]), start: Int.optional() }).strict(), z.object({ slider: z.tuple([Int, Int]), start: Int.optional() }).strict()]).optional(),
  // Marks that start off their places, each by a part of a gap, for the reader to drag back.
  moved: z.array(z.object({ mark: Int, by: z.number() }).strict()).min(1).optional(),
  draw: z.boolean().default(false), // A line of label cards drawn at random, with New line to draw another.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of goals.js and the ranges it draws from.
  challenge: z.object({ goal: z.string(), target: z.tuple([Int, Int]).optional(), step: z.array(Int).optional(), from: z.tuple([Int, Int]).optional(), to: z.tuple([Int, Int]).optional(),
    start: z.tuple([Int, Int]).optional(), add: z.tuple([Int, Int]).optional(), subtract: z.tuple([Int, Int]).optional() }).strict().optional(),
}).strict();

function read({ scene, ...fields }, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words), step = value(pg.step), est = value(pg.estimate);
  // The book is an unmarked line. An unmarked line labels its ends unless the page says otherwise.
  const marks = pg.look === 'book' ? 'ends' : pg.marks;
  const spec = { ...pg, scene, marks, labels: pg.labels ?? (marks === 'ends' ? 'ends' : 'all'), step: step.n, stepCtl: step.ctl, estimate: est.n, estimateCtl: est.ctl };
  const done = () => { const ids = measuresOf(spec); return { data: spec, has: id => ids.includes(id), offers: ids.length ? `one of ${list(ids)}` : 'nothing, a challenge page draws its numbers as it opens' }; };
  // A page that draws its line of cards takes no field of the line, and the browser draws it as the page opens.
  if (pg.draw) {
    for (const f of ['from', 'to', 'step', 'labels', 'blank', 'cards', 'point', 'marks', 'second', 'flag', 'reading', 'jump', 'bracket', 'open', 'middle', 'find', 'estimate', 'challenge', 'start', 'written', 'moved']) if (fields[f] !== undefined) fail(`${f} is drawn with the line on a page with draw, leave it out`);
    if (pg.look !== 'line') fail(`look is ${pg.look}, a page with draw shows the line look, leave look out`);
    const outs = readoutsOf(spec);
    for (const id of pg.readout) if (!outs.includes(id)) fail(`readout names "${id}", this page reads out ${list(outs)}`);
    return done();
  }
  // A goal that draws its line takes no line from the page.
  if (pg.challenge && GOALS[pg.challenge.goal]?.draws) { readDrawn(fields, pg, spec, at, ctx); return done(); }
  if (spec.to === undefined) { fail('to is missing, write the number at the right end, such as 20'); return done(); }
  if (step.ctl) {
    const items = step.ctl.items;
    if (items.some((v, i) => i && v <= items[i - 1])) fail(`step.segment is [${items}], write different steps from the least to the greatest, such as [1, 2, 5, 10]`);
    if (!items.includes(spec.step)) fail(`step.start is ${spec.step}, write one of the steps ${list(items)}`);
    if (spec.labels !== 'all') fail('labels is set on a page whose reader picks the step, and such a page labels every mark, leave labels out');
    for (const f of ['blank', 'cards', 'bracket']) if (fields[f] !== undefined) fail(`${f} belongs to a line of one step, write step as a number`);
  }
  if (spec.to <= spec.from) return fail(`to is ${spec.to}, write a number above the left end ${spec.from}`), done();
  if (!Number.isInteger(gapsOf(spec))) return fail(`to is ${spec.to}, and to minus from is ${spec.to - spec.from}, write a right end that is a whole number of steps of ${spec.step} from ${spec.from}`), done();
  if (!isFree(spec) && gapsOf(spec) > GAPS) fail(`to is ${spec.to}, which gives ${gapsOf(spec)} gaps, and a marked line holds at most ${GAPS}`);
  if (Number.isInteger(spec.labels) && spec.labels % spec.step) fail(`labels is ${spec.labels}, write a multiple of the step ${spec.step}, so each labelled number is a mark of the line`);
  if (Array.isArray(spec.labels)) for (const n of spec.labels) if (!isMark(spec, n)) fail(`labels lists ${n}, which is no mark of the line from ${spec.from} to ${spec.to} in steps of ${spec.step}`);
  for (const n of pg.blank) if (!isMark(spec, n) || labelled(spec, n)) fail(`blank lists ${n}, write marks of the line that carry no label`);
  if (pg.cards !== undefined) {
    const cards = cardsOf(spec);
    if (!pg.blank.length) fail('cards go with blank, write the marks whose labels the cards fill');
    if (new Set(cards).size !== cards.length) fail(`cards is [${cards}], write each number once`);
    for (const n of pg.blank) if (!cards.includes(n)) fail(`cards leaves out ${n}, write a card for every blank mark`);
  }
  if (isStones(spec)) {
    if (spec.to > STONES_TO) fail(`to is ${spec.to}, and the ${spec.look} look holds at most ${STONES_TO} stones`);
    for (const f of ['from', 'step', 'labels', 'second', 'blank', 'cards', 'bracket', 'open', 'middle', 'find', 'challenge']) if (fields[f] !== undefined) fail(`${f} belongs to the line look, the ${spec.look} look takes to, point, jump and readout`);
    for (const f of ['flag', 'reading']) if (pg[f]) fail(`${f} belongs to the line look, the ${spec.look} look takes to, point, jump and readout`);
    if (pg.point === false) fail(`point is false, and the ${spec.look} look shows the frog as the point, write a number`);
  }
  for (const f of ['point', 'second']) {
    const n = pg[f];
    if (n !== undefined && n !== false && !isMark(spec, n)) fail(`${f} is ${n}, write a number on a mark from ${spec.from} to ${spec.to}`);
  }
  if (pg.point === false) for (const f of ['jump', 'second', 'bracket', 'flag', 'reading']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} moves or reads the point, and point is false, write the point's start or leave ${f} out`);
  if (pg.start !== undefined) {
    if (!pg.jump) fail('start is the start of the jumps, write jump: true');
    if (spec.look !== 'line' || isFree(spec)) fail(`start takes a marked line in the line look, this page has look ${spec.look}${isFree(spec) ? ' and marks: ends' : ''}`);
    if (!isMark(spec, pg.start)) fail(`start is ${pg.start}, write a number on a mark from ${spec.from} to ${spec.to}`);
    if (pg.point === false) fail(`start carries the point, write the point's place or leave point out`);
    if (pg.challenge) fail(`start is drawn by challenge.goal ${pg.challenge.goal}, leave it out`);
  }
  if (pg.written !== undefined) {
    if (!pg.jump) fail('written writes the jumps, write jump: true');
    if (pg.reading) fail('reading is the written line in words on a page with written, leave the field reading out');
    if (pg.written === 'difference' && pg.second === undefined) fail('written: difference writes the second point minus the start, write second as well');
    // The page counts on from the start to the second point, so the second point is the greater number.
    else if (pg.written === 'difference' && pg.start !== undefined && pg.second <= pg.start) fail(`second is ${pg.second}, at or left of the start ${pg.start}, and the page counts on from the start, write a second point greater than the start, such as ${Math.min(spec.to, pg.start + 5)}`);
  }
  if (pg.second !== undefined && !pg.flag) fail('second goes with flag, write flag: true so each point shows its number');
  if (pg.reading && pg.second === undefined) fail('reading compares two points, write second as well');
  if (pg.bracket) {
    if (10 % spec.step || spec.from % 10 || spec.to % 10) fail(`bracket reaches from a ten to a ten, which are marks of the line when from and to are tens and the step is 1, 2, 5 or 10, this line runs from ${spec.from} to ${spec.to} in steps of ${spec.step}`);
    else if (!Array.from({ length: (spec.to - spec.from) / 10 + 1 }, (_, i) => spec.from + 10 * i).every(n => labelled(spec, n))) fail('bracket lights the labels of two tens, label every ten, such as with labels: 10');
  }
  if (isFree(spec)) {
    if (spec.labels !== 'ends') fail('labels of an unmarked line are its ends, which carry the only marks, leave labels out');
    for (const f of ['step', 'second', 'jump', 'bracket', 'open', 'blank', 'cards']) if (fields[f] !== undefined) fail(`${f} takes a marked line, and marks is ends, leave ${f} out or write marks: all`);
    if (isStones(spec) || spec.look === 'street') fail(`marks is ends, and the ${spec.look} look has a mark at every step, leave marks out`);
  }
  if (spec.look === 'book') for (const f of ['marks', 'labels', 'step', 'second', 'flag', 'reading', 'jump', 'bracket', 'open', 'blank', 'cards', 'middle', 'estimate', 'challenge']) if (fields[f] !== undefined) fail(`${f} belongs to the line look, the book look takes from, to, point, find and readout`);
  if (est.ctl) {
    const { lo, hi } = est.ctl;
    if (!isFree(spec)) fail('estimate takes an unmarked line, write marks: ends');
    if (lo > hi || spec.estimate < lo || spec.estimate > hi) fail(`estimate has the range [${lo}, ${hi}] and starts at ${spec.estimate}, write [low, high] and a start between them`);
    else if (lo < spec.from || hi > spec.to) fail(`estimate reaches [${lo}, ${hi}], write a range inside the line from ${spec.from} to ${spec.to}`);
    for (const f of ['jump', 'find']) if (fields[f] !== undefined) fail(`${f} belongs to pages without an estimate, an estimate page leaves the point where it is`);
    if (pg.point === false) fail(`estimate is of the number at the point, write the point's place`);
  }
  if (spec.look === 'street') {
    if (!Array.isArray(spec.labels)) fail('labels of the street look are the door numbers it shows, write them as a list, such as [1, 20, 50, 60]');
    for (const f of ['step', 'second', 'jump', 'bracket', 'open', 'blank', 'cards', 'middle', 'challenge']) if (fields[f] !== undefined) fail(`${f} belongs to the line look, the street look takes from, to, labels, point, find and readout`);
    for (const f of ['flag', 'reading']) if (pg[f]) fail(`${f} belongs to the line look, the street look takes from, to, labels, point, find and readout`);
  }
  if (pg.middle) {
    if (gapsOf(spec) % 2) fail(`middle is set, and the line from ${spec.from} to ${spec.to} has ${gapsOf(spec)} gaps, so its middle is no mark, write ends an even number of steps apart`);
    if (spec.look !== 'line') fail(`middle belongs to the line look, leave it out of the ${spec.look} look`);
    if (labelled(spec, middleOf(spec))) fail(`middle draws the label of ${middleOf(spec)}, which labels already gives, leave middle out or the label out`);
  }
  if (pg.find !== undefined) {
    for (const n of findsOf(spec)) {
      if (!isMark(spec, n)) fail(`find has ${n}, write numbers on marks from ${spec.from} to ${spec.to}`);
      else if (labelled(spec, n) || (pg.middle && n === middleOf(spec))) fail(`find has ${n}, which carries a label, write numbers whose marks have none`);
    }
    for (const f of ['second', 'flag', 'reading']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to pages without find, a find page shows the number at the point once the reader presses Show`);
    if (pg.challenge) fail('find belongs to pages without a challenge, leave it out');
  }
  if (pg.moved) {
    if (spec.look !== 'line' || spec.from !== 0 || spec.stepCtl || spec.step !== 1 || spec.labels !== 'all' || spec.to < 4 || spec.to > MOVED_TO) fail(`moved takes the line look from 0 in steps of 1 with every mark labelled and to from 4 to ${MOVED_TO}, so a mark off its place keeps its label ${LABELS_APART}px from the next on a phone, this page has look ${spec.look}, from ${spec.from}, to ${spec.to} and step ${spec.step}`);
    for (const f of ['second', 'blank', 'cards', 'bracket', 'middle', 'find', 'estimate', 'challenge', 'marks']) if (fields[f] !== undefined) fail(`${f} belongs to pages without moved, a moved page takes point, jump and readout`);
    for (const f of ['flag', 'reading', 'open']) if (pg[f]) fail(`${f} belongs to pages without moved, a moved page takes point, jump and readout`);
    const marks = pg.moved.map(m => m.mark).sort((a, b) => a - b);
    for (const m of pg.moved) {
      if (!Number.isInteger(m.mark) || m.mark <= spec.from || m.mark >= spec.to) fail(`moved has the mark ${m.mark}, write a mark between the ends ${spec.from} and ${spec.to}`);
      if (Math.abs(m.by) < 0.3 || Math.abs(m.by) > 0.6) fail(`moved has ${m.mark} by ${m.by}, write by from 0.3 to 0.6 in size, so the page opens with a gap that looks wrong`);
    }
    if (marks.some((m, i) => i && m - marks[i - 1] < 2)) fail(`moved lists the marks ${marks.join(', ')}, write marks with no two next to each other or the same`);
    // On a 390px phone the labels of two marks next to each other stand at least LABELS_APART pixels apart as the page opens.
    else if (spec.to >= 4 && spec.to <= MOVED_TO) {
      const s = opening(spec), keep = labelKeep(spec, PHONE), gap = gapOn(PHONE, gapsOf(spec), false);
      for (let k = 0; k < gapsOf(spec); k++) {
        const d = posOf(s, k + 1) - posOf(s, k);
        // The largest by that keeps them apart, and when that is below the least by of 0.3, no by fits this mark.
        const most = Math.floor((1 - keep(k, k + 1)) * 100) / 100;
        const way = most >= 0.3 ? `write a by that leaves them ${LABELS_APART}px apart, such as one of at most ${most} in size` : `no by from 0.3 to 0.6 leaves them ${LABELS_APART}px apart, move another mark or shorten the line`;
        if (d < keep(k, k + 1) - 1e-9) fail(`moved puts the labels of ${k} and ${k + 1} about ${Math.max(0, Math.round((d - keep(k, k + 1)) * gap + LABELS_APART))}px apart on a 390px phone, where they would read as one number, ${way}`);
      }
    }
  }
  if (pg.open && spec.step === 1) fail('open shows the numbers inside a gap, and a line in ones has none, write a step above 1');
  if (pg.challenge) readChallenge(pg, spec, at, ctx);
  const outs = readoutsOf(spec);
  for (const id of pg.readout) if (!outs.includes(id)) fail(`readout names "${id}", this page reads out ${list(outs) || 'nothing'}`);
  return done();
}

// A challenge page names its goal and the range it draws from. The reader finds the target with the drag and the
// jumps, so the page shows no number that gives it away. Every target it can draw must be open as the page starts.
function readChallenge(pg, spec, at, ctx) {
  const c = pg.challenge, goal = goalOf(c, at, ctx);
  if (!goal) return;
  const fail = words => ctx.fail(at, words);
  if (pg.look !== 'line') fail(`look is ${pg.look}, a challenge page shows the line look, leave look out`);
  if (pg.readout.length) fail(`readout names ${list(pg.readout)}, and a challenge page shows no readouts, which would give the answer away, leave readout out`);
  for (const f of ['flag', 'reading']) if (pg[f]) fail(`${f} would give the answer away, a challenge page shows the point's number once the goal holds, leave ${f} out`);
  for (const f of ['second', 'blank', 'cards', 'bracket']) if (f === 'blank' ? pg.blank.length : pg[f] !== undefined) fail(`${f} belongs to pages without a challenge, leave it out`);
  if (pg.point === false) fail('point is false, and the reader places the point, write its start or leave point out');
  if (spec.stepCtl) fail(`step is a segment, write the step of the challenge's line as a number`);
  // jump-to asks for a calculation whose answer every label may show, as the reader counts the jumps.
  if (spec.labels === 'all' && !goal.labels) fail(`labels is all, so every target would carry its label, write the labels of the line, such as labels: 10`);
  const problem = goal.problem(c, spec);
  if (problem) return fail(`challenge.${problem}`);
  drawn(goal, c, spec, { at, ctx, starts: (s, t) => challengeStart(s, t) });
}
// A goal that draws its line takes the challenge alone, with no field of the line.
function readDrawn(fields, pg, spec, at, ctx) {
  const c = pg.challenge, goal = goalOf(c, at, ctx);
  if (!goal) return;
  for (const f of Object.keys(fields)) if (f !== 'challenge' && !(goal.takes ?? []).includes(f)) ctx.fail(at, `${f} is drawn by challenge.goal ${c.goal}, which draws the line, leave it out`);
  if (fields.middle !== undefined && fields.middle !== 'button') ctx.fail(at, `middle is ${JSON.stringify(fields.middle)}, write middle: button, so the reader draws the middle of the line the goal draws`);
  const problem = goal.problem(c, spec);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  if (!goal.lines(c).length) return ctx.fail(at, `challenge.goal ${c.goal} draws no line, as ${goal.noLine(c)}, widen the ranges`);
  drawn(goal, c, spec, { at, ctx, starts: (s, t) => challengeStart(s, t) });
}
function goalOf(c, at, ctx) {
  const goal = challenge(c, GOALS, { scene: 'line', at, ctx });
  if (goal) for (const f of Object.keys(c)) if (f !== 'goal' && !goal.fields.includes(f)) ctx.fail(at, `challenge.${f} belongs to another goal, ${c.goal} draws from ${list(goal.fields)}`);
  return goal;
}

// A link shows a number or the line of words as the page opens. The ten before and the ten after read a dash
// while the point is on a ten.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  const s = opening(spec), int = numbers(lang).int;
  if (id === 'gaps') return string(lang, `line_${gapsKey(s)}`);
  if (id === 'written' || id === 'reading' && spec.written) { const w = writtenOf(spec, s); return id === 'written' ? words(w, int) : reading(w, int, (key, vars) => string(lang, `hesap_${key}`, vars)); }
  if (id === 'reading') { const r = readingOf(spec, s); return string(lang, `line_${r.key}`, { a: int(r.a), b: int(r.b) }); }
  const v = counts(spec, s)[id];
  return v === null ? DASH : int(v);
}

// The two points: a red round one and a blue square one, each with a step for the dark themes.
const bundle = () => ({ families: { 'line-point': { color: '#d1453b', color_dark: '#f0776d' }, 'line-second': { color: '#2a6bd1', color_dark: '#6fa4f5' } } });

export default { id: 'line', scenes: ['line'], schema: z.object({}).passthrough(), read, start, bundle };
