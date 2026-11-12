// The Node half of the parts family: fractions as bars, pies and number lines. It checks a page's fields against the
// scene it names and says what each link in the text shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import SCENES from './scenes.js';
import GOALS, { target, value } from './goals.js';
import { read } from './fraction.js';
import { formatter, starts, staged } from './format.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
// MOST is the most parts a whole is cut into, since more would leave parts too thin to tap.
const MOST = 24;

const Count = z.number().int().min(0);
const Fraction = z.object({
  start: z.union([z.string(), z.number()]).transform(String), // The fraction the page opens with, as 3/4.
  bottom: z.tuple([Count, Count]).default([1, 12]), // The smallest and the largest denominator the reader can set.
  wholes: z.number().int().min(1).max(3).default(1), // How many wholes the fraction can fill.
}).strict();
const Slider = z.object({ slider: z.tuple([z.number().int(), z.number().int()]), start: z.number().int().optional() }).strict();
// A challenge names its goal and the targets "Another one" steps through, the first one first.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(1) }).strict();
const Fields = z.object({
  fractions: z.record(z.string(), Fraction),
  controls: z.record(z.string(), Slider).default({}),
  readout: z.array(z.string()).default([]),
  stage: z.string().optional(), // A scene with stages shows this one, and opens on the stage before it.
  challenge: Challenge.optional(),
}).strict();

// A challenge's goal works with the page's scene, each target is one the reader can reach, and none is reached before
// the reader touches the page.
function readChallenge(pg, at, ctx) {
  const c = pg.challenge;
  if (!c) { if (SCENES[pg.scene].challenge) ctx.fail(at, `scene ${pg.scene} needs a challenge, as challenge: { goal: between, targets: [...] }`); return; }
  const goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  hidden(pg.readout, goal.hides ?? [], at, ctx);
  const want = Object.entries(goal.fields).map(([k, kind]) => `${k}: ${kind === 'fraction' ? '2/3' : '12'}`).join(', ');
  c.targets.forEach((raw, i) => {
    const where = `challenge.targets[${i}]`, extra = Object.keys(raw).find(k => !goal.fields[k]);
    if (extra) ctx.fail(at, `${where} names "${extra}", a target of goal ${c.goal} is { ${want} }`);
    let ok = true;
    for (const [k, kind] of Object.entries(goal.fields))
      if (kind === 'fraction' ? !value(raw[k]) : !(Number.isInteger(raw[k]) && raw[k] > 0)) { ok = false; ctx.fail(at, `${where}.${k} is ${raw[k] ?? 'missing'}, a target of goal ${c.goal} is { ${want} }`); }
    if (!ok) return;
    const t = target(c.goal, raw), why = goal.possible(t, pg);
    if (why) ctx.fail(at, `${where}: ${why}`);
    else if (goal.holds(starts(pg, i), t)) ctx.fail(at, `${where} is reached before the reader touches the page, change the fractions' start or the target`);
  });
}

function readPage(pg, { at }, ctx) {
  const own = SCENES[pg.scene];
  for (const id of own.fractions) if (!pg.fractions[id]) ctx.fail(at, `scene ${pg.scene} needs fractions.${id} as { start: 3/4, bottom: [1, 12] }`);
  let sound = own.fractions.every(id => pg.fractions[id]);
  for (const [id, f] of Object.entries(pg.fractions)) {
    if (!own.fractions.includes(id)) ctx.fail(at, `scene ${pg.scene} has no fraction "${id}", its fractions are ${list(own.fractions)}`);
    const s = read(f.start), [lo, hi] = f.bottom;
    if (!s) { sound = false; ctx.fail(at, `fractions.${id}.start is "${f.start}", write a fraction as 3/4`); continue; }
    if (lo < 1 || lo > hi || hi > MOST) ctx.fail(at, `fractions.${id}.bottom is [${lo}, ${hi}], write [smallest, largest] between 1 and ${MOST}`);
    if (s.d < lo || s.d > hi) ctx.fail(at, `fractions.${id}.start has the denominator ${s.d}, outside bottom [${lo}, ${hi}]`);
    if (s.n > f.wholes * s.d) ctx.fail(at, `fractions.${id}.start is ${f.start}, more than ${f.wholes} whole${f.wholes > 1 ? 's' : ''}, raise wholes or lower the numerator`);
  }
  if (own.stages && !own.stages.includes(pg.stage)) ctx.fail(at, `scene ${pg.scene} shows one of the stages ${list(own.stages)}, as stage: ${own.stages[0]}`);
  if (!own.stages && pg.stage) ctx.fail(at, `scene ${pg.scene} has no stages, leave stage out`);
  for (const id of Object.keys(own.controls)) if (!pg.controls[id]) { sound = false; ctx.fail(at, `scene ${pg.scene} needs controls.${id} as { slider: [from, to], start: n }`); }
  for (const [id, c] of Object.entries(pg.controls)) {
    if (!own.controls[id]) ctx.fail(at, `scene ${pg.scene} has no control "${id}"${Object.keys(own.controls).length ? `, its controls are ${list(Object.keys(own.controls))}` : ''}`);
    const from = c.slider[0], to = c.slider[1], start = c.start ?? from;
    if (from < 1 || from > to || start < from || start > to) ctx.fail(at, `controls.${id} runs from ${from} to ${to} and starts at ${c.start}, keep 1 ≤ from ≤ start ≤ to`);
    if (pg.fractions.a && read(pg.fractions.a.start) && to * read(pg.fractions.a.start).d > MOST * 2) ctx.fail(at, `controls.${id} goes to ${to}, which cuts the whole into more than ${MOST * 2} pieces`);
  }
  // A page whose fractions cannot be read has no starting values to check a challenge against.
  if (sound) readChallenge(pg, at, ctx);
  const scene = staged(pg); // staged() adds the measures of the page's goal to the scene's own.
  for (const m of pg.readout) if (!scene.measures[m]) ctx.fail(at, `scene ${pg.scene} has no measure "${m}", its measures are ${list(Object.keys(scene.measures))}`);
  // A text links a measure by its id, a worked formula as formula-<id>, and a fraction it only writes as itself, @1/2.
  const linkable = new Set([...Object.keys(scene.measures), ...Object.keys(scene.formulas).map(f => `formula-${f}`)]);
  return { data: pg, has: id => linkable.has(id) || !!read(id), offers: `one of ${list([...linkable])}, or a fraction written as @3/4` };
}

// A link to a measure holds its starting value, and a link to a formula the formula worked for the starting values.
function start(spec, lang, id) {
  const scene = staged(spec), f = formatter(lang), v = starts(spec);
  return id.startsWith('formula-') ? f.written(scene, v, id.slice(8)) : f.value(scene, v, id);
}

export default { id: 'parts', scenes: Object.keys(SCENES), schema: Fields, read: readPage, start };
