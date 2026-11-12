// The Node half of the proof family, proofs without words. A page names a proof in of and the step it plays, and
// this checks the page's controls and challenge against that proof.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { schema } from '@openbooknetwork/kitap';
import PROOFS from './proofs/index.js';
import { GOALS } from './goals.js';
import { formatter, starts } from './format.js';
import { list, challenge } from '../../node.mjs';

const { z } = schema;
const HERE = path.dirname(fileURLToPath(import.meta.url)), KIT = path.resolve(HERE, '../../kit');
// keys reads the keys of the family's and the kit's i18n files, whose strings sit one to a line.
const keys = lang => new Set([HERE, KIT].flatMap(dir => [...fs.readFileSync(path.join(dir, 'i18n', `${lang}.yaml`), 'utf8').matchAll(/^([\w.-]+):/gm)].map(m => m[1])));

const Slider = z.object({ slider: z.tuple([z.number(), z.number()]), start: z.number().optional(), step: z.number().positive().default(1) }).strict();
// A challenge names a goal from goals.js, the targets it can ask for in turn, and how close a value must come.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.number()).min(1).optional(), tolerance: z.number().positive().optional() }).strict();
// A control written as a value has no slider, and the page keeps that value.
const Fixed = z.object({ value: z.number() }).strict();
const Fields = z.object({
  of: z.string(), // The proof, from proofs/index.js.
  step: z.union([z.number().int().positive(), z.literal('last')]).optional(), // The step the page plays.
  controls: z.record(z.string(), z.union([Slider, Fixed])).default({}),
  challenge: Challenge.optional(),
}).strict();

// A proof can ask a slider for a min, a max, whole numbers only or even numbers only.
function limits(id, c, want) {
  const [from, to] = c.slider ?? [c.value, c.value], start = c.value ?? c.start ?? from, all = c.slider ? [from, to, start, c.step] : [start];
  if (c.slider && from >= to) return `controls.${id}.slider is [${from}, ${to}], write the smaller value first`;
  if (start < from || start > to) return `controls.${id}.start is ${start}, pick a value from ${from} to ${to}`;
  if (want.min !== undefined && from < want.min) return `controls.${id} starts at ${from}, the proof draws ${id} from ${want.min}`;
  if (want.max !== undefined && to > want.max) return `controls.${id} reaches ${to}, the proof draws ${id} up to ${want.max}`;
  if (want.whole && !all.every(Number.isInteger)) return `controls.${id} takes whole numbers, make its range, start and step whole`;
  if (want.even && !all.every(n => n % 2 === 0)) return `controls.${id} takes even numbers, make its range, start and step even`;
  return null;
}

function read(pg, { at }, ctx) {
  const proof = PROOFS[pg.of];
  if (!proof) ctx.fail(at, `of is "${pg.of}", the proofs are ${list(Object.keys(PROOFS))}`);
  for (const [id, want] of Object.entries(proof.controls)) {
    if (!pg.controls[id]) ctx.fail(at, `proof ${pg.of} needs controls.${id} as { slider: [from, to], start: n } or { value: n }`);
    const wrong = limits(id, pg.controls[id], want);
    if (wrong) ctx.fail(at, wrong);
  }
  for (const id of Object.keys(pg.controls)) if (!proof.controls[id]) ctx.fail(at, `proof ${pg.of} has no control "${id}", its controls are ${list(Object.keys(proof.controls))}`);
  const wrong = proof.check?.(pg.controls);
  if (wrong) ctx.fail(at, wrong);
  // The steps for the starting values may move only pieces.
  const scene = proof.scene(starts(pg.controls), { fmt: formatter('en').fmt, ranges: pg.controls }), ids = new Set(scene.pieces.map(p => p.id));
  for (const [i, step] of scene.steps.entries()) {
    const stray = [...Object.keys(step.set ?? {}), ...(step.hi ?? [])].find(id => !ids.has(id));
    if (stray) ctx.fail(at, `proof ${pg.of} step ${i + 1} moves "${stray}", which is not one of its pieces`);
  }
  // A page plays one step, and a challenge takes its step from its goal.
  if (pg.challenge && pg.step) ctx.fail(at, `goal ${pg.challenge.goal} sets the step, remove step`);
  if (!pg.challenge && !pg.step) ctx.fail(at, `step is missing, write a step from 1 to ${scene.steps.length} or last`);
  if (pg.step > scene.steps.length) ctx.fail(at, `step is ${pg.step}, proof ${pg.of} has ${scene.steps.length} steps for these values`);
  if (pg.challenge) readChallenge(pg, scene, at, ctx);
  // Each slider's name, and a challenge's goal and hint, are strings in both languages.
  const sliders = Object.keys(pg.controls).filter(id => pg.controls[id].slider);
  const needs = [...sliders.map(id => `proof_${id}`), ...(pg.challenge ? [`proof_goal-${pg.challenge.goal}`, `proof_hint-${pg.challenge.goal}`, 'hesap_solved', 'hesap_hint', 'hesap_another'] : ['hesap_time'])];
  for (const lang of ['en', 'tr']) {
    const has = keys(lang);
    for (const key of needs) if (!has.has(key)) ctx.fail(at, `hesap/src/${key.startsWith('hesap_') ? 'kit' : 'families/proof'}/i18n/${lang}.yaml has no "${key}", add the string there`);
  }
  // A text links a measure or a slider by its id, and a worked formula as formula-<id>.
  const linkable = new Set([...Object.keys(proof.measures), ...Object.keys(proof.controls), ...Object.keys(proof.formulas).map(f => `formula-${f}`)]);
  return { data: pg, has: id => linkable.has(id), offers: `one of ${list(linkable)}, which proof ${pg.of} offers` };
}

// settings lists every value of every slider in all their combinations, and a challenge's targets are checked
// against them.
const settings = controls => Object.entries(controls).reduce((all, [id, c]) => all.flatMap(v => {
  if (!c.slider) return [{ ...v, [id]: c.value }];
  const n = Math.round((c.slider[1] - c.slider[0]) / c.step);
  return Array.from({ length: n + 1 }, (_, i) => ({ ...v, [id]: c.slider[0] + i * c.step }));
}), [{}]);

// A challenge's goal plays on the page's proof and does not hold when the page opens. Each target is within reach of
// the sliders.
function readChallenge(pg, scene, at, ctx) {
  const c = pg.challenge, goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  if (goal.of !== pg.of) ctx.fail(at, `goal ${c.goal} plays on proof ${goal.of}, write of: ${goal.of}`);
  if (goal.targets && !c.targets) ctx.fail(at, `goal ${c.goal} asks for targets, write challenge.targets as a list of numbers`);
  if (!goal.targets && c.targets) ctx.fail(at, `goal ${c.goal} takes no targets, remove challenge.targets`);
  const slots = scene.slots ?? {}, start = Object.fromEntries((goal.drag ?? []).map(id => [id, slots[id].first]));
  const state = (values, target) => ({ values, target, tolerance: c.tolerance ?? goal.tolerance, at: start, slots });
  if (goal.holds(state(starts(pg.controls), c.targets?.[0]))) ctx.fail(at, `the page opens with goal ${c.goal} reached${c.targets ? ` for the target ${c.targets[0]}` : ''}, change a slider's start${c.targets ? ' or the first target' : ''}`);
  const all = settings(pg.controls);
  for (const target of c.targets ?? []) if (!all.some(v => goal.holds(state(v, target)))) ctx.fail(at, `challenge.targets lists ${target}, which no setting of the sliders reaches`);
}

// A link to a measure or a slider shows its starting value, and a link to a formula the formula worked for the
// starting values.
function start(spec, lang, id) {
  const proof = PROOFS[spec.of], f = formatter(lang), values = starts(spec.controls);
  return id.startsWith('formula-') ? f.written(proof, values, id.slice(8)) : f.value(proof, values, id);
}

// A story with no cover opens on the last step of the Pythagoras proof.
const OVERVIEW = { scene: 'proof', of: 'pythagoras', step: 6, controls: { a: { slider: [1, 6], start: 3, step: 1 }, b: { slider: [1, 6], start: 4, step: 1 } } };

export default { id: 'proof', scenes: ['proof'], schema: Fields, read, start, bundle: () => ({ data: { overview: OVERVIEW } }) };
