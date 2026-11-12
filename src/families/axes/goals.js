// What a challenge page asks the reader to reach with the figure. Node reads the goals to check a page, the browser to
// judge the figure after every change.
import FIGURES from './figures/index.js';
import { at } from './figures/polar.js';

const near = (p, q, tol) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const rose = FIGURES.rose.measures.r, box = FIGURES.cuboid.measures.volume;
// a rose with an odd k has k petals and closes at 180°, one with an even k has 2k petals and closes at 360°
const petals = k => k % 2 ? k : 2 * k, closes = k => k % 2 ? 180 : 360;
// a target names a solid by its figure and sizes it by that figure's controls
const volume = t => FIGURES[t.solid].measures.volume(t.size);

// A goal names its scenes, the fields of a target, the labels and measures that give it away, a default tolerance,
// the numbers its goal line and hint fill in, the test, and the places the solved effect plays at.
export const GOALS = {
  // the point stands where two coordinates say, read off the axes alone
  'point-at': {
    scenes: ['point', 'quadrants'], takes: { at: 'pair' }, hides: ['point', 'x', 'y', 'quadrant'], tolerance: 0.01,
    says: (t, f) => ({ at: f.coords(t.at), x: f.fmt(t.at[0]), y: f.fmt(t.at[1]) }),
    reached: (v, t, tol) => near(v.P, t.at, tol),
    marks: v => [v.P],
  },
  // two points lie a distance apart on a slanting line, so that Pythagoras gives the distance
  apart: {
    scenes: ['distance'], takes: { distance: 'number' }, hides: ['distance'], tolerance: 0.01,
    says: (t, f) => ({ d: f.fmt(t.distance), sq: f.fmt(t.distance ** 2) }),
    reached: (v, t, tol) => { const dx = v.B[0] - v.A[0], dy = v.B[1] - v.A[1]; return Math.abs(dx) > tol && Math.abs(dy) > tol && close(Math.hypot(dx, dy), t.distance, tol); },
    marks: v => [v.A, v.B],
  },
  // the point given by r and θ stands where x and y say
  'polar-at': {
    scenes: ['polar-point'], takes: { at: 'pair' }, hides: ['x', 'y'], tolerance: 0.05,
    says: (t, f) => ({ x: f.fmt(t.at[0]), y: f.fmt(t.at[1]) }),
    reached: (v, t, tol) => near(at(v.r, v.angle), t.at, tol),
    marks: v => [at(v.r, v.angle)],
  },
  // the rose has a number of petals and is traced to the angle where it closes, no further
  'rose-once': {
    scenes: ['rose'], takes: { petals: 'number' }, hides: [], tolerance: 0.5,
    says: t => ({ n: t.petals }),
    reached: (v, t, tol) => petals(v.k) === t.petals && close(v.angle, closes(v.k), tol),
    marks: v => [at(rose(v), v.angle)],
  },
  // a box stands on a square base and holds a volume
  'square-box': {
    scenes: ['cuboid'], takes: { volume: 'number' }, hides: ['volume'], tolerance: 0.01,
    says: (t, f) => ({ v: f.fmt(t.volume) }),
    reached: (v, t, tol) => close(v.a, v.b, 1e-9) && close(box(v), t.volume, tol),
    marks: () => [],
  },
  // the solid holds as much as another one, which the target names by its figure and sizes by its controls
  'same-volume': {
    scenes: ['cube', 'cuboid', 'prism', 'pyramid', 'solid-cylinder', 'cone', 'ball'], takes: { solid: 'solid', size: 'size' }, hides: ['volume'], tolerance: 0.01,
    says: (t, f, words) => ({ solid: words(`solid-${t.solid}`, Object.fromEntries(Object.entries(t.size).map(([k, n]) => [k, f.fmt(n)]))), v: f.fmt(volume(t)) }),
    reached: (v, t, tol, fig) => close(fig.measures.volume(v), volume(t), tol),
    marks: () => [],
  },
};

export const reached = (spec, target, values) => {
  const goal = GOALS[spec.challenge.goal];
  return goal.reached(values, target, spec.challenge.tolerance ?? goal.tolerance, FIGURES[spec.scene]);
};
