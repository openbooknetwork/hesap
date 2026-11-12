// The Node half of the graph family: curves of a rule on one board or two stacked over the same x. It checks a page's
// rule, sliders, annotations, readouts and challenge against the scene it names.
import { schema } from '@openbooknetwork/kitap';
import SCENES from './scenes.js';
import RULES from './rules.js';
import GOALS from './goals.js';
import { formatter, starts, measured, reached } from './format.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
const Range = z.tuple([z.number(), z.number()]);
const Slider = z.object({ slider: Range, start: z.number().optional(), step: z.number().positive().default(0.1) }).strict();
const Fields = z.object({
  rule: z.union([z.string(), z.array(z.string()).min(2)]), // a page names one rule, or the rules the reader picks from, and the first one starts
  coefficients: z.record(z.string(), z.number()).default({}), // these set the rule's numbers where they differ from its own
  view: z.object({ x: Range, y: Range, below: Range.optional() }).strict(), // below gives the y range of the view under it
  from: z.number().optional(), // from says where the area starts
  to: z.number().optional(), // to says where it ends
  controls: z.record(z.string(), Slider).default({}),
  annotate: z.array(z.string()).default([]),
  readout: z.array(z.string()).default([]),
  // a challenge sets a goal, with the targets Another one steps through and the readouts Hint shows
  challenge: z.object({ goal: z.string(), tolerance: z.number().positive().optional(), targets: z.array(z.record(z.string(), z.any())).min(1).optional(),
    hint: z.array(z.string()).default([]) }).strict().optional(),
}).strict();

function read(pg, { at }, ctx) {
  const scene = SCENES[pg.scene], rules = [pg.rule].flat();
  for (const r of rules) if (!RULES[r]) ctx.fail(at, `unknown rule "${r}", the rules are ${list(Object.keys(RULES))}`);
  // coefficients and the sliders that set them belong to the page's one rule
  const own = rules.length === 1 ? Object.keys(RULES[rules[0]]?.coefficients ?? {}) : [];
  for (const k of Object.keys(pg.coefficients)) if (!own.includes(k)) ctx.fail(at, own.length ? `rule ${rules[0]} has no coefficient "${k}", its coefficients are ${list(own)}` : `coefficients sets "${k}" on a page with several rules, name one rule to set its coefficients`);
  for (const [id, kind] of Object.entries(scene.controls)) if (!pg.controls[id] && !scene.optional?.[id]) ctx.fail(at, `scene ${pg.scene} needs the control "${id}", add controls.${id} as a ${kind}: { slider: [from, to], start: n }`);
  // lacks lists the measures and formulas that read a control the page leaves out
  const lacks = Object.entries(scene.optional ?? {}).filter(([id]) => !pg.controls[id]).flatMap(([id, ids]) => ids.map(m => [m, id]));
  const needs = id => lacks.find(([m]) => m === id)?.[1];
  for (const [id, c] of Object.entries(pg.controls)) {
    if (!scene.controls[id] && !own.includes(id)) ctx.fail(at, `scene ${pg.scene} has no control "${id}", its controls are ${list([...Object.keys(scene.controls), ...own])}`);
    const start = c.start ?? c.slider[0];
    if (start < c.slider[0] || start > c.slider[1]) ctx.fail(at, `controls.${id}.start is outside its slider, pick a value from ${c.slider[0]} to ${c.slider[1]}`);
  }
  if (scene.views === 2 && !pg.view.below) ctx.fail(at, `scene ${pg.scene} draws a second view under the first, give its y range as view.below: [from, to]`);
  for (const k of scene.needs ?? []) if (pg[k] === undefined) ctx.fail(at, `scene ${pg.scene} needs ${k}, the x where the area ${k === 'from' ? 'starts' : 'ends'}`);
  for (const a of pg.annotate) if (!scene.annotations.includes(a)) ctx.fail(at, `scene ${pg.scene} cannot annotate "${a}", it annotates ${list(scene.annotations) || 'nothing'}`);
  const goal = pg.challenge ? readChallenge(pg, at, ctx) : null;
  const measures = [...Object.keys(scene.measures), ...Object.keys(goal?.measures ?? {})];
  for (const m of pg.readout) if (!measured(scene, pg, m)) ctx.fail(at, `scene ${pg.scene} has no measure "${m}", its measures are ${list(measures)}`);
  for (const m of pg.readout) if (needs(m)) ctx.fail(at, `readout names "${m}", which reads the control ${needs(m)}, add controls.${needs(m)} or leave "${m}" out`);
  // a text links a measure or a control by its id, and a worked formula as formula-<id>
  const linkable = new Set([...measures, ...Object.keys(pg.controls), ...Object.keys(scene.formulas).map(f => `formula-${f}`)].filter(id => !needs(id)));
  return { data: pg, has: id => linkable.has(id), offers: `one of ${list([...linkable])}` };
}

// grid yields every slider position while there are few enough to try, so a check can tell whether a goal is in reach.
function* grid(controls, limit = 300000) {
  const steps = Object.entries(controls).map(([id, c]) => [id, Array.from({ length: Math.round((c.slider[1] - c.slider[0]) / c.step) + 1 }, (_, k) => Number((c.slider[0] + k * c.step).toFixed(6)))]);
  if (steps.reduce((n, [, xs]) => n * xs.length, 1) > limit) return;
  const walk = function* (i, at) { if (i === steps.length) { yield at; return; } for (const x of steps[i][1]) yield* walk(i + 1, { ...at, [steps[i][0]]: x }); };
  yield* walk(0, {});
}

// A challenge names a goal that suits the scene, and each of its targets opens unsolved and can be reached. A readout
// that gives the answer away waits behind Hint.
function readChallenge(pg, at, ctx) {
  const c = pg.challenge, goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return null;
  for (const id of c.hint) if (!pg.readout.includes(id)) ctx.fail(at, `challenge.hint shows "${id}", list it in readout too, and Hint reveals it`);
  hidden(pg.readout.filter(id => !c.hint.includes(id)), goal.hides, at, ctx);
  if ([pg.rule].flat().some(r => !RULES[r])) return goal;
  (c.targets ?? [{}]).forEach((t, i) => {
    const where = c.targets ? `challenge.targets[${i}]` : 'the page', bad = goal.target(t);
    if (bad) return ctx.fail(at, `${where} does not suit goal ${c.goal}, which ${bad}`);
    if (reached(pg, starts(pg, i))) return ctx.fail(at, `${where} is solved as the page opens, move a slider's start or change the target`);
    let tried = false;
    for (const v of grid(pg.controls)) { tried = true; if (reached(pg, { ...starts(pg, i), ...v })) return; }
    if (tried) ctx.fail(at, `${where} cannot be reached on the sliders' steps, change the target, the tolerance or a slider's step`);
  });
  return goal;
}

// A link to a measure or a slider holds its starting value, and a link to a formula the formula worked for the
// starting values. A page with an unknown rule or a missing slider has failed already, so its links show nothing.
function start(spec, lang, id) {
  const scene = SCENES[spec.scene];
  if ([spec.rule].flat().some(r => !RULES[r]) || Object.keys(scene.controls).some(k => !spec.controls[k] && !scene.optional?.[k])) return null;
  const f = formatter(lang), values = starts(spec);
  if (!id.startsWith('formula-')) return f.value(scene, spec, values, id);
  return scene.formulas[id.slice(8)] ? f.written(scene, spec, values, id.slice(8)) : null;
}

// A story with no cover opens on a cubic over its slope curve.
const OVERVIEW = { scene: 'slope', rule: 'cubic', coefficients: {}, view: { x: [-3, 3], y: [-2.5, 2.5], below: [-2, 4] },
  controls: { x: { slider: [-2.6, 2.6], start: -2, step: 0.1 } }, annotate: ['tangent', 'whole'], readout: [] };

export default { id: 'graph', scenes: Object.keys(SCENES), schema: Fields, read, start, bundle: () => ({ data: { overview: OVERVIEW } }) };
