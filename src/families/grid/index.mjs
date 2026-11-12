// The Node half of the grid family: grids of numbered cells that colour multiples, factors, primes and remainders.
// It checks a page's fields against the scene the page names. The scenes hold the logic.
import { schema } from '@openbooknetwork/kitap';
import SCENES from './scenes.js';
import GOALS from './goals.js';
import { formatter, starts } from './format.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
const MAX = 600; // A page holds up to this many cells.

const Int = z.number().int();
const Slider = z.object({ slider: z.tuple([Int, Int]), start: Int.optional(), step: Int.positive().default(1) }).strict();
// A tap control starts with a number, with none, or with a list of marked numbers.
const Tap = z.object({ tap: z.union([Int, z.literal('none'), z.array(Int)]) }).strict();
// A challenge names its goal and the targets that Another one walks through. The page starts on the first.
const Challenge = z.object({ goal: z.string(), targets: z.array(z.union([Int, z.array(Int)])).min(1) }).strict();
const Fields = z.object({
  numbers: z.tuple([Int, Int]), // These are the first and the last number on the grid.
  columns: z.union([Int.positive(), Slider]).optional(), // A row holds this many numbers, fixed or on a slider.
  controls: z.record(z.string(), z.union([Slider, Tap])).default({}),
  readout: z.array(z.string()).default([]),
  challenge: Challenge.optional(),
}).strict();

const WRITE = { slider: '{ slider: [from, to], start: n }', tap: '{ tap: n }', pick: '{ tap: n } or { tap: none }', many: '{ tap: [] }' };
function read(pg, { at }, ctx) {
  const scene = SCENES[pg.scene];
  const [from, to] = pg.numbers, min = scene.min ?? 1;
  if (from < min || to < from) ctx.fail(at, `numbers is [${from}, ${to}], scene ${pg.scene} counts from ${min} or more, write [first, last] with first ≤ last`);
  if (to - from + 1 > MAX) ctx.fail(at, `numbers holds ${to - from + 1} numbers, a grid holds up to ${MAX}`);
  const range = (id, c) => {
    const start = c.start ?? c.slider[0];
    if (c.slider[0] > c.slider[1] || start < c.slider[0] || start > c.slider[1]) ctx.fail(at, `${id} slides over [${c.slider}] from ${start}, write [low, high] and a start between them`);
  };
  if (scene.layout && pg.columns != null) ctx.fail(at, `scene ${pg.scene} lays out its own numbers, leave out columns`);
  if (!scene.layout) {
    if (pg.columns == null) ctx.fail(at, `scene ${pg.scene} needs columns, the numbers in a row: a number such as 10, or { slider: [2, 12], start: 10 }`);
    else if (pg.columns.slider) range('columns', pg.columns);
  }
  const aim = pg.challenge ? challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx }) : null;
  if (aim) for (const t of pg.challenge.targets) {
    const wrong = aim.target(t);
    if (wrong) ctx.fail(at, `challenge.targets holds ${JSON.stringify(t)}, ${wrong}`);
  }
  const given = aim?.sets ? Object.keys(aim.sets(pg.challenge.targets[0])) : []; // A challenge's target sets these values.
  for (const id of given) if (pg.controls[id]) ctx.fail(at, `goal ${pg.challenge.goal} sets ${id} from its target, leave out controls.${id}`);
  for (const [id, kind] of Object.entries(scene.controls)) {
    if (given.includes(id)) continue;
    const c = pg.controls[id], want = kind === 'slider' ? 'slider' : 'tap';
    if (!c || !(want in c)) { ctx.fail(at, `scene ${pg.scene} needs controls.${id} as ${WRITE[kind]}`); continue; }
    if (c.slider) range(`controls.${id}`, c);
    const [lo, hi] = (typeof scene.limits === 'function' ? scene.limits(pg) : scene.limits)?.[id] ?? [-Infinity, Infinity];
    if (c.slider && (c.slider[0] < lo || c.slider[1] > hi)) ctx.fail(at, `controls.${id} slides over [${c.slider}], scene ${pg.scene} takes ${id} from ${lo} to ${hi}`);
    if (c.tap != null && (kind === 'many') !== Array.isArray(c.tap)) ctx.fail(at, `scene ${pg.scene} needs controls.${id} as ${WRITE[kind]}`);
    if (kind === 'tap' && c.tap === 'none') ctx.fail(at, `controls.${id} starts with no number, scene ${pg.scene} needs one: write { tap: n }`);
    for (const n of [c.tap ?? []].flat()) if (n !== 'none' && (n < Math.max(from, 1) || n > to)) ctx.fail(at, `controls.${id} taps ${n}, pick a number from ${Math.max(from, 1)} to ${to}`);
  }
  for (const id of Object.keys(pg.controls)) if (!scene.controls[id]) ctx.fail(at, `scene ${pg.scene} has no control "${id}", its controls are ${list(Object.keys(scene.controls))}`);
  // The spiral winds 1, 2, 3 and so on round a middle cell, so its side is odd and the numbers reach its square.
  if (pg.scene === 'spiral' && pg.controls.size?.slider) {
    const s = pg.controls.size, sizes = [s.slider[0], s.slider[1], s.start ?? s.slider[0]];
    if (sizes.some(n => n % 2 === 0) || s.step % 2) ctx.fail(at, `controls.size slides over [${s.slider}] by ${s.step}, a spiral's side is odd: write odd ends and start with step: 2`);
    if (from !== 1 || to < s.slider[1] ** 2) ctx.fail(at, `numbers is [${from}, ${to}], a spiral of side ${s.slider[1]} needs [1, ${s.slider[1] ** 2}]`);
  }
  // Every target must be in reach of the page's controls, and the page must not open with the goal reached.
  if (aim) {
    for (const t of pg.challenge.targets) {
      const far = aim.reach(pg, t);
      if (far) ctx.fail(at, `challenge target ${JSON.stringify(t)} ${far}, change the target or the controls`);
    }
    if (aim.holds(starts(pg), pg, pg.challenge.targets[0])) ctx.fail(at, `the page opens with goal ${pg.challenge.goal} reached for ${JSON.stringify(pg.challenge.targets[0])}, change the starting values or put another target first`);
    hidden(pg.readout, aim.hides ?? [], at, ctx);
  }
  const values = id => !!scene.measures[id] || id in pg.controls || (id === 'columns' && pg.columns != null);
  const named = [...Object.keys(scene.measures), ...Object.keys(pg.controls), ...(pg.columns != null ? ['columns'] : [])];
  for (const id of pg.readout) if (!values(id)) ctx.fail(at, `readout names "${id}", scene ${pg.scene} reads out ${list(named)}`);
  // A text links a measure or a control by its id, and a worked formula as formula-<id>.
  const worked = Object.keys(scene.formulas).map(f => `formula-${f}`);
  return { data: pg, has: id => values(id) || worked.includes(id), offers: `one of ${list([...named, ...worked])}` };
}

// A link to a measure or a control holds its starting value, and a link to a formula holds the formula worked for
// the starting values.
function start(spec, lang, id) {
  const scene = SCENES[spec.scene], f = formatter(lang), values = starts(spec);
  return id.startsWith('formula-') ? (scene.formulas[id.slice(8)] ? f.written(scene, spec, values, id.slice(8)) : null) : f.value(scene, spec, values, id);
}

// The cells take eight hues that readers with any colour vision can tell apart. Each hue has a step for each theme
// mode and the text colour that reads best on it.
const HUES = [['#2a78d6', '#3987e5'], ['#eb6834', '#d95926'], ['#1baf7a', '#199e70'], ['#eda100', '#c98500'],
  ['#e87ba4', '#d55181'], ['#008300', '#008300'], ['#6250d6', '#9085e9'], ['#e34948', '#e66767']];
const INK = ['#ffffff', '#1a1a19'];
const contrast = (a, b) => {
  const lum = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const readable = hue => INK.reduce((best, ink) => contrast(hue, ink) > contrast(hue, best) ? ink : best);
const families = Object.fromEntries(HUES.flatMap(([light, dark], i) => [[`g${i + 1}`, { color: light, color_dark: dark }], [`g${i + 1}-ink`, { color: readable(light), color_dark: readable(dark) }]]));

// A story with no cover opens on the finished sieve of the hundred square.
const OVERVIEW = { scene: 'sieve', numbers: [1, 100], columns: 10, controls: { used: { slider: [0, 4], start: 4, step: 1 } }, readout: [] };

export default { id: 'grid', scenes: Object.keys(SCENES), schema: Fields, read, start, bundle: () => ({ families, data: { overview: OVERVIEW } }) };
