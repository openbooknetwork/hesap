// The Node half of the geo family: plane figures with measured sides, angles and areas. A page names a figure as its
// scene and declares its controls, and the figure holds the logic.
import { schema } from '@openbooknetwork/kitap';
import FIGURES from './figures/index.js';
import { formatter, starts } from './shared/format.js';
import { Pair, Controls, controlsOf } from './shared/controls.mjs';
import { GOALS, annotation } from './goals.js';
import { list, challenge } from '../../node.mjs';

const { z } = schema;
const Shown = { annotate: z.array(z.string()).default([]), readout: z.array(z.string()).default([]) };
// A challenge sets a goal the reader reaches with the figure. Another one steps through the targets, and a hint shows
// more of the figure.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.record(z.string(), z.number())).min(1), tolerance: z.number().positive().default(0.05),
  hint: z.object(Shown).strict().optional() }).strict();
const Fields = z.object({
  view: z.object({ x: Pair, y: Pair, grid: z.boolean().default(false) }).strict(),
  controls: Controls,
  annotate: z.array(z.string()).default([]), // What the figure draws on itself: area, angles, sides and so on.
  readout: z.array(z.string()).default([]),  // The measures shown as numbers under the figure.
  challenge: Challenge.optional(),
}).strict();

function read(pg, { at }, ctx) {
  const fig = FIGURES[pg.scene];
  controlsOf(pg, fig, at, ctx);
  if (pg.challenge) readChallenge(pg, fig, at, ctx);
  // A text links a measure or a control by its id, a worked formula as formula-<id> and a challenge's target value as
  // goal-<measure>.
  const goal = Object.keys(pg.challenge?.targets[0] ?? {}).map(m => `goal-${m}`);
  const linkable = new Set([...Object.keys(fig.measures), ...Object.keys(fig.controls), ...Object.keys(fig.formulas).map(f => `formula-${f}`), ...goal]);
  return { data: pg, has: id => linkable.has(id), offers: `one of ${list([...linkable])}` };
}

function readChallenge(pg, fig, at, ctx) {
  const { targets, tolerance, hint } = pg.challenge, name = pg.challenge.goal, where = `${at} challenge`;
  const goal = challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  const unfit = goal.fits(fig); if (unfit) ctx.fail(where, `goal ${name} ${unfit}, and this page draws a ${pg.scene}`);
  const keys = Object.keys(targets[0]).sort().join(', ');
  targets.forEach((t, i) => {
    for (const m of Object.keys(t)) if (!fig.measures[m]) ctx.fail(where, `targets[${i}] sets "${m}", and figure ${pg.scene} measures ${list(Object.keys(fig.measures))}`);
    if (Object.keys(t).sort().join(', ') !== keys) ctx.fail(where, `targets[${i}] sets ${Object.keys(t).join(', ')}, give every target the measures of the first: ${keys}`);
  });
  const checked = new Set(targets.flatMap(t => goal.checks(fig, t)));
  for (const m of pg.readout) if (checked.has(m)) ctx.fail(at, `readout ${m} shows what goal ${name} checks, take it out of readout or move it to challenge.hint.readout`);
  for (const a of pg.annotate) if ([...checked].some(m => annotation(m) === a)) ctx.fail(at, `annotate ${a} writes what goal ${name} checks on the figure, take it out or move it to challenge.hint.annotate`);
  for (const a of hint?.annotate ?? []) if (!fig.annotations.includes(a)) ctx.fail(where, `hint.annotate ${a}: figure ${pg.scene} annotates ${list(fig.annotations)}`);
  for (const m of hint?.readout ?? []) if (!fig.measures[m]) ctx.fail(where, `hint.readout ${m}: figure ${pg.scene} measures ${list(Object.keys(fig.measures))}`);
  const values = starts(pg.controls);
  targets.forEach((t, i) => {
    if (goal.met(fig, values, t, tolerance)) ctx.fail(where, `the figure meets targets[${i}] (${JSON.stringify(t)}) before the reader moves anything, change a control's start or the target`);
  });
}

// A link to a measure or a slider shows its starting value, and a link to a formula the formula worked for the
// starting values.
function start(spec, lang, id) {
  const fig = FIGURES[spec.scene], f = formatter(lang), values = starts(spec.controls);
  return id.startsWith('formula-') ? f.written(fig, values, id.slice(8)) : f.value(fig, spec.controls, values, id, spec.challenge?.targets[0]);
}

export default { id: 'geo', scenes: Object.keys(FIGURES), schema: Fields, read, start };
