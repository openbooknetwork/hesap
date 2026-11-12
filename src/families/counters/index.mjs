// The Node half of the counters family: counters a reader moves between parts, cells of ten frames, and the skins of
// the same figure for the world pages. It checks a page's fields against its scene and says what each link shows
// when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { LOOKS, modeOf, capOf, opening, counts, measuresOf } from './model.js';
import { GOALS, challengeStart } from './goals.js';
import { numbers } from '../../kit/format.js';
import { list, challenge, drawn } from '../../node.mjs';

const { z } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Slider = z.object({ slider: Range, start: Int.optional() }).strict();
const Stepper = z.object({ stepper: Range, start: Int.optional() }).strict();
const Fields = z.object({
  look: z.enum(LOOKS).default('diagram'), // The diagram, ten frames alone, or the skin of a world page.
  whole: z.union([Int, Stepper]).optional(), // The whole as a number, or on a stepper.
  first: z.union([Int, Slider, Stepper]).optional(), // The first part, or the red counters, as the page opens.
  second: Int.optional(), // The blue counters of the frames as the page opens.
  frames: Int.min(0).max(2).optional(), // The ten frames under the diagram, or of the frames look.
  tap: z.enum(['first', 'second']).optional(), // A tap on a cell adds or takes away a counter of this part.
  swap: z.boolean().default(false), // A Swap button trades the two parts.
  fill: z.boolean().default(false), // A button fills the second frame with red counters and empties it again.
  cup: z.boolean().default(false), // A cup hides the second part until the reader lifts it.
  list: z.boolean().default(false), // A list logs each split the reader finds.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of goals.js and the ranges it draws its targets from.
  challenge: z.object({ goal: z.string(), whole: z.union([Int, Range]), part: Range.optional() }).strict().optional(),
}).strict();

// value reads a number, a slider or a stepper as its starting value and its range.
function value(v) {
  if (v == null) return { n: null, ctl: null };
  if (typeof v === 'number') return { n: v, ctl: null };
  const kind = v.slider ? 'slider' : 'stepper', [lo, hi] = v[kind];
  return { n: v.start ?? lo, ctl: { kind, lo, hi } };
}

function read(pg, { at }, ctx) {
  const fail = words => ctx.fail(at, words);
  const look = pg.look, whole = value(pg.whole), first = value(pg.first);
  if (pg.frames !== undefined && !['diagram', 'frames'].includes(look)) fail(`frames belongs to the diagram and frames looks, the ${look} look has its own places`);
  const frames = look === 'frames' ? pg.frames ?? 1 : look === 'diagram' ? pg.frames ?? 0 : 0;
  if (look === 'frames' && !frames) fail('frames is 0, the frames look shows 1 or 2 ten frames');
  const spec = { ...pg, frames, whole: whole.n, wholeCtl: whole.ctl, first: first.n ?? 0, firstCtl: first.ctl, second: pg.second ?? null };
  const mode = modeOf(spec), cap = capOf(spec);
  for (const [ctl, name] of [[whole.ctl, 'whole'], [first.ctl, 'first']]) if (ctl && (ctl.lo > ctl.hi || spec[name] < ctl.lo || spec[name] > ctl.hi)) fail(`${name} has the range [${ctl.lo}, ${ctl.hi}] and starts at ${spec[name]}, write [low, high] and a start between them`);

  if (pg.challenge) readChallenge(pg, spec, mode, at, ctx);
  else if (mode === 'parts') {
    if (spec.whole == null) fail('whole is missing, write the number the two parts make, such as 7, or { stepper: [2, 10], start: 7 }');
    const hi = whole.ctl?.hi ?? spec.whole ?? 0;
    if ((whole.ctl?.lo ?? spec.whole) < 1 || hi > 20) fail(`whole reaches ${whole.ctl ? `[${whole.ctl.lo}, ${hi}]` : hi}, the parts hold a whole from 1 to 20`);
    if (first.ctl) fail('first is a number on this page, the reader moves the counters between the parts');
    if (spec.first > (spec.whole ?? 0)) fail(`first is ${spec.first}, more than the whole ${spec.whole}`);
    for (const f of ['second', 'tap']) if (pg[f] !== undefined) fail(`${f} belongs to pages with frames, pins or cars, this page moves counters between parts`);
    for (const f of ['fill', 'cup']) if (pg[f]) fail(`${f} belongs to pages with frames, this page moves counters between parts`);
    if (pg.swap && look === 'hands') fail('swap belongs to the diagram, leave it out of the hands');
  } else {
    if (pg.swap) fail('swap belongs to the diagram without frames, where the parts hold the counters');
    if (spec.second != null && (whole.n != null || pg.cup)) fail('second is set by the whole on this page, leave it out');
    const red = first.ctl?.hi ?? spec.first, blue = spec.second ?? 0;
    if (red + blue > cap || (whole.ctl?.hi ?? spec.whole ?? 0) > cap) fail(`the counters reach ${Math.max(red + blue, whole.ctl?.hi ?? spec.whole ?? 0)}, and the ${look === 'frames' || look === 'diagram' ? `${frames} frame${frames > 1 ? 's hold' : ' holds'}` : `${look} hold`} ${cap}`);
    if (spec.whole != null && (first.ctl?.hi ?? spec.first) > spec.whole && !whole.ctl) fail(`first reaches ${first.ctl?.hi ?? spec.first}, more than the whole ${spec.whole}`);
    if (whole.ctl && whole.ctl.lo < spec.first) fail(`whole starts its range at ${whole.ctl.lo}, below the ${spec.first} red counters`);
    if (whole.ctl && first.ctl) fail('whole and first both have a control, give one of them a number');
    if (pg.cup && (spec.whole == null || whole.ctl || pg.tap !== 'second' || !frames)) fail('cup hides the second part of a declared whole, write whole as a number, tap: second and frames: 1 or 2 with look: diagram');
    if (pg.fill && (frames !== 2 || spec.first + (spec.second ?? 0) > 10)) fail('fill fills the second of two frames, write frames: 2 and keep the first counters in the first frame');
    if (pg.list && (pg.tap !== 'first')) fail('list logs the counters and the empty cells, write tap: first');
    if (pg.tap && first.ctl) fail('tap and a control on first both change the red counters, keep one');
  }
  // A page with blue counters, a whole or a fill button shows two colours, and its readouts name red and blue.
  spec.two = mode === 'cells' && (spec.second != null || spec.whole != null || !!pg.fill || pg.tap === 'second');
  const ids = measuresOf(spec);
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids) || 'nothing'}`);
  return { data: spec, has: id => ids.includes(id), offers: ids.length ? `one of ${list(ids)}` : 'nothing, a challenge page draws its numbers as it opens' };
}

// A challenge page names its goal, which draws from the page's ranges. Every target it can draw must be open as the
// page starts and in reach of the page's controls.
function readChallenge(pg, spec, mode, at, ctx) {
  const c = pg.challenge, goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  if (!goal.looks.includes(pg.look)) return ctx.fail(at, `challenge.goal ${c.goal} works on the ${list(goal.looks)} look, this page shows ${pg.look}`);
  for (const f of ['whole', 'first', 'second', 'tap']) if (pg[f] !== undefined) ctx.fail(at, `${f} is drawn by challenge.goal ${c.goal}, leave it out`);
  for (const f of ['swap', 'fill', 'cup', 'list']) if (pg[f]) ctx.fail(at, `${f} belongs to pages without a challenge, leave it out`);
  if (c.goal === 'hidden-part' && spec.frames) ctx.fail(at, 'frames would show the empty cells of the hidden part, leave frames out');
  const problem = goal.problem(c, spec);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  drawn(goal, c, spec, { at, ctx, starts: () => challengeStart() });
}

// A link shows a count as the page opens.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  return numbers(lang).int(counts(spec, opening(spec))[id]);
}

// The two colours of the counters, a red and a blue that readers with any colour vision tell apart, each with a step
// for the dark themes.
const bundle = () => ({ families: { 'counters-red': { color: '#d1453b', color_dark: '#f0776d' }, 'counters-blue': { color: '#2a6bd1', color_dark: '#6fa4f5' } } });

export default { id: 'counters', scenes: ['bonds'], schema: Fields, read, start, bundle };
