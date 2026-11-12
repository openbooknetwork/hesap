// The Node half of the chance family: seeded random runs of coins, dice and pegs. It reads the fields of a page and
// checks them against the scene they name and the measures it can show.
import { schema } from '@openbooknetwork/kitap';
import { MODELS, SCENES, starts } from './models.js';
import { formatter } from './format.js';
import { hash } from './random.js';
import { GOALS, targetOf } from './goals.js';
import { list, challenge } from '../../node.mjs';

const { z } = schema;
const Fields = z.object({
  trials: z.number().int().min(1).max(10000), // A run has this many trials, and the slider reaches them all.
  readout: z.array(z.string()).default([]),
  seed: z.number().int().nonnegative().optional(), // The first run uses this seed, or one made from the page's id.
  pick: z.number().int().optional(), // The dice and galton scenes start with this sum or bin picked.
  sizes: z.array(z.number().int().min(1).max(16)).min(1).max(5).optional(), // The means scene offers these sample sizes and starts with the first.
  rows: z.number().int().min(4).max(14).optional(), // The galton scene has this many rows of pegs.
  runs: z.number().int().min(1).max(8).optional(), // The flips scene draws this many runs side by side.
  // A challenge page names a goal of goals.js and gives its targets and its tolerance.
  challenge: z.object({ goal: z.string(), targets: z.array(z.unknown()).optional(), band: z.number().optional() }).strict().optional(),
}).strict();

// OWN says which fields belong to which scene.
const OWN = { pick: ['dice', 'galton'], sizes: ['means'], rows: ['galton'], runs: ['flips'] };

function read(pg, { at, pid }, ctx) {
  const { scene } = pg;
  for (const [field, scenes] of Object.entries(OWN)) if (pg[field] !== undefined && !scenes.includes(scene)) ctx.fail(at, `${field} belongs to the ${list(scenes)} scenes, the ${scene} scene takes no ${field}`);
  const rows = scene === 'galton' ? pg.rows ?? 10 : undefined;
  const pick = scene === 'dice' ? pg.pick ?? 7 : scene === 'galton' ? pg.pick ?? Math.floor(rows / 2) : undefined;
  if (scene === 'dice' && (pick < 2 || pick > 12)) ctx.fail(at, `pick is ${pick}, two dice make a sum from 2 to 12`);
  if (scene === 'galton' && (pick < 0 || pick > rows)) ctx.fail(at, `pick is ${pick}, the bins of ${rows} rows are 0 to ${rows}`);
  // A page whose goal judges whole runs shows every trial, and any other page opens before the first trial.
  const whole = !!GOALS[pg.challenge?.goal]?.whole;
  const data = { ...pg, rows, pick, sizes: scene === 'means' ? pg.sizes ?? [1, 4, 16] : undefined, runs: scene === 'flips' ? pg.runs ?? 1 : undefined,
    seed: pg.seed ?? hash(pid), whole, at: whole ? pg.trials : 0 };
  if (pg.challenge) readChallenge(pg.challenge, data, at, ctx);
  const measures = MODELS[scene].measures(data), ids = Object.keys(measures), worked = Object.keys(MODELS[scene].formulas).map(f => `formula-${f}`);
  for (const id of pg.readout) if (!measures[id]) ctx.fail(at, `readout names "${id}", the ${scene} scene reads out ${list(ids)}`);
  // A text links a measure by its id, and a worked formula as formula-<id>.
  return { data, has: id => !!measures[id] || worked.includes(id), offers: `one of ${list([...ids, ...worked])}` };
}

// A challenge's goal has targets it can use, and the page opens with the goal not yet reached.
function readChallenge(c, spec, at, ctx) {
  const goal = challenge(c, GOALS, { scene: spec.scene, at, ctx });
  if (!goal) return;
  const problem = goal.problem(c, spec);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  if (goal.test(starts(spec), spec, c, targetOf(c, 0)).done) ctx.fail(at, `the page opens with challenge.goal ${c.goal} already reached, change the first target or the starting pick`);
}

// A link shows a count of 0, a chance as a fraction, or a formula worked for the starting counts.
function start(spec, lang, id) {
  const f = formatter(lang), st = starts(spec);
  return id.startsWith('formula-') ? f.written(spec, st, id.slice(8)) : f.value(spec, st, id);
}

export default { id: 'chance', scenes: SCENES, schema: Fields, read, start };
