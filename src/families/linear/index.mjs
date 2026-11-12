// The Node half of the linear family: transformations of the plane and matrices. It reads the fields of a page and
// checks them against the scene they name.
import { schema } from '@openbooknetwork/kitap';
import { SCENES, starts } from './scenes.js';
import { SHAPES } from './shapes.js';
import { PRESETS, product } from './matrices.js';
import { formatter, formulas } from './format.js';
import { GOALS, flat, route } from './goals.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
const EXTRAS = ['square', 'steps', 'ghost'];

const Pair = z.tuple([z.number(), z.number()]);
const Fields = z.object({
  shape: z.string().default('F'),
  at: Pair.default([1, 1]), // P, the shape's corner, sits here.
  view: z.number().positive().default(5.5), // The figure shows this much of the plane on each side of the origin.
  start: z.record(z.string(), z.number()).default({}), // The scene's values start here when the page opens.
  matrix: z.tuple([Pair, Pair]).optional(), // The matrix scene starts from this matrix, row by row.
  handles: z.array(z.string()).optional(), // The reader drags these knobs, or all of the scene's when the list is left out.
  show: z.array(z.string()).default([]),
  named: z.array(z.string()).max(2).default([]), // The time slider moves the plane from the identity through these in turn.
  moves: z.array(z.string()).default([]), // Each button applies a named matrix to the plane as it is.
  readout: z.array(z.string()).default([]),
  // A goal sets targets for the reader, and Another one steps through them.
  challenge: z.object({ goal: z.string(), targets: z.array(z.union([z.number(), z.tuple([Pair, Pair])])).min(1), tolerance: z.number().nonnegative().default(0.01) }).strict().optional(),
}).strict();

function read(pg, { at }, ctx) {
  const scene = SCENES[pg.scene];
  if (!SHAPES[pg.shape]) ctx.fail(at, `unknown shape "${pg.shape}", the shapes are ${list(Object.keys(SHAPES))}`);
  for (const k of Object.keys(pg.start)) if (!(k in scene.values)) ctx.fail(at, `start names "${k}", scene ${pg.scene} has the values ${list(Object.keys(scene.values))}`);
  if (pg.matrix && pg.scene !== 'matrix') ctx.fail(at, `matrix sets the matrix scene's start, scene ${pg.scene} starts from start`);
  const handles = pg.handles ?? (pg.named.length ? [] : scene.handles);
  for (const h of handles) if (!scene.handles.includes(h)) ctx.fail(at, `handles names "${h}", scene ${pg.scene} has the handles ${list(scene.handles)}`);
  for (const s of pg.show) if (!EXTRAS.includes(s)) ctx.fail(at, `show names "${s}", a figure can show ${list(EXTRAS)}`);
  for (const p of pg.named) {
    if (!PRESETS[p]) ctx.fail(at, `named lists "${p}", the named matrices are ${list(Object.keys(PRESETS))}`);
    if (pg.scene !== 'matrix') ctx.fail(at, `named matrices move the matrix scene, scene ${pg.scene} has none`);
  }
  if (pg.named.length && (handles.length || pg.matrix || pg.moves.length || pg.challenge)) ctx.fail(at, 'the time slider alone moves a page with named matrices, so leave out handles, matrix, moves and challenge');
  const end = pg.named.length && pg.named.every(p => PRESETS[p]) && past(pg, product(pg.named));
  if (end) ctx.fail(at, `named sends a corner of the ${pg.shape} to ${end}, past the edge of the figure. Keep every corner within ${pg.view}, or raise view`);
  for (const p of pg.moves) {
    if (!PRESETS[p]) ctx.fail(at, `moves names "${p}", the named matrices are ${list(Object.keys(PRESETS))}`);
    if (pg.scene !== 'matrix') ctx.fail(at, `moves act on the matrix scene, scene ${pg.scene} has none`);
  }
  for (const id of pg.readout) if (!scene.measures.includes(id)) ctx.fail(at, `readout names "${id}", scene ${pg.scene} measures ${list(scene.measures)}`);
  if (pg.challenge) readChallenge({ ...pg, handles }, at, ctx);
  // A text links a measure by its id and a worked formula as formula-<id>. A challenge hides what gives it away.
  const hides = GOALS[pg.challenge?.goal]?.hides ?? [];
  const linkable = new Set([...scene.measures, ...formulas(pg).map(f => `formula-${f}`), ...(pg.challenge?.goal === 'det' ? ['target'] : [])].filter(id => !hides.includes(id)));
  return { data: { ...pg, handles }, has: id => linkable.has(id), offers: `one of ${list(linkable)}` };
}

// past(pg, m) is the first corner of the page's shape that the matrix m sends past the edge of the figure, written
// as a point, or null.
function past(pg, m) {
  if (!SHAPES[pg.shape]) return null;
  const far = SHAPES[pg.shape].rings[0].map(([x, y]) => ({ x: x + pg.at[0], y: y + pg.at[1] })).map(p => ({ x: m[0] * p.x + m[1] * p.y, y: m[2] * p.x + m[3] * p.y }))
    .find(p => Math.abs(p.x) > pg.view || Math.abs(p.y) > pg.view);
  return far ? `(${+far.x.toFixed(2)}, ${+far.y.toFixed(2)})` : null;
}

// A challenge's targets must suit its goal, be reachable with the page's controls and stay inside the figure, and
// the page must not open with any of them reached.
function readChallenge(pg, at, ctx) {
  const c = pg.challenge, goal = challenge(c, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  hidden(pg.readout, goal.hides, at, ctx);
  const v = starts(pg), m = [v.a, v.b, v.c, v.d], lim = pg.view - 0.3, dragged = pg.handles.length > 0;
  c.targets.forEach((raw, n) => {
    const t = flat(raw), where = `challenge.targets.${n}`;
    if (goal.kind === 'number' && typeof t !== 'number') return ctx.fail(at, `${where} is a matrix, a ${c.goal} goal takes a number`);
    if (goal.kind === 'matrix' && typeof t === 'number') return ctx.fail(at, `${where} is a number, a ${c.goal} goal takes a matrix written [[a, b], [c, d]]`);
    if (goal.reached(m, t, c.tolerance)) ctx.fail(at, `${where} is reached before the reader does anything. Start from another matrix or pick another target`);
    if (goal.kind === 'number' && dragged && Math.abs(t * 4 - Math.round(t * 4)) > 1e-9) ctx.fail(at, `${where} is ${t}, and arrows that snap to halves only make determinants in quarters. Pick a multiple of 0.25`);
    if (goal.kind !== 'matrix') return;
    if (dragged && t.some(x => Math.abs(x * 2 - Math.round(x * 2)) > 1e-9 || Math.abs(x) > lim)) ctx.fail(at, `${where} has an entry the arrows cannot reach. Use halves between ${-lim} and ${lim}`);
    if (pg.moves.length && pg.moves.every(p => PRESETS[p]) && !route(m, t, pg.moves, 3)) ctx.fail(at, `${where} takes more than three of the moves ${list(pg.moves)}. Pick a product of two or three of them`);
    if (!dragged && !pg.moves.length) ctx.fail(at, `a ${c.goal} goal needs handles or moves for the reader to reach it`);
    const far = past(pg, t);
    if (far) ctx.fail(at, `${where} sends a corner of the ${pg.shape} to ${far}, past the edge of the figure. Keep every corner within ${pg.view}, or raise view`);
  });
}

// A link to a measure holds its starting value, and a link to a formula holds the formula worked for the starting
// values.
function start(spec, lang, id) {
  const f = formatter(lang), v = starts(spec), formula = id.startsWith('formula-') && id.slice(8);
  // A link to a formula the page does not offer is reported by its missing-link message.
  if (formula) return formulas(spec).includes(formula) ? f.written(spec, v, formula) : null;
  return f.value(spec, v, id);
}

// The story's overview shows a sheared plane, still, with no handles. The arrows i and j each have a colour, which
// the build writes as the tokens --z-i and --z-j.
const OVERVIEW = { scene: 'matrix', shape: 'F', at: [1, 1], view: 5, start: {}, matrix: [[1, 0.5], [-0.25, 1]], handles: [], show: [], named: [], moves: [], readout: [] };
const bundle = () => ({ data: { overview: OVERVIEW }, families: { i: { color: '#1f8a4c', color_dark: '#5fcf8a' }, j: { color: '#2b66c4', color_dark: '#78a6ff' } } });

export default { id: 'linear', scenes: Object.keys(SCENES), schema: Fields, read, start, bundle };
