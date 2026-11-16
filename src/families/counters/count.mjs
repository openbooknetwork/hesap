// The Node half of the count scene: objects counted one by one. It checks a page's fields and says what each link
// shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { COUNT_LOOKS, TAPS, ROOM, STOP, STEPS, SIDES, modeOf, sizeOf, opening, counts, measuresOf } from './count-model.js';
import { COUNT_GOALS, LOOSE, countStart } from './count-goals.js';
import { numbers } from '../../kit/format.js';
import { list, challenge, drawn, value } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Stepper = z.object({ stepper: Range, start: Int.optional() }).strict();
const Fields = z.object({
  look: z.enum(COUNT_LOOKS).default('tray'), // The place the objects lie in, or a world page.
  n: Int.min(0).max(100).optional(), // The objects as the page opens, or the passengers on the bus.
  rows: z.boolean().default(false), // The objects stand in rows of ten, a hundred unless n says less.
  tap: z.enum(TAPS).optional(), // What a tap on an object does.
  drag: z.boolean().default(false), // The reader moves the objects anywhere in the tray.
  clear: z.boolean().default(false), // A Clear button takes every number off.
  path: z.boolean().default(false), // A line joins the objects in the order they were counted.
  counted: z.boolean().default(false), // Every object holds its number as the page opens.
  box: z.union([Int, Stepper]).optional(), // A closed box holds this many, and counting goes on from it.
  pile: Int.min(1).max(LOOSE).optional(), // A pile of counters to put beside the box.
  marker: z.union([Int, Stepper]).optional(), // A marker on one counter of the rows.
  waiting: Int.min(0).max(STOP).optional(), // The people at the bus stop.
  step: z.union([Int, Stepper]).optional(), // The step of the staircase the walker stands on.
  sides: z.boolean().default(false), // Tiles show the number before and the number after, and a tap steps to one.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of count-goals.js and the ranges it draws its targets from.
  challenge: z.object({ goal: z.string(), target: Range.optional(), box: Range.optional(), more: Range.optional(),
    start: Range.optional(), less: Range.optional() }).strict().optional(),
}).strict();

// The fields each kind of page uses. read fails a field that the page's kind leaves unused.
const USES = {
  tag: ['look', 'n', 'rows', 'tap', 'drag', 'clear', 'path', 'counted', 'box'], again: ['look', 'n', 'tap', 'clear'],
  place: ['look', 'n', 'rows', 'tap'], take: ['look', 'n', 'rows', 'tap'], marker: ['look', 'n', 'rows', 'marker'],
  pile: ['look', 'box', 'pile'], sides: ['look', 'n', 'rows', 'sides'], bus: ['look', 'n', 'waiting'], stairs: ['look', 'step'],
};
const DEFAULTS = { look: 'tray', rows: false, drag: false, clear: false, path: false, counted: false, sides: false };

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const box = value(pg.box), marker = value(pg.marker), step = value(pg.step);
  const spec = { ...pg, scene: 'count', box: box.n, boxCtl: box.ctl, marker: marker.n, markerCtl: marker.ctl, step: step.n, stepCtl: step.ctl };
  for (const [v, name] of [[box, 'box'], [marker, 'marker'], [step, 'step']]) if (v.ctl && (v.ctl.lo > v.ctl.hi || v.n < v.ctl.lo || v.n > v.ctl.hi)) fail(`${name} has the range [${v.ctl.lo}, ${v.ctl.hi}] and starts at ${v.n}, write [low, high] and a start between them`);
  if (pg.challenge) { readChallenge(pg, spec, at, ctx); return { data: spec, has: () => false, offers: 'nothing, a challenge page draws its numbers as it opens' }; }

  const mode = modeOf(spec), n = sizeOf(spec);
  if (!mode) fail(`tap is missing, write what a tap on an object does: ${list(TAPS)}`);
  for (const [f, v] of Object.entries(pg)) if (!['readout', ...(USES[mode] ?? [])].includes(f) && v !== undefined && v !== DEFAULTS[f]) fail(`${f} belongs to other pages, leave it out of this one`);
  if (mode === 'stairs' && (step.n == null || step.n < 0 || (step.ctl?.hi ?? step.n) > STEPS)) fail(`step is missing or past the staircase, write a step from 0 to ${STEPS}, or { stepper: [0, ${STEPS}], start: 3 }`);
  if (mode === 'bus' && (pg.n == null || pg.waiting == null || pg.n + pg.waiting > STOP)) fail(`n and waiting are the people on the bus and at the stop, write both, ${STOP} people in all at most`);
  if (mode === 'sides' && (!pg.rows || pg.look !== 'tray' || pg.n == null || pg.n < SIDES[0] || pg.n > SIDES[1])) fail(`sides steps a group in rows of ten, write rows: true and n from ${SIDES[0]} to ${SIDES[1]}`);
  if (mode === 'pile' && (box.n == null || box.n < 0)) fail('box is missing, write the number the closed box holds, such as 5, or { stepper: [3, 20], start: 5 }');
  if (mode === 'marker' && (!pg.rows || (marker.ctl?.lo ?? marker.n) < 1 || (marker.ctl?.hi ?? marker.n) > n)) fail(`marker stands on a counter of the rows, write rows: true and a marker from 1 to ${n}`);
  if (['tag', 'again', 'place', 'take'].includes(mode)) {
    const room = pg.rows ? 100 : ROOM[pg.look];
    if (!room) fail(`the ${pg.look} look has no objects to tap, use one of ${list(Object.keys(ROOM))}`);
    else if (!n || n > room) fail(`n is ${n || 'missing'}, the ${pg.rows ? 'rows hold' : `${pg.look} holds`} from 1 to ${room} objects`);
    if (pg.rows && pg.look !== 'tray') fail('rows stand in the tray, leave look out');
    if (mode === 'place' && !pg.rows) fail('a tap shows the number of a counter in the rows, write rows: true');
    if (pg.drag && (pg.rows || pg.look === 'wire')) fail('drag moves loose objects, the rows and the wire hold theirs in place');
    if (box.ctl) fail('box is a number on this page, the tapped objects count on from it');
    if (pg.counted && (box.n != null || pg.clear)) fail('counted opens with the objects numbered from 1, leave box and clear out');
  }
  const ids = measuresOf(spec);
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids)}`);
  return { data: spec, has: id => ids.includes(id), offers: `one of ${list(ids)}` };
}

// A challenge page names its goal, which draws from the page's ranges. Every target it can draw must be open as the
// page starts and in reach of the page's controls.
function readChallenge(pg, spec, at, ctx) {
  const c = pg.challenge, goal = challenge(c, COUNT_GOALS, { scene: 'count', at, ctx });
  if (!goal) return;
  for (const [f, v] of Object.entries(pg)) if (f !== 'challenge' && v !== undefined && v !== DEFAULTS[f] && !(f === 'readout' && !v.length)) ctx.fail(at, `${f} is set by challenge.goal ${c.goal}, leave it out`);
  const problem = goal.problem(c, spec);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  drawn(goal, c, spec, { at, ctx, starts: countStart });
}

// A link shows a count as the page opens. A total shows once every object has its number, so no text links it.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  const v = counts(spec, opening(spec))[id];
  return v == null ? null : numbers(lang).int(v);
}

export default { read, start };
