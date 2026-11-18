// The Node half of the add scene: two groups of counters joined in two ten frames, counters taken away from one
// group, or the jars of a shop shelf, with the written lines of their calculation. It checks a page's fields and says
// what each link shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { ADD_LOOKS, CELLS, JARS, DIE, opening, counts, LINES, measuresOf } from './add-model.js';
import { ADD_GOALS, addStart } from './add-goals.js';
import { words, reading, DASH } from '../../kit/written.js';
import { numbers } from '../../kit/format.js';
import { list, value, string, challenge, drawn } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Stepper = z.object({ stepper: Range, start: Int.optional() }).strict();
const Fields = z.object({
  look: z.enum(ADD_LOOKS).default('frames'), // Two ten frames, or the shop shelf or the seed tray of a world page.
  first: z.union([Int, Stepper]).optional(), // The counters of the first group, round and red, as a number or on a stepper.
  second: z.union([Int, Stepper]).optional(), // The counters of the second group in the frames, square and blue.
  waiting: Int.optional(), // Counters of the second group that wait in a tray beside the frames.
  dice: z.boolean().default(false), // Two dice and a Roll button set the first group and the counters waiting.
  take: z.boolean().default(false), // The page takes counters away, and second counts the counters taken.
  // The written line under the frames, and with ten the two steps of making ten under it.
  written: z.union([z.literal(true), z.literal('ten')]).optional(),
  split: z.boolean().default(false), // A counter dropped on a frame joins that frame, so the reader splits the group.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of add-goals.js and the range it draws its target from.
  challenge: z.object({ goal: z.string(), first: Range.optional(), second: Range.optional(), sum: Range.optional() }).strict().optional(),
}).strict();

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const first = value(pg.first), second = value(pg.second);
  const spec = { ...pg, scene: 'add', first: first.n, firstCtl: first.ctl, second: second.n ?? 0, secondCtl: second.ctl, waiting: pg.waiting ?? null };
  if (pg.challenge) { readChallenge(pg, spec, at, ctx); return { data: spec, has: () => false, offers: 'nothing, a challenge page draws its numbers as it opens' }; }
  if (pg.look === 'shelf') return readShelf(pg, spec, first, second, fail);
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

// The shelf is a page of its own: the jars sold in the morning and in the afternoon as numbers, the written lines and
// the readouts.
function readShelf(pg, spec, first, second, fail) {
  for (const f of ['waiting', 'dice', 'take', 'split']) if (pg[f] !== undefined && pg[f] !== false) fail(`${f} belongs to the frames, the shelf takes first, second, written and readout`);
  if (pg.written === 'ten') fail('written: ten belongs to the frames and the seed tray, write written: true on the shelf');
  if (first.ctl || second.ctl || first.n == null || first.n < 0 || second.n < 0 || first.n + second.n > JARS) fail(`first and second are the jars sold in the morning and in the afternoon, write them as numbers that come to ${JARS} at most`);
  return offered(pg, spec, fail);
}

function offered(pg, spec, fail) {
  const ids = measuresOf(spec);
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids)}`);
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
