// The Node half of the axes family: coordinates on a line, a plane and in space, polar curves and solids. A page names
// a figure as its scene and declares its controls, and the figure holds the logic.
import { schema } from '@openbooknetwork/kitap';
import FIGURES from './figures/index.js';
import { formatter, starts } from '../geo/shared/format.js';
import { Pair, Controls, controlsOf } from '../geo/shared/controls.mjs';
import { GOALS, reached } from './goals.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
// A challenge sets a goal the reader reaches with the figure. Its targets come one at a time, the next on "Another
// one". The tolerance is how far a value may be from a target, by default the goal's own.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.record(z.string(), z.unknown())).min(1), tolerance: z.number().positive().optional() }).strict();
const Fields = z.object({
  view: z.object({ x: Pair, y: Pair, z: Pair.optional(), grid: z.boolean().default(false) }).strict(), // z makes it a view of space.
  controls: Controls,
  annotate: z.array(z.string()).default([]), // What the figure draws on itself.
  readout: z.array(z.string()).default([]),  // The measures shown as numbers under the figure.
  challenge: Challenge.optional(),
}).strict();

function read(pg, { at }, ctx) {
  const fig = FIGURES[pg.scene];
  controlsOf(pg, fig, at, ctx);
  if (pg.challenge) readChallenge(pg, fig, at, ctx);
  // A text links a measure or a control by its id, and a measure's worked formula as formula-<id>.
  const linkable = new Set([...Object.keys(fig.measures), ...Object.keys(fig.controls), ...Object.keys(fig.formulas).map(f => `formula-${f}`)]);
  // A challenge's text leaves out the links that give its answer away.
  const hides = pg.challenge ? GOALS[pg.challenge.goal]?.hides ?? [] : [];
  for (const id of hides) linkable.delete(id), linkable.delete(`formula-${id}`);
  return { data: pg, has: id => linkable.has(id), offers: `one of ${list([...linkable])}` };
}

// Each kind of target field has a test and the words a failed check prints.
const KINDS = {
  number: { ok: n => typeof n === 'number', say: 'a number' },
  pair: { ok: p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number'), say: 'a pair [x, y]' },
  solid: { ok: id => FIGURES[id]?.measures.volume != null, say: `a solid, one of ${list(Object.keys(FIGURES).filter(id => FIGURES[id].measures.volume))}` },
  size: { ok: o => o && typeof o === 'object' && Object.values(o).every(n => typeof n === 'number'), say: 'the controls of the solid with their values, as { radius: 2, h: 3 }' },
};

// states lists every setting of the controls. A slider takes each of its steps, a point each place of its snap inside
// the view, and a point that does not snap is tried every quarter unit.
function states(pg, fig) {
  const { x, y } = pg.view, steps = (low, high, step) => Array.from({ length: Math.floor((high - low) / step + 1e-9) + 1 }, (_, i) => Number((low + i * step).toFixed(6)));
  const choices = Object.entries(pg.controls).map(([id, c]) => {
    if (c.slider) return [id, steps(c.slider[0], c.slider[1], c.step)];
    const snap = c.snap ?? 0.25, on = ([low, high]) => steps(Math.ceil(low / snap) * snap, high, snap), seen = new Map();
    for (const px of on(x)) for (const py of on(y)) { const p = fig.constrain ? fig.constrain(id, [px, py]) : [px, py]; seen.set(String(p), p); }
    return [id, [...seen.values()]];
  });
  const count = choices.reduce((n, [, c]) => n * c.length, 1);
  if (count > 4e6) return null;
  let all = [{}];
  for (const [id, options] of choices) all = all.flatMap(v => options.map(o => ({ ...v, [id]: o })));
  return fig.allows ? all.filter(fig.allows) : all;
}

// A challenge names a goal that works on the page's figure, targets the goal can read, a start that reaches none of
// them, and a figure that can reach each one with its controls.
function readChallenge(pg, fig, at, ctx) {
  const { goal: name, targets } = pg.challenge, goal = challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  const fields = Object.keys(goal.takes), example = `{ ${fields.map(k => `${k}: ...`).join(', ')} }`;
  let fit = true;
  targets.forEach((t, i) => {
    const where = `challenge.targets[${i}]`, fail = msg => { fit = false; ctx.fail(at, msg); };
    for (const k of Object.keys(t)) if (!goal.takes[k]) fail(`${where} has "${k}", goal ${name} reads ${list(fields)}: write ${example}`);
    for (const [k, kind] of Object.entries(goal.takes)) if (!KINDS[kind].ok(t[k])) fail(`${where}.${k} takes ${KINDS[kind].say} for goal ${name}`);
    const want = FIGURES[t.solid]?.measures.volume ? Object.keys(FIGURES[t.solid].controls) : [], have = Object.keys(t.size ?? {});
    if (want.length && (want.some(k => !have.includes(k)) || have.some(k => !want.includes(k))))
      fail(`${where}.size gives ${list(have)}, and ${t.solid} is sized by ${list(want)}: write size: { ${want.map(k => `${k}: ...`).join(', ')} }`);
  });
  hidden(pg.readout, goal.hides, at, ctx);
  if (!fit) return; // A target the goal cannot read cannot be tested.
  const start = starts(pg.controls), done = targets.findIndex(t => reached(pg, t, start));
  if (done >= 0) ctx.fail(at, `the starting values already reach challenge.targets[${done}], start the controls somewhere else`);
  const all = states(pg, fig);
  if (!all) return ctx.fail(at, 'the controls take too many states to check that each target can be reached, give the points a snap or the sliders a larger step');
  targets.forEach((t, i) => { if (!all.some(v => reached(pg, t, v))) ctx.fail(at, `no setting of the controls reaches challenge.targets[${i}], change the target, the tolerance or the controls' ranges`); });
}

// A link to a measure or a slider shows its starting value, and a link to a formula the formula worked for the
// starting values.
function start(spec, lang, id) {
  const fig = FIGURES[spec.scene], f = formatter(lang), values = starts(spec.controls);
  return id.startsWith('formula-') ? f.written(fig, values, id.slice(8)) : f.value(fig, spec.controls, values, id);
}

export default { id: 'axes', scenes: Object.keys(FIGURES), schema: Fields, read, start };
