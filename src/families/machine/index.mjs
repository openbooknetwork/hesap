// The Node half of the machine family: function machines that a value runs through. It reads the fields of a page
// and checks them against the scene they name.
import { schema } from '@openbooknetwork/kitap';
import RULES from './rules.js';
import SCENES from './scenes.js';
import { GOALS, met, opening } from './goals.js';
import { formatter } from './format.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
const Slider = z.object({ slider: z.tuple([z.number(), z.number()]), start: z.number().optional(), step: z.number().positive().default(1) }).strict();
const Choice = z.object({ choice: z.array(z.string()).min(1), start: z.string().optional() }).strict();
// A challenge names a goal from goals.js and the targets it takes in turn. The page opens on the first, and Another
// one moves to the next.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.union([z.number(), z.string()])).min(1), tolerance: z.number().nonnegative().default(0) }).strict();
const Fields = z.object({
  controls: z.record(z.string(), z.union([Slider, Choice])).default({}),
  items: z.array(z.number()).optional(), // The map scene works through this list.
  readout: z.array(z.string()).default([]),
  actions: z.array(z.string()).optional(), // A page that leaves it out offers every action of its scene.
  challenge: Challenge.optional(),
}).strict();

// settings lists every setting the reader can reach: each slider stop, each choice, and both values of each state
// that an offered action flips, such as chain's swapped.
const stops = ({ slider: [a, b], step }) => Array.from({ length: Math.floor((b - a) / step + 1e-9) + 1 }, (_, i) => +(a + i * step).toFixed(9));
const offered = (pg, scene) => pg.actions ?? Object.keys(scene.switches ?? {});
const settings = (pg, scene) => [...Object.entries(pg.controls).map(([id, c]) => [id, c.slider ? stops(c) : c.choice]),
  ...offered(pg, scene).map(a => [scene.switches[a], [false, true]])]
  .reduce((all, [id, vs]) => all.flatMap(v => vs.map(x => ({ ...v, [id]: x }))), [{ ...scene.state }]);

// A challenge names a known goal that fits the scene. Each target is reachable, and the page does not open on it.
function readChallenge(pg, scene, at, ctx) {
  const { goal: name, targets } = pg.challenge, goal = challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  hidden(pg.readout, goal.hides ?? [], at, ctx);
  const kind = goal.target === 'rule' ? `rules (${list(Object.keys(RULES))})` : 'numbers';
  for (const t of targets) {
    if (goal.target === 'rule' ? !RULES[t] : typeof t !== 'number') { ctx.fail(at, `challenge.targets lists "${t}", goal ${name} takes ${kind}`); continue; }
    if (met(goal, opening(pg, scene, t), scene, pg)) ctx.fail(at, `the page opens with the target ${t} already reached, start the controls elsewhere or pick another target`);
    const reach = settings(pg, scene).map(s => { const v = { ...s, target: t }; goal.set?.(v); return v; });
    if (!reach.some(v => met(goal, v, scene, pg))) {
      const made = [...new Set(reach.map(v => goal.got(v, scene, pg)))].sort((a, b) => a - b);
      ctx.fail(at, `challenge.targets lists ${t}, which no setting of the controls reaches. The controls reach ${list(made)}`);
    }
  }
}

function read(pg, { at }, ctx) {
  const scene = SCENES[pg.scene];
  for (const [id, kind] of Object.entries(scene.controls)) {
    const c = pg.controls[id], want = kind === 'slider' ? 'slider' : 'choice';
    if (!c || !(want in c)) { ctx.fail(at, `scene ${pg.scene} needs controls.${id} as ${want === 'slider' ? '{ slider: [from, to], start: n }' : '{ choice: [rules], start: rule }'}`); continue; }
    for (const r of c.choice ?? []) if (!RULES[r]) ctx.fail(at, `controls.${id} names the rule "${r}", the rules are ${list(Object.keys(RULES))}`);
    if (c.choice && c.start && !c.choice.includes(c.start)) ctx.fail(at, `controls.${id}.start is "${c.start}", pick one of ${list(c.choice)}`);
  }
  for (const id of Object.keys(pg.controls)) if (!scene.controls[id]) ctx.fail(at, `scene ${pg.scene} has no control "${id}", its controls are ${list(Object.keys(scene.controls))}`);
  if (scene.items && !pg.items?.length) ctx.fail(at, `scene ${pg.scene} needs items, the list of numbers it works through`);
  for (const m of pg.readout) if (!scene.measures[m]) ctx.fail(at, `scene ${pg.scene} has no measure "${m}", its measures are ${list(Object.keys(scene.measures))}`);
  for (const a of pg.actions ?? []) if (!scene.switches?.[a]) ctx.fail(at, `actions lists "${a}", scene ${pg.scene} offers ${list(Object.keys(scene.switches ?? {})) || 'no actions'}`);
  if (Object.values(scene.controls).includes('guess') && !pg.challenge) ctx.fail(at, `scene ${pg.scene} hides what the reader guesses, add challenge: { goal: rule, targets: [rules] }`);
  if (pg.challenge) readChallenge(pg, scene, at, ctx);
  // A text links a measure or a control by its id, and a measure's worked formula as formula-<id>. A challenge whose
  // target is a number links it as target.
  const shown = GOALS[pg.challenge?.goal]?.target === 'number' ? ['target'] : [];
  const linkable = new Set([...Object.keys(scene.measures), ...Object.keys(scene.controls), ...Object.keys(scene.formulas).map(f => `formula-${f}`), ...shown]);
  return { data: pg, has: id => linkable.has(id), offers: `one of ${list(linkable)}` };
}

// A link to a measure or a control holds its starting value, a link to a formula the formula worked for the starting
// values, and a link to a challenge's target its first target.
function start(spec, lang, id) {
  const scene = SCENES[spec.scene], f = formatter(lang), values = opening(spec, scene);
  if (!id.startsWith('formula-')) return f.value(scene, spec, values, id);
  return scene.formulas[id.slice(8)] ? f.written(scene, values, id.slice(8)) : null;
}

export default { id: 'machine', scenes: Object.keys(SCENES), schema: Fields, read, start };
