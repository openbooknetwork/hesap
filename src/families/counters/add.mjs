// The Node half of the add scene: two groups of counters joined in two ten frames, counters taken away from one
// group, or the jars of a shop shelf, with the written lines of their calculation. It checks a page's fields and says
// what each link shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { ADD_LOOKS, CELLS, JARS, DIE, EGGS, PIPS, PITCH, BENCH, opening, counts, LINES, measuresOf, family } from './add-model.js';
import { ADD_GOALS, addStart } from './add-goals.js';
import { words, reading, DASH, FACTS, FACT_IDS } from '../../kit/written.js';
import { numbers } from '../../kit/format.js';
import { list, value, string, challenge, drawn } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Stepper = z.object({ stepper: Range, start: Int.optional() }).strict();
const Fields = z.object({
  look: z.enum(ADD_LOOKS).default('frames'), // Two ten frames, or the shelf, the seed tray, the eggs, the domino or the squad.
  whole: z.union([Int, Stepper]).optional(), // The whole, with first as its known part and places for the missing part.
  first: z.union([Int, Stepper]).optional(), // The counters of the first group, round and red, as a number or on a stepper.
  second: z.union([Int, Stepper]).optional(), // The counters of the second group in the frames, square and blue.
  waiting: Int.optional(), // Counters of the second group that wait in a tray beside the frames.
  dice: z.boolean().default(false), // Two dice and a Roll button set the first group and the counters waiting.
  take: z.boolean().default(false), // The page takes counters away, and second counts the counters taken.
  // The written line under the frames, with ten the two steps of making ten under it, and with family the facts.
  written: z.union([z.literal(true), z.literal('ten'), z.literal('family')]).optional(),
  facts: z.array(z.enum(FACTS)).optional(), // The facts a family page writes, all four when left out.
  cover: z.boolean().default(false), // A tap on a half of the domino covers it with a card, and the line finds it.
  split: z.boolean().default(false), // A counter dropped on a frame joins that frame, so the reader splits the group.
  undo: z.boolean().default(false), // The join is done once the tray is empty, and counters sent back undo it.
  claim: z.union([Int, Stepper]).optional(), // A sum claimed for first + second, which the second line checks.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of add-goals.js and the range it draws its target from.
  challenge: z.object({ goal: z.string(), first: Range.optional(), second: Range.optional(), sum: Range.optional(), whole: Range.optional(), part: Range.optional() }).strict().optional(),
}).strict();

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const first = value(pg.first), second = value(pg.second), whole = value(pg.whole);
  const spec = { ...pg, scene: 'add', first: first.n, firstCtl: first.ctl, second: second.n ?? 0, secondCtl: second.ctl, waiting: pg.waiting ?? null, whole: whole.n, wholeCtl: whole.ctl };
  if (pg.challenge) { readChallenge(pg, spec, at, ctx); return { data: spec, has: () => false, offers: 'nothing, a challenge page draws its numbers as it opens' }; }
  if (pg.cover && pg.look !== 'domino') fail('cover belongs to the domino, write look: domino');
  if (pg.look === 'shelf') return readShelf(pg, spec, first, second, fail);
  if (pg.look === 'domino') return readDomino(pg, spec, first, second, fail);
  if (pg.facts && !family(pg)) fail('facts goes with written: family, write written: family or leave facts out');
  if (pg.facts && (!pg.facts.length || new Set(pg.facts).size < pg.facts.length)) fail(`facts lists ${list(pg.facts) || 'nothing'}, write each fact once, out of ${list(FACTS)}`);
  if (pg.whole !== undefined || pg.look === 'squad') return readWhole(pg, spec, first, whole, fail);
  if (pg.undo) readUndo(pg, first, fail);
  if (pg.claim !== undefined) return readClaim(pg, spec, first, second, fail);
  if (family(pg) || pg.look === 'eggs') for (const f of ['take', 'waiting', 'dice', 'split']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to other pages, ${family(pg) ? 'written: family' : 'the eggs'} takes first, second, written, facts and readout`);
  if (family(pg) && !['frames', 'eggs'].includes(pg.look)) fail(`written: family belongs to the frames and the eggs, this page shows ${pg.look}`);
  if (pg.look === 'eggs') {
    if (pg.written === 'ten') fail('written: ten belongs to the frames and the seed tray, write written: true or family on the eggs');
    const most = (first.ctl?.hi ?? first.n ?? 0) + (second.ctl?.hi ?? second.n ?? 0);
    if (most > EGGS) fail(`the eggs reach ${most}, and the box holds ${EGGS}, write first and second that come to ${EGGS} at most`);
  }
  if (pg.look === 'tray') for (const f of ['dice', 'take']) if (pg[f]) fail(`${f} belongs to the frames, the seed tray takes first, second, waiting, split, written and readout`);
  if (first.n == null) fail('first is missing, write the counters of the first group, such as 5, or { stepper: [0, 10], start: 4 }');
  for (const [v, name] of [[first, 'first'], [second, 'second']]) {
    if (v.n == null) continue;
    const lo = v.ctl?.lo ?? v.n, hi = v.ctl?.hi ?? v.n;
    if (lo > hi || v.n < lo || v.n > hi) fail(`${name} has the range [${lo}, ${hi}] and starts at ${v.n}, write [low, high] and a start between them`);
    else if (lo < 0 || hi > CELLS) fail(`${name} reaches ${v.ctl ? `[${lo}, ${hi}]` : v.n}, a group holds from 0 to ${CELLS} counters`);
  }
  if (pg.waiting != null) {
    if (pg.waiting < 1 || pg.waiting > CELLS) fail(`waiting is ${pg.waiting}, write the counters that wait in the tray as a number from 1 to ${CELLS}`);
    if (first.ctl || second.ctl) fail('waiting joins counters by hand, write first and second as numbers');
  }
  if (pg.dice) {
    if (pg.waiting == null) fail('dice throws the first group and the counters waiting, write waiting as well');
    if (pg.second !== undefined) fail('dice opens with no counter of the second group joined, leave second out');
    for (const [n, name] of [[first.n, 'first'], [pg.waiting, 'waiting']]) if (n != null && (n < DIE[0] || n > DIE[1])) fail(`${name} is ${n}, a die shows ${DIE[0]} to ${DIE[1]}, write a number a die shows`);
  }
  if (pg.split && (pg.waiting == null || (first.n ?? 0) >= 10)) fail('split splits the waiting counters between the two frames or the two rows, write waiting and a first group below 10');
  if (pg.take) {
    for (const f of ['waiting', 'dice', 'split']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} joins counters, a take-away page takes them away, leave ${f} out`);
    if (first.ctl && second.ctl) fail('first and second both have a stepper, give one of them a number');
    const most = second.ctl?.hi ?? second.n ?? 0, least = first.ctl?.lo ?? first.n ?? 0;
    if (most > least) fail(`second reaches ${most}, more than the ${least} counters of first, take away ${least} at most`);
  }
  const most = pg.take ? (first.ctl?.hi ?? first.n ?? 0) : (first.ctl?.hi ?? first.n ?? 0) + (second.ctl?.hi ?? second.n ?? 0) + (pg.waiting ?? 0);
  if (most > CELLS) fail(`the counters reach ${most}, and the two frames hold ${CELLS}`);
  return offered(pg, spec, fail);
}

// A page with a whole shows the known part as red counters and outlined places for the missing part, on the frames or
// as the pitch and the bench of the squad. One of whole and first may have a stepper.
function readWhole(pg, spec, first, whole, fail) {
  for (const f of ['second', 'waiting', 'take', 'dice', 'split', 'undo', 'claim']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to other pages, a page with a whole takes look, first, written, facts and readout`);
  if (!['frames', 'squad'].includes(pg.look)) fail(`whole belongs to the frames and the squad, this page shows ${pg.look}`);
  if (whole.n == null) return fail('whole is missing, the squad needs the whole, such as whole: 16 with first: 11'), offered(pg, spec, fail);
  if (first.n == null) return fail('first is missing, write the known part, such as 4, a number below the whole'), offered(pg, spec, fail);
  if (pg.written === 'ten') fail('written: ten belongs to pages without a whole, write written: true or family');
  if (first.ctl && whole.ctl) fail('whole and first both have a stepper, give one of them a number');
  for (const [v, name] of [[whole, 'whole'], [first, 'first']]) if (v.ctl && (v.ctl.lo > v.ctl.hi || v.n < v.ctl.lo || v.n > v.ctl.hi)) fail(`${name} has the range [${v.ctl.lo}, ${v.ctl.hi}] and starts at ${v.n}, write [low, high] and a start between them`);
  const wlo = whole.ctl?.lo ?? whole.n, whi = whole.ctl?.hi ?? whole.n, flo = first.ctl?.lo ?? first.n, fhi = first.ctl?.hi ?? first.n;
  if (wlo < 2 || whi > CELLS) fail(`whole reaches ${whole.ctl ? `[${wlo}, ${whi}]` : whi}, write a whole from 2 to ${CELLS}`);
  if (flo < 1 || fhi >= wlo) fail(`first reaches ${first.ctl ? `[${flo}, ${fhi}]` : fhi} with a whole of ${whole.ctl ? `[${wlo}, ${whi}]` : wlo}, write a known part from 1 to one less than the whole`);
  if (pg.look === 'squad') {
    if (whole.ctl || first.ctl) fail('the squad takes whole and first as numbers, write them without a stepper');
    if (family(pg)) fail('written: family belongs to the frames, write written: true on the squad');
    if (first.n > PITCH) fail(`first is ${first.n}, and ${PITCH} players are on the pitch at most`);
    if (whole.n - first.n > BENCH) fail(`the bench needs ${whole.n - first.n} seats, and it has ${BENCH}, write a whole at most ${BENCH} more than first`);
  }
  return offered(pg, spec, fail);
}

// An undo page joins the counters of the tray and then takes them back, on the frames with a written line.
// A claim page writes first + second with a sum on the stepper Sum, right or wrong, and checks it by subtracting the
// second part. The frames show the two parts.
function readClaim(pg, spec, first, second, fail) {
  const claim = value(pg.claim);
  Object.assign(spec, { claim: claim.n, claimCtl: claim.ctl });
  for (const f of ['waiting', 'take', 'dice', 'split', 'undo', 'cover', 'facts']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to other pages, a claim page takes first, second, claim, written: true and readout`);
  if (pg.look !== 'frames') fail(`claim belongs to the frames, this page shows ${pg.look}`);
  if (pg.written !== true) fail('claim writes the sum and its check under the frames, write written: true');
  if (first.ctl || second.ctl || first.n == null || pg.second === undefined) fail('claim checks a sum of fixed parts, write first and second as numbers');
  else if (first.n < 1 || second.n < 1 || first.n + second.n > CELLS) fail(`first and second are ${first.n} and ${second.n}, write two parts from 1 that come to ${CELLS} at most`);
  const lo = claim.ctl?.lo ?? claim.n, hi = claim.ctl?.hi ?? claim.n;
  if (claim.ctl && (lo > hi || claim.n < lo || claim.n > hi)) fail(`claim has the range [${lo}, ${hi}] and starts at ${claim.n}, write [low, high] and a start between them`);
  else if (lo < (second.n ?? 0) || hi > 2 * CELLS) fail(`claim reaches ${claim.ctl ? `[${lo}, ${hi}]` : lo}, write sums from ${second.n ?? 0}, the second part, to ${2 * CELLS}, so the check takes the second part away`);
  return offered(pg, spec, fail);
}

function readUndo(pg, first, fail) {
  if (pg.look !== 'frames') fail(`undo belongs to the frames, this page shows ${pg.look}`);
  if (first.ctl || first.n == null || pg.waiting == null) fail('undo joins the counters of the tray by hand, write first and waiting as numbers');
  for (const f of ['second', 'take', 'dice', 'split']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to other pages, undo takes first, waiting, written: true and readout`);
  if (pg.written !== true) fail('undo writes the join and the take away under the frames, write written: true');
}

// The shelf is a page of its own: the jars sold in the morning and in the afternoon as numbers, the written lines and
// the readouts.
function readShelf(pg, spec, first, second, fail) {
  for (const f of ['waiting', 'dice', 'take', 'split']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to the frames, the shelf takes first, second, written and readout`);
  if (pg.written && pg.written !== true) fail(`written: ${pg.written} belongs to the frames, write written: true on the shelf`);
  if (first.ctl || second.ctl || first.n == null || first.n < 0 || second.n < 0 || first.n + second.n > JARS) fail(`first and second are the jars sold in the morning and in the afternoon, write them as numbers that come to ${JARS} at most`);
  return offered(pg, spec, fail);
}

// The domino shows two halves of pips as numbers, and may cover a half and write the line.
function readDomino(pg, spec, first, second, fail) {
  for (const f of ['waiting', 'dice', 'take', 'split', 'facts']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to other pages, the domino takes first, second, cover, written and readout`);
  if (pg.written && pg.written !== true) fail(`written: ${pg.written} belongs to the frames, write written: true on the domino`);
  for (const [v, name] of [[first, 'first'], [second, 'second']]) if (v.ctl || v.n == null || v.n < PIPS[0] || v.n > PIPS[1]) fail(`${name} is the pips of a half, write it as a number from ${PIPS[0]} to ${PIPS[1]}`);
  return offered(pg, spec, fail);
}

// A page reads out its counts and its lines. The facts of a family page take no readout, since the figure writes them.
function offered(pg, spec, fail) {
  const ids = measuresOf(spec), shown = family(spec) ? ids.filter(id => !FACT_IDS.includes(id)) : ids;
  for (const id of pg.readout) if (!shown.includes(id)) fail(`readout names "${id}", this page reads out ${list(shown)}`);
  return { data: spec, has: id => ids.includes(id), offers: `one of ${list(ids)}` };
}

// A challenge page names its goal and the range the goal draws from, and may write the line once the goal holds. It
// leaves every other field out, and the goal gives the page its steppers.
function readChallenge(pg, spec, at, ctx) {
  const c = pg.challenge, goal = challenge(c, ADD_GOALS, { scene: 'add', at, ctx });
  if (!goal) return;
  for (const [f, v] of Object.entries(pg)) if (!['challenge', 'look', 'written'].includes(f) && v !== undefined && v !== false && !(f === 'readout' && !v.length)) ctx.fail(at, `${f} is set by challenge.goal ${c.goal}, leave it out`);
  if (pg.look !== 'frames') ctx.fail(at, `look is set by challenge.goal ${c.goal}, leave it out`);
  const problem = goal.problem(c);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  drawn(goal, c, spec, { at, ctx, starts: addStart });
}

// A link shows a count, a written line or its words as the page opens.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  const s = opening(spec), int = numbers(lang).int;
  const line = LINES[id]?.(spec, s), n = counts(spec, s)[id];
  if (id.startsWith('written')) return line ? words(line, int) : DASH;
  if (id.startsWith('reading')) return line ? reading(line, int, (key, vars) => string(lang, `hesap_${key}`, vars)) : DASH;
  return n == null ? DASH : int(n);
}

export default { read, start };
