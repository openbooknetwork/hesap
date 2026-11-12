// The Node half of the wave family: a point that runs round a circle and the waves its height draws. It reads a
// page's fields and checks them against the scene the page names.
import { schema } from '@openbooknetwork/kitap';
import SCENES, { measureOf } from './scenes.js';
import { formatter, starts } from './format.js';
import { GOALS, judge } from './goals.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
// A challenge names its goal, the targets that "Another one" steps through, and how far off the reader may be.
const Challenge = z.object({ goal: z.string(), tolerance: z.number().positive().optional(), targets: z.array(z.record(z.string(), z.number())).min(1).default([{}]) }).strict();
const Slider = z.object({ slider: z.tuple([z.number(), z.number()]), start: z.number().optional(), step: z.number().positive().default(0.1) }).strict();
const Fields = z.object({
  angle: z.number().min(0).max(360).default(0), // angle is where the point stands when the page opens, in degrees.
  controls: z.record(z.string(), Slider).default({}),
  annotate: z.array(z.string()).default([]), // annotate lists what the graph marks on itself, quarter or period.
  readout: z.array(z.string()).default([]),  // readout lists the measures shown as numbers under the figure.
  axis: z.enum(['degrees', 'radians']).default('degrees'), // axis says how the graph writes x.
  challenge: Challenge.optional(),
}).strict();

function read(pg, { at }, ctx) {
  const scene = SCENES[pg.scene];
  for (const id of scene.controls) {
    const c = pg.controls[id];
    if (!c) { ctx.fail(at, `scene ${pg.scene} needs the slider "${id}", add controls.${id}: { slider: [from, to], start: n, step: n }`); continue; }
    const [from, to] = c.slider, start = c.start ?? from;
    if (from >= to) ctx.fail(at, `controls.${id}.slider runs from ${from} to ${to}, write the smaller value first`);
    if (start < from || start > to) ctx.fail(at, `controls.${id}.start is outside its slider, pick a value from ${from} to ${to}`);
    if (Math.abs((start - from) / c.step - Math.round((start - from) / c.step)) > 1e-9) ctx.fail(at, `controls.${id}.start ${start} is not on a step of ${c.step} from ${from}, the slider cannot show it`);
  }
  if ((pg.scene === 'stretch' || pg.scene === 'sum') && pg.controls.frequency && pg.controls.frequency.slider[0] <= 0) ctx.fail(at, 'controls.frequency.slider starts at 0 or below, start it above 0, because a wave with k = 0 does not turn');
  for (const id of Object.keys(pg.controls)) if (!scene.controls.includes(id)) ctx.fail(at, `scene ${pg.scene} has no slider "${id}"${scene.controls.length ? `, its sliders are ${list(scene.controls)}` : ', remove controls'}`);
  for (const a of pg.annotate) if (!scene.annotations.includes(a)) ctx.fail(at, `scene ${pg.scene} cannot annotate "${a}"${scene.annotations.length ? `, it annotates ${list(scene.annotations)}` : ', remove annotate'}`);
  const linkable = [...Object.keys(scene.measures), ...scene.controls];
  if (pg.challenge) readChallenge(pg, at, ctx);
  for (const m of pg.readout) if (!measureOf(scene, m)) ctx.fail(at, `scene ${pg.scene} has no measure "${m}", its measures are ${list(linkable)}`);
  // A text links a measure or a slider by its id, and a worked formula as formula-<id>.
  const worked = Object.keys(scene.formulas).map(f => `formula-${f}`);
  return { data: pg, has: id => linkable.includes(id) || worked.includes(id), offers: `one of ${list([...linkable, ...worked])}` };
}

// A challenge's goal takes targets the sliders can reach, and is unsolved when the page opens.
function readChallenge(pg, at, ctx) {
  const c = pg.challenge, goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  hidden(pg.readout, goal.hides ?? [], at, ctx);
  c.tolerance ??= goal.tolerance;
  c.targets.forEach((t, i) => {
    const where = `challenge.targets[${i}]`, missing = goal.keys.find(k => !(k in t)), extra = Object.keys(t).find(k => !goal.keys.includes(k));
    if (missing) ctx.fail(at, `${where} has no ${missing}, a target of goal ${c.goal} gives ${list(goal.keys)}`);
    if (extra) ctx.fail(at, `${where} gives ${extra}, ${goal.keys.length ? `a target of goal ${c.goal} gives ${list(goal.keys)}` : `goal ${c.goal} takes no targets, remove targets`}`);
    const why = !missing && goal.check?.(t, pg.controls);
    if (why) ctx.fail(at, `${where}: ${why}`);
  });
  const opens = judge(goal, starts(pg), c.targets[0], c.tolerance);
  if (opens.solved || opens.found.length) ctx.fail(at, `the page opens with goal ${c.goal} ${opens.solved ? 'already reached' : 'partly reached'}, change angle or the sliders' start so the reader has something to do`);
}

// A link to a measure holds its value at the starting angle, and a link to a formula the formula worked there.
function start(spec, lang, id) {
  const scene = SCENES[spec.scene], f = formatter(lang), v = starts(spec);
  if (!id.startsWith('formula-')) return f.value(scene, v, id);
  return scene.formulas[id.slice(8)] ? f.written(scene, v, id.slice(8)) : null;
}

// A story with no cover opens on the sine wave part drawn.
const bundle = () => ({ data: { overview: { scene: 'sine', family: 'wave', angle: 135, controls: {}, annotate: [], readout: [], axis: 'degrees' } } });

export default { id: 'wave', scenes: Object.keys(SCENES), schema: Fields, read, start, bundle };
